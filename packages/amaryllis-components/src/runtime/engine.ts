import Ajv, { type ErrorObject } from 'ajv';

export type PersonalizationData = {
  props?: Record<string, unknown>;
  variant?: string;
  slots?: Record<string, string>;
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
    const result = { ...baseProps };

    if (personalization.props) {
      Object.assign(result, personalization.props);
    }

    if (personalization.variant) {
      result.variant = personalization.variant;
    }

    if (personalization.slots) {
      Object.assign(result, personalization.slots);
    }

    return result;
  }
}
