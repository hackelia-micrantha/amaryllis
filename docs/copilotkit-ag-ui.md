# CopilotKit and AG-UI Alignment

This branch treats CopilotKit and AG-UI as integration surfaces, not as required runtime dependencies.

Amaryllis remains responsible for local inference, component specs, validation, policy, and registry authority. CopilotKit-style applications can consume those capabilities through adapter contracts that look like frontend tools, render tools, or agent UI actions.

---

## Architectural Role

CopilotKit and AG-UI commonly organize application AI around:

- agent actions
- frontend-readable state
- structured tool calls
- generative UI surfaces
- frontend-rendered tool output

Amaryllis maps those ideas onto its own authority model:

```text
ComponentSpec
  -> registry entry
  -> personalization contract
  -> AG-UI/CopilotKit action contract
  -> local Amaryllis inference
  -> structured model output
  -> schema validation
  -> rendered overlay
```

The model never becomes the source of executable UI at runtime.

---

## Adapter Boundary

The companion package exports a dependency-free adapter surface:

```ts
import {
  createAgentUIToolContract,
  createAmaryllisInferenceAdapter,
  useAmaryllisPersonalizationAction,
} from '@micrantha/amaryllis-components';
```

`createAgentUIToolContract` converts a registered component entry into AG-UI-shaped metadata. The metadata describes the action and exposes the validated personalization contract, but it does not register anything with CopilotKit directly.

`useAmaryllisPersonalizationAction` bridges an inference function to a registered component. It invokes local inference, treats output as untrusted data, validates it against the component contract, and returns renderable props only when validation passes.

`createAmaryllisInferenceAdapter` converts a prompt-only base Amaryllis `generate` function into the action `infer` callback shape, so applications do not need to manually strip AG-UI component metadata or base props before calling local inference.

---

## Example

```ts
const infer = createAmaryllisInferenceAdapter(localAmaryllisGenerate);

const action = useAmaryllisPersonalizationAction({
  componentName: 'summary-card',
  baseProps: { title: 'Summary' },
  infer,
});

const result = await action({
  prompt: 'Summarize this local context for the current user.',
  context: { screen: 'quest-log' },
});

if (result.valid) {
  renderSummaryCard(result.props);
}
```

The `infer` function can be backed by the base Amaryllis runtime, a CopilotKit action, or an AG-UI transport. The validation boundary stays in Amaryllis.

---

## Security Rules

AG-UI and CopilotKit adapters must preserve the Amaryllis runtime rules:

- no runtime JSX, TSX, JavaScript, imports, or raw markup from model output
- no client-provided registry mutation
- no model-controlled policy changes
- validate all structured output before rendering
- fall back to base props when validation fails

This keeps CopilotKit/AG-UI useful as orchestration layers while preserving Amaryllis as the local-first capability and governance layer.
