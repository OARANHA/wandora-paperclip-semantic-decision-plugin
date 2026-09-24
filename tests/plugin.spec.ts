import { describe, expect, it, vi } from "vitest";
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import type { Agent, Issue } from "@paperclipai/shared";
import manifest from "../src/manifest.js";
import plugin, { buildQuestions, type SemanticDecisionAnalysis } from "../src/worker.js";

const COMPANY_ID = "00000000-0000-4000-8000-000000000001";
const ISSUE_ID = "00000000-0000-4000-8000-000000000002";
const COMMERCIAL_AGENT_ID = "00000000-0000-4000-8000-000000000003";
const FINANCE_AGENT_ID = "00000000-0000-4000-8000-000000000004";
const SECRET_ID = "00000000-0000-4000-8000-000000000005";

function testIssue(overrides: Partial<Issue> = {}): Issue {
  const now = new Date();
  return {
    id: ISSUE_ID,
    companyId: COMPANY_ID,
    projectId: null,
    projectWorkspaceId: null,
    goalId: null,
    parentId: null,
    title: "Cliente pergunta preço e cores da tinta X",
    description: "Quero o preço da tinta X e quais cores disponíveis ou fazem também cores sob demanda?",
    status: "todo",
    workMode: "standard",
    priority: "medium",
    reviewPolicy: null,
    assigneeAgentId: null,
    assigneeUserId: null,
    checkoutRunId: null,
    executionRunId: null,
    executionAgentNameKey: null,
    executionLockedAt: null,
    createdByAgentId: null,
    createdByUserId: null,
    responsibleUserId: null,
    issueNumber: 1,
    identifier: "PRO-1",
    requestDepth: 0,
    billingCode: null,
    assigneeAdapterOverrides: null,
    executionWorkspaceId: null,
    executionWorkspacePreference: null,
    executionWorkspaceSettings: null,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    hiddenAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as unknown as Issue;
}

function testAgent(id: string, name: string, role: string, capabilities: string): Agent {
  const now = new Date();
  return {
    id,
    companyId: COMPANY_ID,
    name,
    urlKey: name.toLowerCase().replace(/\s+/g, "-"),
    role,
    title: name,
    icon: null,
    status: "idle",
    reportsTo: null,
    capabilities,
    adapterType: "codex_local",
    adapterConfig: {},
    runtimeConfig: {},
    budgetMonthlyCents: 0,
    spentMonthlyCents: 0,
    pauseReason: null,
    pausedAt: null,
    permissions: { canCreateAgents: false },
    lastHeartbeatAt: null,
    metadata: null,
    createdAt: now,
    updatedAt: now,
  } as unknown as Agent;
}

function jevResponse(): Response {
  return new Response(JSON.stringify({
    model: "jev-test",
    answers: {
      recommended_owner: {
        type: "choice",
        choice: "agent_1",
        confidence: 0.92,
        probabilities: { agent_1: 0.92, agent_2: 0.05, unassigned: 0.03 },
      },
      execution_mode: {
        type: "choice",
        choice: "deterministic_tooling",
        confidence: 0.88,
        probabilities: {
          deterministic_tooling: 0.88,
          generative_reasoning: 0.07,
          human_review: 0.02,
          unknown: 0.03,
        },
      },
      needs_more_context: { type: "noul", noul: 0.22 },
      needs_human_review: { type: "noul", noul: 0.08 },
      needs_data_or_tool_lookup: { type: "noul", noul: 0.97 },
    },
    usage: { input_tokens: 180, output_tokens: 40 },
  }), { status: 200, headers: { "content-type": "application/json" } });
}

describe("Wandora Semantic Decision plugin", () => {
  it("declares an advisory-only Paperclip capability surface", () => {
    expect(manifest.capabilities).toEqual(expect.arrayContaining([
      "issues.read",
      "agents.read",
      "plugin.state.read",
      "plugin.state.write",
      "http.outbound",
      "secrets.read-ref",
      "activity.log.write",
      "ui.action.register",
      "ui.detailTab.register",
    ]));
    expect(manifest.capabilities).not.toContain("issues.update");
    expect(manifest.capabilities).not.toContain("events.subscribe");
    expect(manifest.capabilities).not.toContain("agent.tools.register");
    expect(manifest.tools ?? []).toHaveLength(0);
  });

  it("builds atomic questions and preserves an explicit unassigned option", () => {
    const questions = buildQuestions([
      {
        key: "agent_1",
        id: COMMERCIAL_AGENT_ID,
        name: "Vendedor A",
        role: "commercial",
        title: "Vendedor",
        capabilities: "produtos, preços, estoque e propostas",
        status: "idle",
      },
    ]);

    expect(questions.recommended_owner.type).toBe("choice");
    if (questions.recommended_owner.type === "choice") {
      expect(questions.recommended_owner.criteria).toHaveProperty("agent_1");
      expect(questions.recommended_owner.criteria).toHaveProperty("unassigned");
    }
    expect(questions.execution_mode.type).toBe("choice");
    expect(questions.needs_more_context.type).toBe("noul");
    expect(questions.needs_human_review.type).toBe("noul");
    expect(questions.needs_data_or_tool_lookup.type).toBe("noul");
  });

  it("fails closed before any provider call when no secret is configured", async () => {
    const harness = createTestHarness({ manifest, config: { model: "jev-latest" } });
    harness.seed({
      issues: [testIssue()],
      agents: [testAgent(COMMERCIAL_AGENT_ID, "Vendedor A", "commercial", "produtos e preços")],
    });
    await plugin.definition.setup(harness.ctx);
    const fetchSpy = vi.spyOn(harness.ctx.http, "fetch");

    await expect(harness.performAction("analyze-work", {
      companyId: COMPANY_ID,
      issueId: ISSUE_ID,
    })).rejects.toThrow("Configure a company-scoped TypeSafe API key");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends only the minimized issue snapshot and eligible agent descriptors", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        apiKeyRef: { type: "secret_ref", secretId: SECRET_ID },
        model: "jev-latest",
      },
    });
    const issue = testIssue();
    harness.seed({
      issues: [issue],
      agents: [
        testAgent(COMMERCIAL_AGENT_ID, "Vendedor A", "commercial", "produtos, preços e estoque"),
        testAgent(FINANCE_AGENT_ID, "Financeiro A", "finance", "pagamentos, PIX e cobrança"),
      ],
    });
    await plugin.definition.setup(harness.ctx);
    vi.spyOn(harness.ctx.secrets, "resolve").mockResolvedValue("test-api-key");
    const fetchSpy = vi.spyOn(harness.ctx.http, "fetch").mockImplementation(async (url, init) => {
      expect(String(url)).toBe("https://api.typesafe.ai/v1/systemone");
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(body).not.toHaveProperty("comments");
      expect(body).not.toHaveProperty("attachments");
      expect(body).not.toHaveProperty("logs");
      expect(body.state).toEqual({
        issue: {
          title: issue.title,
          description: issue.description,
          status: issue.status,
          priority: issue.priority,
        },
      });
      const serialized = JSON.stringify(body);
      expect(serialized).toContain("Vendedor A");
      expect(serialized).toContain("Financeiro A");
      return jevResponse();
    });

    const before = await harness.ctx.issues.get(ISSUE_ID, COMPANY_ID);
    const result = await harness.performAction<SemanticDecisionAnalysis>("analyze-work", {
      companyId: COMPANY_ID,
      issueId: ISSUE_ID,
    });
    const after = await harness.ctx.issues.get(ISSUE_ID, COMPANY_ID);

    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(result.advisoryOnly).toBe(true);
    expect(result.owner).toMatchObject({ agentId: COMMERCIAL_AGENT_ID, name: "Vendedor A", confidence: 0.92 });
    expect(result.executionMode).toMatchObject({ value: "deterministic_tooling", confidence: 0.88 });
    expect(result.needsDataOrToolLookup).toBe(0.97);
    expect(result.needsHumanReview).toBe(0.08);
    expect(after).toEqual(before);
    expect(harness.getState({
      scopeKind: "issue",
      scopeId: ISSUE_ID,
      namespace: "wandora-semantic-decision",
      stateKey: "latest-analysis",
    })).toMatchObject({
      issueId: ISSUE_ID,
      advisoryOnly: true,
      executionMode: { value: "deterministic_tooling" },
    });
  });
});
