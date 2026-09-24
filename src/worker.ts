import {
  definePlugin,
  runWorker,
  type EnvSecretRefBinding,
  type PluginContext,
} from "@paperclipai/plugin-sdk";
import {
  APIConnectionError,
  APITimeoutError,
  AuthenticationError,
  PermissionDeniedError,
  RateLimitError,
  TypeSafeClient,
  choice,
  noul,
  type ChoiceResponse,
  type Questions,
} from "@typesafe-ai/sdk";
import {
  ACTIONS,
  DATA_KEYS,
  DEFAULT_MODEL,
  MAX_AGENT_CANDIDATES,
  MAX_CAPABILITIES_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  STATE_KEY,
  STATE_NAMESPACE,
  TYPESAFE_API_BASE_URL,
  TYPESAFE_MAX_RETRIES,
  TYPESAFE_REQUEST_TIMEOUT_MS,
} from "./constants.js";

type PluginConfig = {
  apiKeyRef?: EnvSecretRefBinding;
  model: string;
};

type AgentCandidate = {
  key: string;
  id: string;
  name: string;
  role: string;
  title: string | null;
  capabilities: string | null;
  status: string;
};

export type ProbabilityEntry = {
  value: string;
  label: string;
  probability: number;
};

export type SemanticDecisionAnalysis = {
  analyzedAt: string;
  issueId: string;
  model: string;
  owner: {
    agentId: string | null;
    name: string;
    confidence: number;
    probabilities: ProbabilityEntry[];
  };
  executionMode: {
    value: "deterministic_tooling" | "generative_reasoning" | "human_review" | "unknown";
    confidence: number;
    probabilities: ProbabilityEntry[];
  };
  needsMoreContext: number;
  needsHumanReview: number;
  needsDataOrToolLookup: number;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  disclosure: {
    fields: string[];
    commentsIncluded: false;
    attachmentsIncluded: false;
    logsIncluded: false;
    descriptionTruncated: boolean;
    agentCount: number;
  };
  advisoryOnly: true;
};

type IssueContextData = {
  issueId: string;
  title: string;
  status: string;
  priority: string;
  descriptionLength: number;
  configured: boolean;
  model: string;
  disclosure: SemanticDecisionAnalysis["disclosure"];
};

const EXECUTION_MODE_LABELS: Record<string, string> = {
  deterministic_tooling: "Deterministic tooling / lookup",
  generative_reasoning: "Generative reasoning",
  human_review: "Human review",
  unknown: "Unknown / insufficient evidence",
};

