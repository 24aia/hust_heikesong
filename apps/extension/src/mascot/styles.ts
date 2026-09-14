export const companionStyles = `
:host { all: initial; color-scheme: light; }
* { box-sizing: border-box; letter-spacing: 0; }
button { font: inherit; }
.shell { position: fixed; right: 20px; bottom: 20px; z-index: 2147483000; font: 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #181818; }
.mascot { width: 80px; height: 80px; overflow: hidden; padding: 0; border: 0; border-radius: 8px; background: transparent; cursor: pointer; }
.mascot img { display: block; width: 80px; height: 80px; }
.mascot:focus-visible, button:focus-visible { outline: 3px solid #1677ff; outline-offset: 2px; }
.panel { position: absolute; right: 0; bottom: 92px; width: min(310px, calc(100vw - 24px)); max-height: min(520px, calc(100vh - 124px)); overflow: auto; background: #fff; border: 1px solid #d6d6d6; border-radius: 8px; box-shadow: 0 12px 34px rgba(0,0,0,.2); }
 .panel > header { height: 44px; padding: 0 10px 0 14px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e8e8e8; }
.panel > header strong { font-size: 15px; }
.icon { width: 32px; height: 32px; border: 0; background: transparent; font-size: 24px; line-height: 1; cursor: pointer; }
.body { padding: 14px; }
p { margin: 0 0 12px; }
.quote { padding-left: 10px; border-left: 3px solid #e5aa22; color: #323232; overflow-wrap: anywhere; }
.meta { color: #666; font-size: 12px; }
.notice { padding: 8px 10px; background: #f5f7f9; border-left: 3px solid #1677ff; }
.actions { display: grid; grid-template-columns: 1fr; gap: 8px; }
.actions button, .primary, .collapse, .clear-data { min-height: 36px; padding: 7px 12px; border: 1px solid #b8b8b8; border-radius: 6px; background: #fff; color: #181818; cursor: pointer; }
.actions .primary, .primary { border-color: #1769aa; background: #1769aa; color: #fff; }
button:disabled { opacity: .45; cursor: not-allowed; }
.segments { display: grid; grid-template-columns: 1fr 1fr; margin-bottom: 12px; border: 1px solid #cfcfcf; border-radius: 6px; overflow: hidden; }
.segments button { min-height: 34px; border: 0; border-right: 1px solid #cfcfcf; background: #fff; cursor: pointer; }
.segments button:last-child { border-right: 0; }
.segments button[aria-pressed="true"] { background: #eef5fb; color: #0f568d; font-weight: 600; }
.collapse { width: 100%; border: 0; border-top: 1px solid #e8e8e8; border-radius: 0; color: #666; background: #fafafa; }
.clear-data { width: 100%; border: 0; border-top: 1px solid #e8e8e8; border-radius: 0; color: #9f2d25; background: #fff; }
.collapsed { position: fixed; right: 12px; bottom: 18px; z-index: 2147483000; width: 42px; height: 42px; overflow: hidden; padding: 0; border: 1px solid #c8c8c8; border-radius: 8px; background: #fff; color: #222; box-shadow: 0 4px 14px rgba(0,0,0,.16); cursor: pointer; }
.collapsed img { display: block; width: 100%; height: 100%; }
.checkpoint-title { border: 0; background: transparent; color: #0f568d; font-weight: 700; font-size: 16px; padding: 6px 0; cursor: pointer; }
.checkpoint-title:disabled { opacity: 1; cursor: default; }
.checkpoint-title:disabled span { visibility: hidden; }
.text-button { border: 0; background: transparent; color: #1769aa; padding: 8px; cursor: pointer; }
.explain-entry { display: block; width: 100%; min-height: 36px; margin-top: 8px; padding: 7px 12px; border: 1px solid #b8b8b8; border-radius: 6px; background: #fff; color: #181818; }
.recap-position { position: absolute; right: 0; bottom: 92px; }
.recap-position .lks-recap { max-height: calc(100vh - 124px); }
.explanation blockquote { margin: 0 0 12px; max-height: 110px; overflow: auto; }
.conversation { padding: 10px; margin-bottom: 10px; background: #f5f7f9; border-radius: 6px; }
.conversation--user { background: #eef5fb; }
.conversation p { margin: 5px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; }
.followup { display: block; margin-bottom: 10px; }
.followup textarea { display: block; width: 100%; min-height: 65px; resize: vertical; font: inherit; padding: 8px; border: 1px solid #b8b8b8; border-radius: 6px; }
@media (max-width: 480px) { .shell { right: 12px; bottom: 12px; } .panel { width: calc(100vw - 24px); } }
`;
