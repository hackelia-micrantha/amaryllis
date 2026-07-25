import React from 'react';
import { type PersonalizationDiagnostics } from './engine';
import { type UiPrimitives } from './primitives';
export interface PersonalizedComponentValidationEvent {
    name: string;
    valid: boolean;
    errors?: string[];
    diagnostics?: PersonalizationDiagnostics;
}
export interface PersonalizedComponentProps {
    /** Name of the registered component to render */
    name: string;
    /** Base props to pass to the component */
    baseProps?: Record<string, unknown>;
    /** Optional structured AI output to apply (props, variants, slots) */
    personalizationData?: unknown;
    /** Loading state if the AI is still generating */
    loading?: boolean;
    /** Custom fallback if component is not found */
    fallback?: React.ReactNode;
    /** Optional UI primitive overrides for React Native or custom renderers */
    primitives?: Partial<UiPrimitives>;
    /** Optional validation callback for telemetry or diagnostics */
    onValidation?: (event: PersonalizedComponentValidationEvent) => void;
    /** Enable console warnings for validation failures. Defaults to false. */
    warnOnValidationFailure?: boolean;
}
/**
 * A wrapper component that handles on-device personalization.
 * It validates AI output against the component's contract before rendering.
 */
export declare const PersonalizedComponent: React.FC<PersonalizedComponentProps>;
