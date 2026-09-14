import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryStore } from "../src/cache/cache";
import { RecapPanel } from "../src/panel/RecapPanel";
import { MockHost, MockRecapClient, type Scenario } from "./mocks";
import "./playground.css";

const cache = new MemoryStore();

function Playground() {
  const [scenario, setScenario] = useState<Scenario>("normal");
  const [event, setEvent] = useState("尚未收到宿主调用");
  const [visible, setVisible] = useState(true);
  const dependencies = useMemo(() => ({
    host: new MockHost(scenario, setEvent),
    client: new MockRecapClient(scenario),
    cache,
    summaryVersion: "recap-v1",
    onClose: () => setVisible(false),
  }), [scenario]);

  return (
    <main className="playground">
      <article className="sample">
        <span className="sample__tag">原创测试长文</span>
        <h1>为什么我们需要一个续读助手？</h1>
        <p>人们很少一次读完一篇长文。消息提醒、临时任务和通勤到站，都会把注意力从文章中拉走。</p>
        <p>再次回来时，困难不只是找到滚动位置。读者还需要想起作者提出了什么问题，论证已经推进到了哪里。</p>
        <p>因此，续读工具要保存两样东西：稳定的文本位置，以及断点之前可核对的思路摘要。</p>
        <p>位置恢复应优先匹配原文与前后文，像素偏移只能作为辅助，因为窗口宽度和图片加载都会改变布局。</p>
        <p className="sample__cutoff">上次停在这里</p>
        <p>摘要中的每个要点都应附带原文引用。读者点击引用后，可以亲自检查上下文，而不是盲目信任模型。</p>
      </article>

      <aside className="controls">
        <label htmlFor="scenario">测试场景</label>
        <select id="scenario" value={scenario} onChange={(event) => {
          setScenario(event.target.value as Scenario);
          setVisible(true);
          setEvent("场景已切换");
        }}>
          <option value="normal">正常流程</option>
          <option value="beginning">文章开头</option>
          <option value="partial">仅取得部分前文</option>
          <option value="stale">引用定位失效</option>
          <option value="timeout">AI 超时</option>
          <option value="invalid">AI 无效引用</option>
          <option value="slow">慢任务/切换测试</option>
        </select>
        <p>{event}</p>
        {!visible && <button onClick={() => setVisible(true)}>重新打开面板</button>}
      </aside>

      {visible && <div className="panel-slot" key={scenario}><RecapPanel {...dependencies} /></div>}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Playground />);
