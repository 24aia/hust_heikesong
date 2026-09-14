import { describe, expect, it, vi } from "vitest";
import { ManualBookmarkSelector } from "../src/bookmarks/manual-selector";
import { ZhihuPageAdapter } from "../src/page-adapter/zhihu-page-adapter";
import { setPage } from "./fixtures";

describe("ManualBookmarkSelector", () => {
  it("supports keyboard focus and restores the page tabindex after selection", () => {
    const location = setPage(
      "https://zhuanlan.zhihu.com/p/20",
      `<article><div itemprop="articleBody"><p>第一段。</p><p tabindex="3">第二段。</p></div></article>`,
    );
    const paragraphs = new ZhihuPageAdapter(document, location).extractSnapshot().paragraphs;
    const onSelect = vi.fn();
    const selector = new ManualBookmarkSelector(paragraphs, onSelect, vi.fn());
    selector.start();
    expect(paragraphs[0].element.tabIndex).toBe(0);
    paragraphs[0].element.focus();
    paragraphs[0].element.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    expect(onSelect).toHaveBeenCalledWith(paragraphs[0], 0);
    expect(paragraphs[0].element.hasAttribute("tabindex")).toBe(false);
    expect(paragraphs[1].element.getAttribute("tabindex")).toBe("3");
  });

  it("selects the clicked paragraph even without a prior hover event", () => {
    const location = setPage(
      "https://zhuanlan.zhihu.com/p/21",
      `<article><div itemprop="articleBody"><p>直接点击这一段。</p></div></article>`,
    );
    const paragraphs = new ZhihuPageAdapter(document, location).extractSnapshot().paragraphs;
    const onSelect = vi.fn();
    new ManualBookmarkSelector(paragraphs, onSelect, vi.fn()).start();
    paragraphs[0].element.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(onSelect).toHaveBeenCalledWith(paragraphs[0], 0);
  });
});
