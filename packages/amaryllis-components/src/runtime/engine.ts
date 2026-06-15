import Ajv, { type ErrorObject } from 'ajv';

export type PersonalizationData = {
  props?: Record<string, unknown>;
  variant?: string;
  slots?: Record<string, string>;
  designTokens?: Record<string, unknown>;
};

export type PersonalizationContract = Record<string, unknown>;

export interface PersonalizationResult {
  valid: boolean;
  data?: PersonalizationData;
  errors?: string[];
}

export class PersonalizationEngine {
  private ajv: Ajv;

  constructor() {
    this.ajv = new Ajv({ allErrors: true, useDefaults: true });
  }

  validate(
    contract: PersonalizationContract,
    aiOutput: unknown
  ): PersonalizationResult {
    const validate = this.ajv.compile(contract);
    const valid = validate(aiOutput);

    if (!valid) {
      return {
        valid: false,
        errors: validate.errors?.map(
          (err: ErrorObject) =>
            `${err.instancePath || err.schemaPath} ${err.message}`
        ),
      };
    }

    return {
      valid: true,
      data: aiOutput as PersonalizationData,
    };
  }

  /**
   * Applies the validated personalization data to the base props.
   */
  apply(
    baseProps: Record<string, unknown>,
    personalization: PersonalizationData
  ): Record<string, unknown> {
    const result = this.safeMerge({}, baseProps);

    if (personalization.props) {
      this.safeMerge(result, personalization.props);
    }

    if (personalization.variant) {
      result.variant = personalization.variant;
    }

    if (personalization.slots) {
      Object.assign(result, personalization.slots);
    }

    if (personalization.designTokens) {
      result.designTokens = personalization.designTokens;
    }

    return result;
  }

  private safeMerge(
    target: Record<string, unknown>,
    source: Record<string, unknown>
  ): Record<string, unknown> {
    Object.entries(source).forEach(([key, value]) => {
      if (this.isUnsafeObjectKey(key)) {
        return;
      }

      const current = target[key];
      if (this.isRecord(current) && this.isRecord(value)) {
        target[key] = this.safeMerge({ ...current }, value);
        return;
      }

      target[key] = value;
    });

    return target;
  }

  private isUnsafeObjectKey(key: string): boolean {
    return key === '__proto__' || key === 'constructor' || key === 'prototype';
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
