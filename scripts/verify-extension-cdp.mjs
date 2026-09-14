import { writeFile } from "node:fs/promises";

const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Chrome verification timed out")), 35_000));
const endpoint = process.argv[2] ?? "http://127.0.0.1:9223";
const expectedUrlPart = process.argv[3] ?? "zhuanlan.zhihu.com";
const exercisePersistence = process.argv.includes("--exercise");
const mobileViewport = process.argv.includes("--mobile");
const screenshotPath = process.argv.find((argument) => argument.startsWith("--screenshot="))?.slice("--screenshot=".length);

async function findPage() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const targets = await (await fetch(`${endpoint}/json/list`)).json();
      const page = targets.find((target) => target.type === "page" && target.url.includes(expectedUrlPart));
      if (page) return page;
    } catch {
      // Chrome may still be opening its debugging endpoint.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Chrome page target was not found");
}

const page = await findPage();
const inspectingExtensions = page.url.startsWith("chrome://extensions");
const socket = new WebSocket(page.webSocketDebuggerUrl);
await Promise.race([
  new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  }),
  timeout,
]);

let requestId = 0;
function evaluate(expression) {
  return new Promise((resolve, reject) => {
    const id = ++requestId;
    const timer = setTimeout(() => reject(new Error("CDP evaluation timed out")), 10_000);
    const onMessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== id) return;
      clearTimeout(timer);
      socket.removeEventListener("message", onMessage);
      if (message.result.exceptionDetails) reject(new Error(message.result.exceptionDetails.text));
      else resolve(message.result.result.value);
    };
    socket.addEventListener("message", onMessage);
    socket.send(JSON.stringify({
      id,
      method: "Runtime.evaluate",
      params: { expression, returnByValue: true, awaitPromise: true },
    }));
  });
}

function command(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++requestId;
    const timer = setTimeout(() => reject(new Error(`CDP ${method} timed out`)), 10_000);
    const listener = (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== id) return;
      clearTimeout(timer);
      socket.removeEventListener("message", listener);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    };
    socket.addEventListener("message", listener);
    socket.send(JSON.stringify({ id, method, params }));
  });
}

if (mobileViewport && !inspectingExtensions) {
  await command("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
}

const expression = inspectingExtensions
  ? `(async () => {
      await new Promise(resolve => setTimeout(resolve, 1500));
      const manager = document.querySelector('extensions-manager');
      const list = manager?.shadowRoot?.querySelector('#items-list');
      const items = list?.shadowRoot?.querySelectorAll('extensions-item') ?? [];
      return Array.from(items, item => ({
        id: item.getAttribute('id'),
        text: item.shadowRoot?.textContent?.replace(/\\s+/g, ' ').trim().slice(0, 240) ?? ''
      }));
    })()`
  : `(async () => {
      await new Promise(resolve => setTimeout(resolve, 5000));
      const host = document.getElementById('liukanshan-reading-companion');
      return {
        title: document.title,
        url: location.href,
        hasArticleBody: Boolean(document.querySelector('.Post-RichTextContainer, [itemprop=articleBody]')),
        hasHost: Boolean(host),
        hasShadow: Boolean(host?.shadowRoot),
        companionText: host?.shadowRoot?.querySelector('.panel')?.textContent?.replace(/\\s+/g, ' ').trim().slice(0, 180) ?? ''
      };
    })()`;
let result = await Promise.race([evaluate(expression), timeout]);
if (exercisePersistence && !inspectingExtensions) {
  const enabled = await evaluate(`(() => {
    const root = document.getElementById('liukanshan-reading-companion')?.shadowRoot;
    const button = Array.from(root?.querySelectorAll('button') ?? []).find(item => item.textContent?.includes('开启本地记录'));
    button?.click();
    return Boolean(button);
  })()`);
  if (!enabled) throw new Error("Consent button was not available");
  await new Promise((resolve) => setTimeout(resolve, 5000));
  await command("Page.reload", { ignoreCache: true });
  await new Promise((resolve) => setTimeout(resolve, 7000));
  result = await evaluate(`(() => {
    const host = document.getElementById('liukanshan-reading-companion');
    const panelText = host?.shadowRoot?.querySelector('.panel')?.textContent?.replace(/\\s+/g, ' ').trim() ?? '';
    return {
      title: document.title,
      url: location.href,
      hasArticleBody: Boolean(document.querySelector('.Post-RichTextContainer, [itemprop=articleBody]')),
      hasHost: Boolean(host),
      hasShadow: Boolean(host?.shadowRoot),
      persistedCheckpoint: panelText.includes('继续阅读') && panelText.includes('最近停留'),
      panelText: panelText.slice(0, 240)
    };
  })()`);
}
if (screenshotPath && !inspectingExtensions) {
  const screenshot = await command("Page.captureScreenshot", { format: "png", fromSurface: true });
  await writeFile(screenshotPath, Buffer.from(screenshot.data, "base64"));
}
socket.close();
console.log(JSON.stringify(result, null, 2));
if (!inspectingExtensions && (!result.hasArticleBody || !result.hasHost || !result.hasShadow || (exercisePersistence && !result.persistedCheckpoint))) process.exitCode = 1;
