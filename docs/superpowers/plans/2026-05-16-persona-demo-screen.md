# Persona Demo Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second example-app screen that showcases Amaryllis personalized components through a persona switcher.

**Architecture:** Keep screen selection in the example app’s interface layer, introduce one focused demo screen with local persona data, and register one new personalized demo component through the existing registry path. Reuse the current `PersonalizedComponent` runtime so the demo exercises the real product surface rather than a bespoke mock.

**Tech Stack:** React Native, TypeScript, Jest, `@micrantha/amaryllis-components`

---

## File structure

- Create `example/src/PersonaDemoScreen.tsx`
  - Owns the persona demo layout, persona switcher, and the selected-persona view model.
- Create `example/src/ai/PersonaProfileCard.tsx`
  - Renders the visual card used by the personalized component demo.
- Create `example/src/ai/personaProfileCardSpec.ts`
  - Declares the component contract and variants for validation/personalization.
- Modify `example/src/ai/registerComponents.ts`
  - Registers both the existing context summary card and the new persona profile card.
- Modify `example/src/App.tsx`
  - Adds the light screen switcher between the existing chat experience and the new persona demo.
- Modify `example/src/__tests__/App.e2e.test.tsx`
  - Covers second-screen entry and persona switching behavior.

## Task 1: Register a persona-aware personalized component

**Files:**
- Create: `example/src/ai/personaProfileCardSpec.ts`
- Create: `example/src/ai/PersonaProfileCard.tsx`
- Modify: `example/src/ai/registerComponents.ts`

- [ ] **Step 1: Write the component spec**

```ts
import type { ValidatedComponentSpec } from '@micrantha/amaryllis-components';

export const personaProfileCardSpec: ValidatedComponentSpec = {
  apiVersion: 'amaryllis/v1alpha1',
  kind: 'ComponentSpec',
  metadata: {
    name: 'persona-profile-card',
    version: '1.0.0',
    owner: 'amaryllis-example',
    stability: 'experimental',
  },
  target: {
    framework: 'react',
    runtime: 'rn',
  },
  props: {
    type: 'object',
    properties: {
      eyebrow: { type: 'string' },
      title: { type: 'string' },
      summary: { type: 'string' },
      proofPoints: {
        type: 'array',
        items: { type: 'string' },
      },
    },
    required: ['eyebrow', 'title', 'summary', 'proofPoints'],
  },
  ui: {
    variants: {
      assurance: {},
      momentum: {},
      community: {},
    },
  },
  ai: {
    mode: 'personalize',
    execution: 'device',
    generationContract: {
      output: 'props-json',
    },
  },
};
```

- [ ] **Step 2: Implement the card component**

```tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export interface PersonaProfileCardProps {
  eyebrow: string;
  title: string;
  summary: string;
  proofPoints: string[];
  variant?: string;
}

export const PersonaProfileCard: React.FC<PersonaProfileCardProps> = ({
  eyebrow,
  title,
  summary,
  proofPoints,
  variant,
}) => (
  <View
    style={[
      styles.card,
      variant === 'assurance' && styles.assuranceCard,
      variant === 'momentum' && styles.momentumCard,
      variant === 'community' && styles.communityCard,
    ]}
  >
    <Text style={styles.eyebrow}>{eyebrow}</Text>
    <Text style={styles.title}>{title}</Text>
    <Text style={styles.summary}>{summary}</Text>
    <View style={styles.points}>
      {proofPoints.map((point) => (
        <Text key={point} style={styles.point}>
          • {point}
        </Text>
      ))}
    </View>
  </View>
);
```

- [ ] **Step 3: Extend registry initialization**

```ts
import { PersonaProfileCard } from './PersonaProfileCard';
import { personaProfileCardSpec } from './personaProfileCardSpec';

const personaProfileCardContract = JSON.parse(
  new JSONSchemaGenerator().generate(personaProfileCardSpec)
);

export function registerExampleAiComponents(registry: ComponentRegistry): void {
  if (!registry.get(contextSummaryCardSpec.metadata.name)) {
    registry.register(contextSummaryCardSpec.metadata.name, {
      component: ContextSummaryCard as unknown as ComponentType<
        Record<string, unknown>
      >,
      spec: contextSummaryCardSpec,
      contract,
    });
  }

  if (!registry.get(personaProfileCardSpec.metadata.name)) {
    registry.register(personaProfileCardSpec.metadata.name, {
      component: PersonaProfileCard as unknown as ComponentType<
        Record<string, unknown>
      >,
      spec: personaProfileCardSpec,
      contract: personaProfileCardContract,
    });
  }
}
```

- [ ] **Step 4: Run focused validation**

Run: `yarn typecheck`

Expected: TypeScript completes without new errors.

- [ ] **Step 5: Commit**

```bash
git add example/src/ai/personaProfileCardSpec.ts example/src/ai/PersonaProfileCard.tsx example/src/ai/registerComponents.ts
git commit -m "feat(example): add persona profile card demo component"
```

## Task 2: Build the persona demo screen

**Files:**
- Create: `example/src/PersonaDemoScreen.tsx`

- [ ] **Step 1: Write the persona model and default state**

```tsx
type PersonaId =
  | 'developer'
  | 'security-reviewer'
  | 'hiring-manager'
  | 'open-source-contributor'
  | 'founder-customer';

const personas = [
  {
    id: 'developer',
    label: 'Developer',
    variant: 'momentum',
    eyebrow: 'Developer view',
    title: 'Build adaptive UI without losing structure',
    summary:
      'Amaryllis pairs a stable component contract with controlled personalization, so teams can move quickly without turning the UI layer into guesswork.',
    proofPoints: [
      'Typed component specs',
      'On-device personalization runtime',
      'Reusable registry-backed components',
    ],
  },
  // four more persona records...
] as const;
```

