import { describe, expect, it } from "vitest";
import { AnchorRestorer } from "../src/anchor-resolver/restorer";
import { createCheckpoint } from "../src/bookmarks/checkpoint";
import { ZhihuPageAdapter } from "../src/page-adapter/zhihu-page-adapter";
import { ExtensionReadingHost } from "../src/transport/reading-host";
import { setPage } from "./fixtures";

describe("ExtensionReadingHost", () => {
  it("freezes a cutoff and excludes the cutoff paragraph and unread suffix", async () => {
    const location = setPage(
      "https://zhuanlan.zhihu.com/p/2026",
      `<article><div itemprop="articleBody">
        <p>已读第一段。</p><p>已读第二段。</p><p>断点段落。</p><p>UNREAD_SECRET_MARKER</p>
      </div></article>`,
    );
    const adapter = new ZhihuPageAdapter(document, location);
    const snapshot = adapter.extractSnapshot();
    const checkpoint = createCheckpoint(adapter, snapshot, 2, "manual", new Date("2026-09-14T00:00:00Z"));
    const host = new ExtensionReadingHost(adapter, new AnchorRestorer(adapter));
    host.freezeCheckpoint(checkpoint);
    const input = await host.getRecapInput("brief");
    expect(input.paragraphs.map(({ text }) => text)).toEqual(["已读第一段。", "已读第二段。"]) ;
    expect(JSON.stringify(input)).not.toContain("断点段落");
    expect(JSON.stringify(input)).not.toContain("UNREAD_SECRET_MARKER");
    expect(input.cutoff).toEqual({ anchorKind: "manual", policy: "before-paragraph" });
  });

  it("marks citation snapshots stale after content changes", async () => {
    const location = setPage(
      "https://zhuanlan.zhihu.com/p/2026",
      `<article><div itemprop="articleBody"><p>第一段。</p><p>第二段。</p><p>断点。</p></div></article>`,
    );
    const adapter = new ZhihuPageAdapter(document, location);
    const snapshot = adapter.extractSnapshot();
    const host = new ExtensionReadingHost(adapter, new AnchorRestorer(adapter));
    host.freezeCheckpoint(createCheckpoint(adapter, snapshot, 2, "automatic"));
    const input = await host.getRecapInput("bridge");
    snapshot.paragraphs[0].element.textContent = "第一段已编辑。";
    expect(await host.locateParagraph(input.contentKey, input.inputHash, input.paragraphs[0].id)).toEqual({ status: "stale" });
  });

  it("rejects recap input above the 20,000 code point limit without truncating it", async () => {
    const location = setPage(
      "https://zhuanlan.zhihu.com/p/2027",
      `<article><div itemprop="articleBody"><p>${"甲".repeat(10_001)}</p><p>${"乙".repeat(10_000)}</p><p>断点。</p></div></article>`,
    );
    const adapter = new ZhihuPageAdapter(document, location);
    const snapshot = adapter.extractSnapshot();
    const host = new ExtensionReadingHost(adapter, new AnchorRestorer(adapter));
    host.freezeCheckpoint(createCheckpoint(adapter, snapshot, 2, "manual"));

    await expect(host.getRecapInput("brief")).rejects.toMatchObject({ code: "INPUT_TOO_LARGE" });
  });
});
