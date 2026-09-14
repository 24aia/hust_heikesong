import { useEffect, useState } from "react";
import { browserApi } from "../shared/browser-api";

export type MascotMood = "sleep" | "greeting" | "idle" | "ball" | "computer";

export function Mascot({ mood, collapsed = false, open, onClick }: { mood: MascotMood; collapsed?: boolean; open: boolean; onClick(): void }) {
  const [hidden, setHidden] = useState(document.visibilityState === "hidden");
  useEffect(() => {
    const visibility = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, []);
  return <button className={collapsed ? "collapsed" : "mascot"} type="button" aria-label={collapsed ? "展开阅读伙伴" : "打开刘看山阅读伙伴"} aria-expanded={open} onClick={onClick}>
    <img src={browserApi.runtime.getURL(hidden || collapsed ? "assets/mascot.png" : `assets/mascot-${mood}.gif`)} alt="" />
  </button>;
}
