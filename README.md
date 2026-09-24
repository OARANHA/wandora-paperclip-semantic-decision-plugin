# Wandora Paperclip Semantic Decision Plugin

Provider-side Paperclip plugin for fast, typed semantic decisions used by Wandora digital workforces.

## Status

**Bootstrap / research implementation. NO PRODUCTION EFFECT.**

This repository is not a Wandora product-domain authority. It implements a Paperclip-side capability boundary. Canonical Wandora architecture and authority remain in [OARANHA/wandora](https://github.com/OARANHA/wandora).

## Intended topology

```text
Wandora
  -> Paperclip
       -> Semantic Decision Plugin
            -> current provider: TypeSafe / Jev
       -> Agents / Issues / Skills / Connections / Tool Gateway
  -> wandora_mastra
       -> Mastra
       -> generative model only when needed
```

The plugin may provide bounded semantic judgments such as work routing, capability-needs assessment, missing-context signals and other typed decisions. It does not own Wandora product semantics, Paperclip lifecycle, tool execution, or external-effect authorization.

## Upstream

The initial implementation is derived from Andrew Deng's MIT-licensed `paperclip-plugin-jev`.

Upstream repository: https://github.com/andrewdeng318/paperclip-plugin-jev

Exact provenance and divergence rules will be recorded in `UPSTREAM.md`.

## Permanent guardrail

Portability = contract decoupling, not implementation duplication. The current decision provider may be TypeSafe/Jev; the capability must not make Jev a permanent Wandora product identity.
