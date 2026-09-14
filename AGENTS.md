# Repository ownership

- Agent A owns `contracts/`, `apps/extension/`, root npm configuration, `scripts/`, and extension-facing documentation.
- Agent B owns `packages/recap-ui/` and `apps/recap-api/`.
- Shared contract changes must remain backward compatible unless both owners explicitly agree.
- Never commit credentials, model output containing user article text, job tokens, or browser storage exports.
- `RecapInput.paragraphs` must stop before the selected checkpoint paragraph.
