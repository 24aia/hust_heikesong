import { describe, expect, it } from "vitest";
import { ZhihuPageAdapter } from "../src/page-adapter/zhihu-page-adapter";
import { setPage } from "./fixtures";

describe("ZhihuPageAdapter", () => {
  it("detects a direct answer and excludes controls and comments", () => {
    const location = setPage(
      "https://www.zhihu.com/question/123/answer/456?utm_source=test",
      `<h1 class="QuestionHeader-title">为什么持续学习</h1>
       <article><div class="QuestionAnswer-content"><div class="RichContent-inner">
         <p>第一段正文。</p><p>第二段正文。</p><button>展开全文</button>
         <div class="Comments-container"><p>评论不属于正文。</p></div>
       </div></div></article>`,
    );
    const adapter = new ZhihuPageAdapter(document, location);
    const snapshot = adapter.extractSnapshot();
    expect(snapshot.content.contentKey).toBe("answer:456");
    expect(snapshot.content.sourceUrl).toContain("utm_source=test");
    expect(snapshot.paragraphs.map(({ text }) => text)).toEqual(["第一段正文。", "第二段正文。"]) ;
  });

  it("detects an article and reports non-text content", () => {
    const location = setPage(
      "https://zhuanlan.zhihu.com/p/9988",
      `<article><h1 class="Post-Title">Agent 的长期记忆</h1><div itemprop="articleBody"><p>记住阅读现场。</p><img alt="知识图谱"/><p>理解关注变化。</p></div></article>`,
    );
    const snapshot = new ZhihuPageAdapter(document, location).extractSnapshot();
    expect(snapshot.content.contentKey).toBe("article:9988");
    expect(snapshot.warnings).toHaveLength(1);
  });

  it("marks an answer as partial when its expand control is outside the text root", () => {
    const location = setPage(
      "https://www.zhihu.com/question/123/answer/457",
      `<article class="AnswerItem"><div class="RichContent"><div class="QuestionAnswer-content"><div class="RichContent-inner"><p>当前取得的正文。</p></div></div><button class="ContentItem-expandButton">阅读全文</button></div></article>`,
    );
    const snapshot = new ZhihuPageAdapter(document, location).extractSnapshot();

    expect(snapshot.content.coverage).toBe("partial-prefix");
  });

  it("discovers every loaded answer and keeps each answer in its own content scope", () => {
    const location = setPage(
      "https://www.zhihu.com/question/123/answer/456",
      `<h1 class="QuestionHeader-title">一个问题</h1>
       <article class="AnswerItem" data-zop='{"itemId":"456"}'>
         <div class="QuestionAnswer-content"><div class="RichContent-inner"><p>第一个回答。</p></div></div>
       </article>
       <article class="AnswerItem" data-zop='{"itemId":"789"}'>
         <div class="RichContent-inner"><p>另一个回答第一段。</p><p>另一个回答第二段。</p></div>
       </article>`,
    );
    const adapter = new ZhihuPageAdapter(document, location);

    const snapshots = adapter.extractAvailableSnapshots();

    expect(snapshots.map(({ content }) => content.contentKey)).toEqual(["answer:456", "answer:789"]);
    expect(adapter.extractSnapshotByContentKey("answer:789").paragraphs.map(({ text }) => text)).toEqual([
      "另一个回答第一段。",
      "另一个回答第二段。",
    ]);
  });

  it("uses neighbouring context to distinguish repeated paragraphs", () => {
    const location = setPage(
      "https://zhuanlan.zhihu.com/p/77",
      `<article><div itemprop="articleBody"><p>开头。</p><p>重复段落。</p><p>中间上下文。</p><p>重复段落。</p><p>结尾。</p></div></article>`,
    );
    const adapter = new ZhihuPageAdapter(document, location);
    const snapshot = adapter.extractSnapshot();
    const anchor = adapter.createAnchor(snapshot, 3);
    const resolution = adapter.locateAnchor(snapshot, anchor);
    expect(resolution.status).toBe("located");
    if (resolution.status === "located") expect(resolution.index).toBe(3);
  });

  it("does not claim a deleted paragraph was located", () => {
    const location = setPage(
      "https://zhuanlan.zhihu.com/p/77",
      `<article><div itemprop="articleBody"><p>保留。</p><p>将被删除。</p><p>结尾。</p></div></article>`,
    );
    const adapter = new ZhihuPageAdapter(document, location);
    const before = adapter.extractSnapshot();
    const anchor = adapter.createAnchor(before, 1);
    before.paragraphs[1].element.remove();
    const after = adapter.extractSnapshot();
    expect(adapter.locateAnchor(after, anchor).status).toBe("missing");
  });

  it("treats a natural ellipsis as ordinary text", () => {
    const location = setPage(
      "https://zhuanlan.zhihu.com/p/78",
      `<article><div itemprop="articleBody"><p>他说……这仍然是同一个完整段落。</p><p>另一个段落。</p></div></article>`,
    );
    const adapter = new ZhihuPageAdapter(document, location);
    const snapshot = adapter.extractSnapshot();
    const anchor = adapter.createAnchor(snapshot, 0);
    snapshot.paragraphs[0].element.textContent = "他说……内容已经被修改。";

    expect(adapter.locateAnchor(adapter.extractSnapshot(), anchor).status).toBe("missing");
  });

  it("locates an abbreviated long paragraph that contains natural ellipses", () => {
    const longText = `${"开头…".repeat(70)}中部内容${"…结尾".repeat(70)}`;
    const location = setPage(
      "https://zhuanlan.zhihu.com/p/79",
      `<article><div itemprop="articleBody"><p>前文。</p><p>${longText}</p><p>后文。</p></div></article>`,
    );
    const adapter = new ZhihuPageAdapter(document, location);
    const snapshot = adapter.extractSnapshot();
    const anchor = adapter.createAnchor(snapshot, 1);

    expect(anchor.quote.length).toBe(353);
    expect(adapter.locateAnchor(snapshot, anchor)).toMatchObject({ status: "located", index: 1 });
  });

  it("does not locate a short saved paragraph as a substring of edited content", () => {
    const location = setPage(
      "https://zhuanlan.zhihu.com/p/80",
      `<article><div itemprop="articleBody"><p>完整原段落。</p><p>后文。</p></div></article>`,
    );
    const adapter = new ZhihuPageAdapter(document, location);
    const snapshot = adapter.extractSnapshot();
    const anchor = adapter.createAnchor(snapshot, 0);
    snapshot.paragraphs[0].element.textContent = "编辑后添加前缀，完整原段落。";

    expect(adapter.locateAnchor(adapter.extractSnapshot(), anchor).status).toBe("missing");
  });

  it("does not split emoji when abbreviating a long paragraph anchor", () => {
    const longText = `${"😀".repeat(176)}${"中".repeat(20)}${"🚀".repeat(176)}`;
    const location = setPage(
      "https://zhuanlan.zhihu.com/p/81",
      `<article><div itemprop="articleBody"><p>${longText}</p><p>后文。</p></div></article>`,
    );
    const adapter = new ZhihuPageAdapter(document, location);
    const snapshot = adapter.extractSnapshot();
    const anchor = adapter.createAnchor(snapshot, 0);

    expect(Array.from(anchor.quote)).toHaveLength(353);
    expect(anchor.quote).not.toContain("�");
    expect(adapter.locateAnchor(snapshot, anchor)).toMatchObject({ status: "located", index: 0 });
  });
});
