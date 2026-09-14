# Shared contracts

This directory is the single protocol source shared by the extension, recap UI, and API.

Normalization version is `1`. Text is converted to Unicode NFC, CRLF/CR newlines become LF, non-breaking spaces become ordinary spaces, and surrounding whitespace is trimmed. Semantic punctuation is preserved.

`inputHash` is lowercase SHA-256 of UTF-8 encoded compact JSON for:

```text
[1, contentKey, cutoff.policy, coverage, paragraphs.map(p => [p.id, p.text])]
```

The recap cache key is `recap-cache:<inputHash>:<mode>:<summaryVersion>`. `mode` is deliberately outside the text hash.

New required fields are breaking changes. Agent A owns this contract; Agent B consumes it without defining a parallel DTO.
