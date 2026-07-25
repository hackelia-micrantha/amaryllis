# Rolling Gap Document: Amaryllis Components

This document tracks identified gaps, technical debt, and architectural requirements discovered during the implementation of the Amaryllis Components module.

## Status Summary
- **Phase 1 (Infrastructure):** Complete
- **Phase 2 (Customization):** Complete
- **Phase 3 (Personalization):** Complete

---

## 🏗️ Architecture & Integration

### G1: Inference-to-Component Bridge
- **Description:** There is no automated bridge between the core Amaryllis inference hooks (`useInference`) and the `PersonalizedComponent`.
- **Impact:** Developers must manually wire LLM outputs to the component props.
- **Priority:** High
- **Status:** Complete
- **Note:** Dependency-free AG-UI/CopilotKit-shaped adapter contracts, `useAmaryllisPersonalizationAction`, and `createAmaryllisInferencePersonalizationAction` now bridge base Amaryllis-compatible inference functions to validated personalization props without importing the base runtime into the companion package.

### G2: Component Registry Persistence
- **Description:** The `ComponentRegistry` is purely in-memory.
- **Impact:** Dynamic or lazy-loaded components are difficult to manage; requires re-registration on every app mount.
- **Priority:** Medium
- **Status:** Complete
- **Note:** `ComponentRegistry` now exposes serializable snapshots and hydration through an application-provided component resolver, keeping storage ownership outside the runtime while preserving registry identity validation.

---

## 🎨 Styling & Design Systems

### G3: Design Token Translation
- **Description:** `ReactGenerator` does not yet translate `designTokens` (spacing, colors, typography) from the spec into framework-specific styles (e.g., Tailwind classes or RN style objects).
- **Impact:** Generated components lack consistent design system compliance.
- **Priority:** High
- **Status:** Complete
- **Note:** `ReactGenerator` now exposes declared design token groups as bounded, typed component props and includes them in generated component destructuring without introducing raw style generation.

### G4: Cross-Platform UI Primitives
- **Description:** `PersonalizedComponent.tsx` uses basic shims for `View` and `Text`.
- **Impact:** Potential rendering inconsistencies between Web and React Native.
- **Priority:** Medium
- **Status:** Complete
- **Note:** `PersonalizedComponent` now accepts dependency-injected UI primitives with default web fallbacks, allowing React Native callers to pass platform primitives without adding a direct `react-native` dependency to the companion package.

---

## 🛠️ Tooling & CLI

### G5: Robust Diff Engine
- **Description:** The CLI diff utility uses a naive line-by-line comparison.
- **Impact:** Poor handling of indentation changes or code blocks moving; hard to read for complex customizations.
- **Priority:** Medium
- **Status:** Complete
- **Note:** The CLI diff now uses an order-aware line matcher that handles repeated lines and block insertions more predictably while preserving the existing ANSI output contract.

---

## 🛡️ Security & Governance

### G6: Deep Merge Safety
- **Description:** `PersonalizationEngine.apply` uses shallow object spreading.
- **Impact:** Risk of breaking nested data structures if the AI personalization targets deep paths.
- **Priority:** High
- **Status:** Complete
- **Note:** `PersonalizationEngine.apply` now uses bounded recursive merging for nested props and ignores unsafe object keys such as `__proto__`, `constructor`, and `prototype`.

### G7: Runtime Error Recovery
- **Description:** Validation failures simply revert to base props with a console warning.
- **Impact:** Suboptimal UX; no mechanism for the AI to "self-correct" based on validation errors.
- **Priority:** Medium
- **Status:** Complete
- **Note:** `createAmaryllisPersonalizationAction` now supports opt-in bounded recovery attempts that pass validation errors back through the inference callback and still require recovered output to pass schema validation before rendering.
