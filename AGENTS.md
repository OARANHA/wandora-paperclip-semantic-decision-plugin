# AGENTS.md — Wandora Paperclip Semantic Decision Plugin

This repository is a provider-side implementation used by the Wandora project.

## Canonical authority

Before material technical work, read the current Wandora authority in this order:

1. `OARANHA/wandora/docs/WANDORA_PROJECT_SOURCE.md` as continuity bootstrap;
2. `OARANHA/wandora/AGENTS.md`;
3. relevant ADRs, especially ADR 0036, ADR 0152 and ADR 0168;
4. `docs/CAPABILITY_AUTHORITY.md`;
5. `docs/architecture.md`;
6. `docs/CANONICAL_STATE.md`.

The Wandora repository is authoritative over this repository on product semantics and capability ownership.

## Permanent boundary

This plugin is **not** a Wandora product-domain authority.

- Wandora owns customer-facing product semantics, authorization, grounding and final external-effect policy.
- Paperclip owns operational control-plane capability where already qualified.
- This plugin provides bounded semantic judgments inside Paperclip.
- TypeSafe/Jev is the current provider implementation, not a permanent product identity.
- Mastra remains the runtime provider for agent/workflow/tool execution.
- Connections/Tool Gateway remain the Paperclip authority for governed organizational tools.

Portability = contract decoupling, not implementation duplication.

## Change discipline

Follow:

`REAL NOW -> PROVEN EVIDENCE -> GAPS -> CAPABILITY AUTHORITY / REUSE GATE -> DECISION -> SECOND ADVERSARIAL REVIEW -> EXECUTION -> VALIDATION -> DOCUMENTATION`

Never add a new lifecycle engine, task engine, tool-permission engine, generic skill catalog, connector registry or durable state subsystem when Paperclip already owns the capability.

## Safety

Until a newer accepted Wandora ADR authorizes otherwise:

- no production installation;
- no real TypeSafe provider call;
- no automatic Paperclip issue mutation;
- no external effect;
- no browser automation;
- no secret value in source, logs, fixtures or Git history.

CI and tests must use mocks/fakes for provider behavior.
