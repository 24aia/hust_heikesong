export type RecapMode = "brief" | "bridge";
export type AnchorKind = "automatic" | "manual";
export type Coverage = "prefix-to-cutoff" | "partial-prefix";

export interface Paragraph {
  id: string;
  text: string;
}

export interface TextAnchor {
  quote: string;
  prefix: string;
  suffix: string;
  paragraphIndexHint: number;
  occurrenceIndex: number;
  viewportOffsetPx: number;
}

export interface ReadingCheckpoint {
  schemaVersion: 1;
  contentKey: string;
  sourceUrl: string;
  title: string;
  kind: AnchorKind;
  anchor: TextAnchor;
  savedAt: string;
  sourceFingerprint: string;
}

export interface RecapInput {
  schemaVersion: 1;
  contentKey: string;
  title: string;
  sourceUrl: string;
  inputHash: string;
  mode: RecapMode;
  cutoff: {
    anchorKind: AnchorKind;
    policy: "before-paragraph";
  };
  coverage: Coverage;
  paragraphs: Paragraph[];
}

export interface Evidence {
  paragraphId: string;
  quote: string;
}

export interface RecapResult {
  schemaVersion: 1;
  inputHash: string;
  mode: RecapMode;
  summaryVersion: string;
  items: Array<{ text: string; evidence: Evidence[] }>;
  bridge: { text: string; evidence: Evidence[] } | null;
  warnings: string[];
}

export interface ReadingHost {
  getRecapInput(mode: RecapMode): Promise<RecapInput>;
  locateParagraph(
    contentKey: string,
    inputHash: string,
    paragraphId: string,
  ): Promise<{ status: "located" | "stale" | "missing" }>;
  resumeReading(): Promise<{ status: "located" | "missing" }>;
}

export interface CacheStore {
  get(key: string): Promise<RecapResult | null>;
  set(key: string, result: RecapResult): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface RecapClient {
  generate(
    input: RecapInput,
    options: {
      signal?: AbortSignal;
      onStage?: (stage: "queued" | "running") => void;
    },
  ): Promise<RecapResult>;
}

export interface RecapPanelDependencies {
  host: ReadingHost;
  client: RecapClient;
  cache: CacheStore;
  summaryVersion: string;
  onClose(): void;
}

export interface AppError {
  code:
    | "UNSUPPORTED_PAGE"
    | "CONTENT_NOT_READY"
    | "ANCHOR_NOT_FOUND"
    | "INPUT_TOO_LARGE"
    | "INPUT_INSUFFICIENT"
    | "NETWORK_ERROR"
    | "RATE_LIMITED"
    | "QUOTA_EXCEEDED"
    | "MODEL_OUTPUT_INVALID"
    | "JOB_INTERRUPTED"
    | "CANCELLED";
  message: string;
  requestId?: string;
}
