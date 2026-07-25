# AI component examples

> **Experimental:** `@micrantha/amaryllis-components` and the `amaryllis/v1alpha1` contract are not yet stable public APIs.

These examples exercise the provider-free, governed component path included in the repository.

## Start here

- [End-to-end AI component walkthrough](./ai-component-end-to-end.md)
- [Runtime validation flow](./runtime-validation-flow.md)

## Fixtures

- [`summary-card.component.yaml`](./summary-card.component.yaml): valid React Native `ComponentSpec`
- [`summary-card.customization.patch.json`](./summary-card.customization.patch.json): bounded customization patch
- [`summary-card.personalization.valid.json`](./summary-card.personalization.valid.json): valid structured personalization output
- [`summary-card.personalization.invalid.json`](./summary-card.personalization.invalid.json): invalid output used to verify deterministic fallback
- [`summary-card.personalization.schema.json`](./summary-card.personalization.schema.json): readable personalization contract example

## Verify

From the repository root:

```sh
yarn verify:component-examples
```

The verification builds the companion package and exercises schema and policy validation, CLI generation, contract generation, customization, registry identity, valid personalization, invalid personalization, and fail-closed fallback behavior.
