# Upstream provenance

This repository is a maintained Wandora derivative of:

- upstream: `andrewdeng318/paperclip-plugin-jev`
- repository: https://github.com/andrewdeng318/paperclip-plugin-jev
- baseline commit reviewed by Wandora: `2d36269eeca1e915986b8179b13b83dfd7cff5ba`
- upstream package version at that baseline: `0.3.2`
- upstream license: MIT
- Paperclip SDK pin at that baseline: `2026.916.0`
- TypeSafe SDK dependency at that baseline: `^0.6.0`

## Relationship

This repository was created as a normal GitHub repository rather than through GitHub's fork button. It is therefore not represented by GitHub as a fork object, but it must preserve upstream provenance and licensing.

When source is imported from upstream, keep upstream copyright and license notices.

## Sync discipline

Upstream changes are evidence, not automatic authority.

Before incorporating an upstream change:

1. compare it against the currently qualified Wandora Paperclip version;
2. check the canonical authority in `OARANHA/wandora`;
3. identify whether the change alters plugin capabilities, disclosure, provider calls, mutations, lifecycle semantics or tool registration;
4. run a second adversarial review;
5. merge only through a reviewed PR.

Do not silently merge upstream browser automation, automatic mutations, new provider behavior or lifecycle behavior.

## Divergence intent

The Wandora derivative is broader in product intent but narrower in initial execution surface.

The upstream plugin focuses on software issue triage plus constrained browser decisions.

The Wandora derivative intends to qualify bounded semantic decisions for digital-workforce operations such as:

- recommended work owner;
- work-mode / reasoning-need signals;
- missing-context signals;
- human-review signals;
- later, capability/tool/skill recommendation where Paperclip-native authority can be reused safely.

The initial Wandora slice does **not** include browser automation or automatic issue mutation.
