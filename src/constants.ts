export const PLUGIN_ID = "wandora.semantic-decision";
export const PLUGIN_VERSION = "0.1.0";

export const ACTIONS = {
  analyzeWork: "analyze-work",
} as const;

export const DATA_KEYS = {
  issueContext: "issue-context",
  latestAnalysis: "latest-analysis",
} as const;

export const SLOT_IDS = {
  toolbarButton: "wandora-semantic-decision-analyze",
  taskDetailView: "wandora-semantic-decision-card",
} as const;

export const EXPORT_NAMES = {
  toolbarButton: "SemanticDecisionAnalyzeButton",
  taskDetailView: "SemanticDecisionAnalysisCard",
} as const;

export const STATE_NAMESPACE = "wandora-semantic-decision";
export const STATE_KEY = "latest-analysis";
export const DEFAULT_MODEL = "jev-latest";
export const TYPESAFE_API_BASE_URL = "https://api.typesafe.ai";
export const TYPESAFE_REQUEST_TIMEOUT_MS = 30_000;
export const TYPESAFE_MAX_RETRIES = 2;
export const MAX_DESCRIPTION_LENGTH = 4_000;
export const MAX_CAPABILITIES_LENGTH = 1_000;
export const MAX_AGENT_CANDIDATES = 64;
