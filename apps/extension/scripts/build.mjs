import { build } from "vite";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";

const extensionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(extensionRoot, "../..");
const outDir = path.join(repoRoot, "dist/liukanshan-reader");
const localAccessSecretPath = path.join(repoRoot, "资料/知乎直答/API-key.md");

async function loadLocalAccessSecret() {
  if (process.env.ZHIHU_ACCESS_SECRET?.trim()) return "environment";
  try {
    const secret = (await readFile(localAccessSecretPath, "utf8")).trim();
    if (!secret) throw new Error("本地知乎直答密钥文件为空");
    process.env.ZHIHU_ACCESS_SECRET = secret;
    return "local-file";
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return "missing";
    throw error;
  }
}

// The two Vite builds share an output directory. Clear it explicitly so files
// emitted by an earlier build configuration cannot leak into the extension ZIP.
const credentialSource = await loadLocalAccessSecret();
console.log(
  credentialSource === "missing"
    ? "Building without a Zhihu credential; recap generation will be unavailable."
    : `Embedding the Zhihu credential from ${credentialSource === "environment" ? "the environment" : "the ignored local key file"}.`,
);
await rm(outDir, { recursive: true, force: true });
await build({ configFile: path.join(extensionRoot, "vite.content.config.ts") });
await build({ configFile: path.join(extensionRoot, "vite.background.config.ts") });
await mkdir(path.join(outDir, "assets"), { recursive: true });
for (const asset of ["mascot.png", "icon-16.png", "icon-32.png", "icon-48.png", "icon-128.png"]) {
  await cp(path.join(extensionRoot, "assets", asset), path.join(outDir, "assets", asset));
}
const manifest = JSON.parse(await readFile(path.join(extensionRoot, "manifest.base.json"), "utf8"));
await writeFile(path.join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

async function listFiles(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...(await listFiles(path.join(directory, entry.name), relative)));
    else files.push(relative);
  }
  return files;
}

async function createZip(directory, target) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const relative of await listFiles(directory)) {
    const name = Buffer.from(relative.replaceAll("\\", "/"));
    const source = await readFile(path.join(directory, relative));
    const compressed = deflateRawSync(source, { level: 9 });
    const crc = crc32(source);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(source.length, 22);
    local.writeUInt16LE(name.length, 26);
    localParts.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(source.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + compressed.length;
  }
  const centralSize = centralParts.reduce((size, part) => size + part.length, 0);
  const fileCount = centralParts.length / 2;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(fileCount, 8);
  end.writeUInt16LE(fileCount, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  await writeFile(target, Buffer.concat([...localParts, ...centralParts, end]));
}

await createZip(outDir, path.join(repoRoot, "dist/liukanshan-reader.zip"));

console.log(`Loadable extension built at ${outDir} (ZIP included)`);