function requiredString(params: Record<string, unknown>, key: string): string {
  const value = params[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${key} is required`);
  }
  return value;
}

function isSecretRef(value: unknown): value is EnvSecretRefBinding {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<EnvSecretRefBinding>;
  return candidate.type === "secret_ref" && typeof candidate.secretId === "string" && candidate.secretId.length > 0;
}

function truncate(value: string | null | undefined, length: number): string {
  if (!value) return "";
  return value.length > length ? value.slice(0, length) : value;
}

function isEligibleAgent(status: string): boolean {
  return status === "active" || status === "idle" || status === "running";
}

async function getConfig(ctx: PluginContext, companyId: string): Promise<PluginConfig> {
  const raw = await ctx.config.get(companyId);
  return {
    apiKeyRef: isSecretRef(raw.apiKeyRef) ? raw.apiKeyRef : undefined,
    model: typeof raw.model === "string" && raw.model.trim().length > 0 ? raw.model.trim() : DEFAULT_MODEL,
  };
}

async function getAgentCandidates(ctx: PluginContext, companyId: string): Promise<AgentCandidate[]> {
  const agents = await ctx.agents.list({ companyId, limit: 255 });
  return agents
    .filter((agent) => isEligibleAgent(agent.status))
    .slice(0, MAX_AGENT_CANDIDATES)
    .map((agent, index) => ({
      key: `agent_${index + 1}`,
      id: agent.id,
      name: agent.name,
      role: agent.role,
      title: agent.title,
      capabilities: agent.capabilities,
      status: agent.status,
    }));
}

function disclosureFor(description: string | null, agentCount: number): SemanticDecisionAnalysis["disclosure"] {
  return {
    fields: [
      "issue.title",
      "issue.description",
      "issue.status",
      "issue.priority",
      "candidateAgents.name",
      "candidateAgents.role",
      "candidateAgents.title",
      "candidateAgents.capabilities",
      "candidateAgents.status",
    ],
    commentsIncluded: false,
    attachmentsIncluded: false,
    logsIncluded: false,
    descriptionTruncated: Boolean(description && description.length > MAX_DESCRIPTION_LENGTH),
    agentCount,
  };
}

export function buildQuestions(candidates: AgentCandidate[]): Questions {
  const ownerCriteria: Record<string, string> = Object.fromEntries(
    candidates.map((candidate) => [
      candidate.key,
      [
        `Name: ${candidate.name}`,
        `Role: ${candidate.role}`,
        candidate.title ? `Title: ${candidate.title}` : null,
        candidate.capabilities ? `Capabilities: ${truncate(candidate.capabilities, MAX_CAPABILITIES_LENGTH)}` : null,
        `Status: ${candidate.status}`,
      ].filter(Boolean).join(". "),
    ]),
  );
  ownerCriteria.unassigned = "No listed digital employee is a clear fit. Leave the work unassigned for review.";

  return {
    recommended_owner: choice(
      "Which available digital employee is the best owner for this work? Select unassigned when no listed employee is a clear fit.",
      ownerCriteria,
    ),
    execution_mode: choice(
      "What is the narrowest safe execution mode for this work based only on the supplied request?",
      {
        deterministic_tooling: "The request is likely solvable by deterministic code, a known data lookup, an authorized tool/API call, or a fixed response template without open-ended generative reasoning.",
        generative_reasoning: "The request requires open-ended reasoning, synthesis, explanation, planning, or natural-language generation beyond a fixed template.",
        human_review: "The request should be reviewed by a human before proceeding because consequences, sensitivity, ambiguity, or authority exceed a bounded automated decision.",
        unknown: "The supplied information is insufficient to select an execution mode safely.",
      },
    ),
    needs_more_context: noul(
      "Does this work lack information that a competent owner would need before starting useful work?",
    ),
    needs_human_review: noul(
      "Should a human review this work before any consequential action is taken?",
    ),
    needs_data_or_tool_lookup: noul(
      "Does answering this request require retrieving company data or using an authorized tool or API?",
    ),
  };
}

function probabilityEntries(response: ChoiceResponse, labels: Record<string, string>): ProbabilityEntry[] {
  return Object.entries(response.probabilities)
    .map(([value, probability]) => ({ value, label: labels[value] ?? value, probability }))
    .sort((left, right) => right.probability - left.probability);
}

function safeProviderError(error: unknown): Error {
  if (error instanceof AuthenticationError || error instanceof PermissionDeniedError) {
    return new Error("TypeSafe rejected the configured API key. Update the company-scoped plugin secret and try again.");
  }
  if (error instanceof RateLimitError) {
    return new Error("TypeSafe rate limit reached. Try again later.");
  }
  if (error instanceof APITimeoutError) {
    return new Error("TypeSafe did not respond before the request timeout.");
  }
  if (error instanceof APIConnectionError) {
    return new Error("Could not connect to the TypeSafe API.");
  }
  return new Error("Semantic decision analysis failed. No Paperclip issue fields were changed.");
}

async function getIssueContext(ctx: PluginContext, companyId: string, issueId: string): Promise<IssueContextData> {
  const [issue, config, candidates] = await Promise.all([
    ctx.issues.get(issueId, companyId),
    getConfig(ctx, companyId),
    getAgentCandidates(ctx, companyId),
  ]);
  if (!issue) throw new Error("Issue not found in the active company");

  return {
    issueId: issue.id,
    title: issue.title,
    status: issue.status,
    priority: issue.priority,
    descriptionLength: issue.description?.length ?? 0,
    configured: Boolean(config.apiKeyRef),
    model: config.model,
    disclosure: disclosureFor(issue.description, candidates.length),
  };
}

async function analyzeWork(
  ctx: PluginContext,
  companyId: string,
  issueId: string,
): Promise<SemanticDecisionAnalysis> {
  const [issue, config, candidates] = await Promise.all([
    ctx.issues.get(issueId, companyId),
    getConfig(ctx, companyId),
    getAgentCandidates(ctx, companyId),
  ]);
  if (!issue) throw new Error("Issue not found in the active company");
  if (!config.apiKeyRef) {
    throw new Error("Configure a company-scoped TypeSafe API key in the Wandora Semantic Decision plugin settings first.");
  }

  const apiKey = await ctx.secrets.resolve(config.apiKeyRef, { companyId, configPath: "apiKeyRef" });
  const state = {
    issue: {
      title: truncate(issue.title, 500),
      description: truncate(issue.description, MAX_DESCRIPTION_LENGTH),
      status: issue.status,
      priority: issue.priority,
    },
  };

  try {
    const client = new TypeSafeClient({
      apiKey,
      baseURL: TYPESAFE_API_BASE_URL,
      defaultModel: config.model,
      timeout: TYPESAFE_REQUEST_TIMEOUT_MS,
      retry: { maxRetries: TYPESAFE_MAX_RETRIES },
      logLevel: "off",
      fetch: (input, init) => ctx.http.fetch(input, init),
    });
    const response = await client.systemOne({
      state,
      questions: buildQuestions(candidates),
      model: config.model,
    });

    const ownerAnswer = response.answers.recommended_owner;
    const modeAnswer = response.answers.execution_mode;
    const contextAnswer = response.answers.needs_more_context;
    const humanAnswer = response.answers.needs_human_review;
    const lookupAnswer = response.answers.needs_data_or_tool_lookup;

    if (
      ownerAnswer.type !== "choice"
      || modeAnswer.type !== "choice"
      || contextAnswer.type !== "noul"
      || humanAnswer.type !== "noul"
      || lookupAnswer.type !== "noul"
    ) {
      throw new Error("Unexpected Jev response shape");
    }

    const candidateByKey = Object.fromEntries(candidates.map((candidate) => [candidate.key, candidate]));
    const selectedCandidate = candidateByKey[ownerAnswer.choice];
    const ownerLabels = Object.fromEntries(candidates.map((candidate) => [candidate.key, candidate.name]));
    ownerLabels.unassigned = "Unassigned";

    const mode = Object.prototype.hasOwnProperty.call(EXECUTION_MODE_LABELS, modeAnswer.choice)
      ? modeAnswer.choice as SemanticDecisionAnalysis["executionMode"]["value"]
      : "unknown";

    const analysis: SemanticDecisionAnalysis = {
      analyzedAt: new Date().toISOString(),
      issueId: issue.id,
      model: response.model,
      owner: {
        agentId: selectedCandidate?.id ?? null,
        name: selectedCandidate?.name ?? "Unassigned",
        confidence: ownerAnswer.confidence,
        probabilities: probabilityEntries(ownerAnswer, ownerLabels),
      },
      executionMode: {
        value: mode,
        confidence: modeAnswer.confidence,
        probabilities: probabilityEntries(modeAnswer, EXECUTION_MODE_LABELS),
      },
      needsMoreContext: contextAnswer.noul,
      needsHumanReview: humanAnswer.noul,
      needsDataOrToolLookup: lookupAnswer.noul,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      disclosure: disclosureFor(issue.description, candidates.length),
      advisoryOnly: true,
    };

    await ctx.state.set(
      { scopeKind: "issue", scopeId: issue.id, namespace: STATE_NAMESPACE, stateKey: STATE_KEY },
      analysis,
    );
    await ctx.activity.log({
      companyId,
      entityType: "issue",
      entityId: issue.id,
      message: "Wandora semantic decision advisory completed",
      metadata: {
        model: analysis.model,
        inputTokens: analysis.usage.inputTokens,
        agentCount: analysis.disclosure.agentCount,
        owner: analysis.owner.name,
        ownerConfidence: analysis.owner.confidence,
        executionMode: analysis.executionMode.value,
        executionModeConfidence: analysis.executionMode.confidence,
        advisoryOnly: true,
      },
    });

    return analysis;
  } catch (error) {
    ctx.logger.warn("Semantic decision provider request failed", {
      issueId,
      errorType: error instanceof Error ? error.constructor.name : "UnknownError",
    });
    throw safeProviderError(error);
  }
}

const plugin = definePlugin({
  async setup(ctx) {
    ctx.data.register(DATA_KEYS.issueContext, async (params) => {
      const companyId = requiredString(params, "companyId");
      const issueId = requiredString(params, "issueId");
      return await getIssueContext(ctx, companyId, issueId);
    });

    ctx.data.register(DATA_KEYS.latestAnalysis, async (params) => {
      const issueId = requiredString(params, "issueId");
      return await ctx.state.get({
        scopeKind: "issue",
        scopeId: issueId,
        namespace: STATE_NAMESPACE,
        stateKey: STATE_KEY,
      });
    });

    ctx.actions.register(ACTIONS.analyzeWork, async (params) => {
      const companyId = requiredString(params, "companyId");
      const issueId = requiredString(params, "issueId");
      return await analyzeWork(ctx, companyId, issueId);
    });
  },

  async onHealth() {
    return { status: "ok", message: "Wandora Semantic Decision worker is running" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
