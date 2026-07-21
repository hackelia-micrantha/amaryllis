# Generated Component Provenance

Amaryllis Components records provenance for generated React artifacts, but the meaning of that provenance depends on the generation path.

## Deterministic generator provenance

The built-in `ReactGenerator` is deterministic when callers provide the same validated `ComponentSpec` and the same generation options.

A deterministic generation record should include:

- the component spec version;
- a content-derived spec hash;
- the generator version;
- the validation or policy summary;
- a normalized `generatedAt` value when timestamps are embedded in source.

`generatedAt` is metadata, not an input to component semantics. Callers that require byte-identical source must supply a fixed timestamp or store timestamps outside the generated source artifact.

The default model identifier, `deterministic-generator`, means that the checked-in generator emitted the source directly. It does not imply that an AI model reproduced or verified the artifact.

## AI-assisted generation provenance

When an AI system contributes implementation or customization output, provenance must additionally identify:

- the model and model version or immutable deployment identifier;
- the prompt or instruction-template version;
- the structured generation contract used;
- validation results applied after model output;
- the reviewed diff or approval record.

These fields provide traceability. They do not prove that another model invocation will reproduce identical output. AI-assisted generation is bounded-nondeterministic unless the provider, sampling configuration, model artifact, prompt, and execution environment are all reproducibly pinned.

## Validation boundary

Provenance never substitutes for validation. The required pipeline is:

```text
validated ComponentSpec
  -> policy checks
  -> deterministic or AI-assisted generation
  -> generated-source typecheck and security checks
  -> human review when executable output is produced
  -> publication
```

The React generator treats layout strings as untrusted source inputs. Generated layouts are limited to target-appropriate allowlisted elements and expressions referencing only `children` or declared slots. Imports, event handlers, spread props, executable expressions, raw HTML sinks, and unapproved elements are rejected.

## Current schema-generation contract

- Component and slot names must be safe JavaScript identifiers before generation.
- JSON Schema object property names are emitted as quoted TypeScript keys when necessary.
- Arrays, nested objects, enums, primitives, and defaults are accepted by the schema.
- Defaults currently describe the component contract but do not emit runtime default initialization.
- Generated source for `web`, `nextjs`, and `rn` is typechecked in tests using compiler options compatible with the package TypeScript configuration.