- [ ] **Step 2: Implement the switcher and personalized output**

```tsx
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PersonalizedComponent } from '@micrantha/amaryllis-components';

export const PersonaDemoScreen = () => {
  const [selectedPersonaId, setSelectedPersonaId] =
    useState<PersonaId>('developer');

  const selectedPersona = useMemo(
    () => personas.find((persona) => persona.id === selectedPersonaId)!,
    [selectedPersonaId]
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Personalized Amaryllis</Text>
      <Text style={styles.subheading}>
        One product story, adapted to the viewer without changing the component contract.
      </Text>

      <View style={styles.switcher}>
        {personas.map((persona) => (
          <TouchableOpacity
            key={persona.id}
            accessibilityRole="button"
            accessibilityState={{ selected: persona.id === selectedPersonaId }}
            onPress={() => setSelectedPersonaId(persona.id)}
            style={[
              styles.personaButton,
              persona.id === selectedPersonaId && styles.activePersonaButton,
            ]}
          >
            <Text>{persona.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <PersonalizedComponent
        name="persona-profile-card"
        baseProps={{
          eyebrow: 'Amaryllis',
          title: 'Adaptive components',
          summary: 'Personalized UI with contracts.',
          proofPoints: [],
        }}
        personalizationData={{
          variant: selectedPersona.variant,
          props: {
            eyebrow: selectedPersona.eyebrow,
            title: selectedPersona.title,
            summary: selectedPersona.summary,
            proofPoints: selectedPersona.proofPoints,
          },
        }}
      />
    </ScrollView>
  );
};
```

- [ ] **Step 3: Fill in the remaining persona content**

Use the same shape for:
- `security-reviewer`
- `hiring-manager`
- `open-source-contributor`
- `founder-customer`

Recommended emphasis:
- Security reviewer → validation, contracts, governance
- Hiring manager → systems thinking, product maturity, portfolio signal
- Open-source contributor → contribution path, extensibility, clarity
- Founder/customer → outcome, differentiation, trust

- [ ] **Step 4: Run focused validation**

Run: `yarn typecheck`

Expected: TypeScript completes without new errors.

- [ ] **Step 5: Commit**

```bash
git add example/src/PersonaDemoScreen.tsx
git commit -m "feat(example): add persona demo screen"
```

## Task 3: Add a minimal two-screen switcher to the example app

**Files:**
- Modify: `example/src/App.tsx`

- [ ] **Step 1: Add screen state at the post-model app boundary**

```tsx
import { useMemo, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View } from 'react-native';
import { PersonaDemoScreen } from './PersonaDemoScreen';

type DemoScreen = 'chat' | 'persona-demo';
```

- [ ] **Step 2: Wrap the existing content with a small local switcher**

```tsx
function DemoExperience() {
  const [screen, setScreen] = useState<DemoScreen>('chat');

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1 }}>
        <DemoScreenSwitcher screen={screen} onSelect={setScreen} />
        {screen === 'chat' ? <Chat /> : <PersonaDemoScreen />}
      </View>
    </SafeAreaProvider>
  );
}
```

- [ ] **Step 3: Implement a focused `DemoScreenSwitcher` inside `App.tsx`**

```tsx
function DemoScreenSwitcher({
  screen,
  onSelect,
}: {
  screen: DemoScreen;
  onSelect: (screen: DemoScreen) => void;
}) {
  return (
    <View>
      <Text>Demo</Text>
      <TouchableOpacity onPress={() => onSelect('chat')}>
        <Text>Chat</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => onSelect('persona-demo')}>
        <Text>Personas</Text>
      </TouchableOpacity>
    </View>
  );
}
```

- [ ] **Step 4: Replace the direct `<Chat />` render**

```tsx
<PromptProvider>
  <DemoExperience />
</PromptProvider>
```

- [ ] **Step 5: Run focused validation**

Run: `yarn typecheck`

Expected: TypeScript completes without new errors.

- [ ] **Step 6: Commit**

```bash
git add example/src/App.tsx
git commit -m "feat(example): add demo screen switcher"
```

## Task 4: Extend app-level test coverage

**Files:**
- Modify: `example/src/__tests__/App.e2e.test.tsx`

- [ ] **Step 1: Add a new test for persona navigation and switching**

```tsx
it('should show personalized demo content for the selected persona', async () => {
  const screen = render(<App />);

  fireEvent.press(screen.getByText('Personas'));

  expect(screen.getByText('Personalized Amaryllis')).toBeTruthy();
  expect(screen.getByText('Developer')).toBeTruthy();
  expect(screen.getByText(/Build adaptive UI/)).toBeTruthy();

  fireEvent.press(screen.getByText('Security reviewer'));

  await waitFor(() => {
    expect(screen.getByText(/governance/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the focused example test**

Run: `yarn test example/src/__tests__/App.e2e.test.tsx --runInBand`

Expected: Existing chat-flow test and new persona-switching test both pass.

- [ ] **Step 3: Run broader verification**

Run: `yarn typecheck`

Expected: TypeScript completes without new errors.

- [ ] **Step 4: Commit**

```bash
git add example/src/__tests__/App.e2e.test.tsx
git commit -m "test(example): cover persona demo flow"
```

## Self-review

- Spec coverage:
  - Second screen → Task 3
  - Persona switcher → Task 2
  - Amaryllis as demo subject → Task 2 content model
  - Personalized components → Tasks 1 and 2
  - Clean example-app integration → Tasks 3 and 4
- Placeholder scan:
  - No `TBD`, `TODO`, or undefined follow-up steps remain.
- Type consistency:
  - `PersonaId`, `persona-profile-card`, and the expected props shape are consistent across Tasks 1-4.

