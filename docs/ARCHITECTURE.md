# Architecture — Semantic Decision Plugin bootstrap

Status: **research / bootstrap / no production effect**

## Why this repository exists

Wandora needs a cheap, bounded semantic-decision capability that can prevent unnecessary generative-model work.

Example:

```text
"Quero o preço da tinta X e quais cores existem; fazem cor sob demanda?"
```

A bounded decision layer may identify that the work requires product/price/company-policy lookup and does not require open-ended generative reasoning.

The semantic decision is evidence. It is not authorization to execute a tool or external effect.

## Placement

```text
Wandora
  |
  v
Paperclip
  |-- Semantic Decision Plugin
  |      `-- current provider: TypeSafe / Jev
  |
  |-- Agents / Issues / Skills
  |-- Connections / Tool Gateway
  |      `-- e.g. VendaERP MCP
  |
  `-- external adapter: wandora_mastra
         `-- Mastra
              `-- generative model when needed
```

### Plugin

Use this plugin for additive semantic-decision capability inside Paperclip.

Candidate future signals include:

- recommended owner;
- missing context;
- reasoning needed;
- human review needed;
- bounded capability recommendation.

### Adapter

`wandora_mastra` remains an external Paperclip adapter because it executes assigned work through the Wandora Agent Runtime / Mastra boundary.

This repository must not become an adapter replacement.

### Connector / MCP

VendaERP and similar systems remain Connections / Tool Gateway / MCP integrations.

This plugin may recommend that a capability is relevant, but it does not grant access, inject credentials, invoke unauthorized tools or replace Tool Gateway policy.

## Authority split

| Concern | Authority |
| --- | --- |
| Customer-facing meaning of work and employees | Wandora |
| Official company facts / house rules | Wandora |
| Final external-effect authorization | Wandora |
| Agents, issues, assignment and lifecycle | Paperclip |
| Tool connections, grants and Tool Gateway policy | Paperclip |
| Bounded semantic judgment implementation | this Paperclip plugin |
| Current semantic-decision provider | TypeSafe / Jev |
| Agent/workflow/tool runtime | Mastra via Wandora runtime boundary |
| Open-ended generation / reasoning | replaceable model provider |

## Initial qualification boundary

V1 should be advisory-only.

It may read a minimized Paperclip issue/work snapshot and eligible agents, then return structured probabilities. It must not automatically mutate issue owner, priority or status until PT-BR evaluation and failure semantics are separately qualified.

The first useful evaluation target is work routing / work-mode assessment, because this can measure whether a System One call avoids unnecessary generative-model execution.

## Explicitly deferred

- browser decision automation from upstream;
- automatic owner/priority mutation;
- generic `ask_jev_anything` tool;
- provider-neutral multi-provider abstraction before evidence of a second production provider;
- department engine;
- new Wandora routing database/state machine;
- direct VendaERP execution from this plugin;
- production secret provisioning.

## Replacement boundary

If Jev is replaced, the Wandora product contract must remain stable. Expected changes should be limited to provider client/configuration, benchmark thresholds and legitimately provider-owned operational state.

A provider replacement is not justification for internalizing System One inference into Wandora Core.
