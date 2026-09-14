# Recap UI

Agent B owns this React package. It has no `chrome.*` dependency: the extension
injects `ReadingHost`, `RecapClient`, and `CacheStore` when calling
`mountRecapPanel`.

The local Playground uses an original sample article and deterministic mocks:

```powershell
npm install --no-package-lock
npm run dev
npm test
npm run build
```

The package-local TypeScript contract currently mirrors the frozen v1 contract
from `LIUKANSHAN_READING_AGENT_PLAN.md`. Agent A has not yet created the shared
`contracts` workspace. During integration, replace this mirror with type-only
imports from that workspace after the JSON Schemas and golden fixtures agree.
