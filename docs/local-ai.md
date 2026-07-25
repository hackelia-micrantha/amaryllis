# Local AI and MediaPipe

Amaryllis is designed around local-first inference.

The base runtime executes multimodal inference on device and exposes the result through React Native APIs rather than routing all inference through a hosted service.

This document explains what “local AI” means in the context of Amaryllis and how MediaPipe fits into the architecture.

---

## Local-First Inference

In Amaryllis:

- model files live on the device
- prompts can remain on the device
- image inputs can remain on the device
- streaming inference happens locally
- network access is optional and application-controlled

The runtime itself does not require cloud inference.

This changes several architectural properties:

| Property | Local-first impact |
| --- | --- |
| Latency | Lower and more predictable |
| Offline support | Possible |
| Privacy | Stronger by default |
| Cost model | Shifted from API usage to device/storage constraints |
| Determinism | More controllable |
| Device pressure | Higher CPU/GPU/RAM responsibility |

---

## MediaPipe’s Role

On Android, Amaryllis currently integrates with MediaPipe GenAI task APIs.

Conceptually:

```text
React Native
  -> TurboModule bridge
  -> native runtime
  -> MediaPipe task runtime
  -> local model assets
```

MediaPipe provides:

- multimodal inference primitives
- session management
- local image handling
- token streaming support
- model execution abstractions

Amaryllis builds the React Native-facing runtime layer on top of those primitives.

---

## Multimodal Sessions

The runtime distinguishes between:

- text-only inference
- multimodal session-based inference

Image-aware workflows require a session because the runtime needs to:

- preprocess images
- bind image context to the request
- manage multimodal query state

This separation becomes important later for AI-enabled components because not all component interactions need full multimodal state.

---

## Image Processing Constraints

The runtime intentionally constrains image handling.

The current implementation already includes:

- file-path validation
- URI restrictions
- image resizing
- memory pressure handling
- file-size limits

These constraints are not accidental.

Local multimodal systems can fail badly under:

- oversized inputs
- unbounded memory growth
- unrestricted file access
- malformed URIs
- excessive concurrent inference

The runtime therefore treats local media processing as a governed subsystem, not just a convenience utility.

---

## Why Local AI Matters For Components

The companion `@micrantha/amaryllis-components` workspace changes the role of inference.

AI is no longer only a conversational endpoint.

Instead, local AI becomes a capability provider for:

- personalization
- adaptive layouts
- slot generation
- local summarization
- multimodal interactions
- bounded variant selection

That capability is strongest when inference remains close to the UI runtime.

---

## Important Boundary

This branch intentionally separates:

### Local inference capability

from

### UI authority

The model may assist with:

- choosing variants
- producing structured data
- filling declared slots
- generating bounded overlays

But the authoritative component contract still lives in:

- the `ComponentSpec`
- validation rules
- policy enforcement
- the registry/runtime layer

This is a major architectural distinction from many current “AI UI” systems.

---

## What Amaryllis Is Not Trying To Be

The current direction is not:

- unrestricted runtime JSX generation
- arbitrary code execution from model output
- a cloud-only AI wrapper
- a generic hosted assistant framework

The system instead leans toward:

- local-first AI capabilities
- typed runtime contracts
- governed personalization
- bounded outputs
- declarative AI-enabled components

---

## Future Runtime Directions

The architecture intentionally leaves room for additional runtimes later.

Potential future providers include:

- MediaPipe
- TensorFlow Lite
- ONNX Runtime
- CoreML
- local llama.cpp runtimes
- Ollama-backed bridges
- hybrid cloud inference

The long-term abstraction is:

```text
AI capability provider
```

not:

```text
single hosted LLM backend
```
