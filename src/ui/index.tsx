import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useHostContext, usePluginAction, usePluginData } from "@paperclipai/plugin-sdk/ui";
import { ACTIONS, DATA_KEYS } from "../constants.js";
import type { ProbabilityEntry, SemanticDecisionAnalysis } from "../worker.js";

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

const UPDATED_EVENT = "wandora:semantic-decision-updated";

const buttonStyle: CSSProperties = {
  appearance: "none",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  background: "var(--background)",
  color: "inherit",
  padding: "6px 10px",
  fontSize: "12px",
  fontWeight: 600,
  cursor: "pointer",
};

const mutedStyle: CSSProperties = {
  margin: 0,
  fontSize: "12px",
  lineHeight: 1.5,
  opacity: 0.72,
};

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function modeLabel(value: SemanticDecisionAnalysis["executionMode"]["value"]): string {
  if (value === "deterministic_tooling") return "Deterministic tooling / lookup";
  if (value === "generative_reasoning") return "Generative reasoning";
  if (value === "human_review") return "Human review";
  return "Unknown";
}

function ProbabilityList({ entries }: { entries: ProbabilityEntry[] }) {
  return (
    <div style={{ display: "grid", gap: "5px", marginTop: "8px" }}>
      {entries.slice(0, 4).map((entry) => (
        <div key={entry.value} style={{ display: "flex", justifyContent: "space-between", gap: "12px", fontSize: "11px" }}>
          <span>{entry.label}</span>
          <span style={{ fontVariantNumeric: "tabular-nums", opacity: 0.75 }}>{formatPercent(entry.probability)}</span>
        </div>
      ))}
    </div>
  );
}

function AnalysisResult({ analysis }: { analysis: SemanticDecisionAnalysis }) {
  return (
    <div style={{ display: "grid", gap: "10px" }}>
      <div><strong>Suggested owner:</strong> {analysis.owner.name} ({formatPercent(analysis.owner.confidence)})</div>
      <div><strong>Execution mode:</strong> {modeLabel(analysis.executionMode.value)} ({formatPercent(analysis.executionMode.confidence)})</div>
      <div><strong>Needs data/tool lookup:</strong> {formatPercent(analysis.needsDataOrToolLookup)}</div>
      <div><strong>Needs more context:</strong> {formatPercent(analysis.needsMoreContext)}</div>
      <div><strong>Needs human review:</strong> {formatPercent(analysis.needsHumanReview)}</div>
      <details>
        <summary style={{ cursor: "pointer", fontSize: "12px", fontWeight: 600 }}>Owner probabilities</summary>
        <ProbabilityList entries={analysis.owner.probabilities} />
      </details>
      <details>
        <summary style={{ cursor: "pointer", fontSize: "12px", fontWeight: 600 }}>Execution-mode probabilities</summary>
        <ProbabilityList entries={analysis.executionMode.probabilities} />
      </details>
      <p style={mutedStyle}>
        Advisory only. No owner, priority, status, tool permission, lifecycle or external effect was changed.
      </p>
      <p style={mutedStyle}>Model: {analysis.model} · Input tokens: {analysis.usage.inputTokens}</p>
    </div>
  );
}

export function SemanticDecisionAnalyzeButton() {
  const context = useHostContext();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<SemanticDecisionAnalysis | null>(null);
  const analyze = usePluginAction(ACTIONS.analyzeWork);
  const params = useMemo(() => ({
    companyId: context.companyId ?? "",
    issueId: context.entityId ?? "",
  }), [context.companyId, context.entityId]);
  const issueContext = usePluginData<IssueContextData>(DATA_KEYS.issueContext, params);

  if (context.entityType !== "issue" || !context.companyId || !context.entityId) return null;

  async function runAnalysis() {
    setRunning(true);
    setError(null);
    try {
      const result = await analyze(params) as SemanticDecisionAnalysis;
      setAnalysis(result);
      window.dispatchEvent(new CustomEvent(UPDATED_EVENT, { detail: { issueId: context.entityId } }));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Semantic decision analysis failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div style={{ display: "inline-grid", gap: "6px" }}>
      <button
        type="button"
        style={buttonStyle}
        disabled={running || issueContext.loading || !issueContext.data?.configured}
        onClick={() => void runAnalysis()}
      >
        {running ? "Analyzing..." : "Analyze work"}
      </button>
      {!issueContext.loading && issueContext.data && !issueContext.data.configured ? (
        <span style={mutedStyle}>Configure a company-scoped TypeSafe API key first.</span>
      ) : null}
      {error ? <span role="alert" style={{ fontSize: "12px" }}>{error}</span> : null}
      {analysis ? <AnalysisResult analysis={analysis} /> : null}
    </div>
  );
}

export function SemanticDecisionAnalysisCard() {
  const context = useHostContext();
  const params = useMemo(() => ({ issueId: context.entityId ?? "" }), [context.entityId]);
  const latest = usePluginData<SemanticDecisionAnalysis | null>(DATA_KEYS.latestAnalysis, params);

  useEffect(() => {
    const handleUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ issueId?: string }>).detail;
      if (detail?.issueId === context.entityId) void latest.refresh();
    };
    window.addEventListener(UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(UPDATED_EVENT, handleUpdate);
  }, [context.entityId, latest.refresh]);

  if (context.entityType !== "issue" || !context.entityId) return null;
  if (latest.loading) return <div style={mutedStyle}>Loading semantic decision...</div>;
  if (latest.error) return <div style={mutedStyle}>Could not load the latest semantic decision.</div>;
  if (!latest.data) return <div style={mutedStyle}>No semantic decision analysis yet.</div>;

  return <AnalysisResult analysis={latest.data} />;
}
