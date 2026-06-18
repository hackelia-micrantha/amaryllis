import Ajv, { type ErrorObject } from 'ajv';
import * as jsonpatch from 'fast-json-patch';

export type PersonalizationData = {
  props?: Record<string, unknown>;
  variant?: string;
  slots?: Record<string, string>;
  designTokens?: Record<string, unknown>;
  patches?: jsonpatch.Operation[];
};

export type PersonalizationContract = Record<string, unknown>;

export interface PersonalizationResult {
  valid: boolean;
  data?: PersonalizationData;
  errors?: string[];
  diagnostics?: PersonalizationDiagnostics;
}

export interface PersonalizationDiagnostics {
  accepted: boolean;
  errorCount: number;
  usedPatchOverlay: boolean;
  sanitizedKeys: string[];
}

export class PersonalizationEngine {
  private ajv: Ajv;
  private sanitizedKeys: string[] = [];

  constructor() {
    this.ajv = new Ajv({ allErrors: true, useDefaults: true });
  }

  validate(
    contract: PersonalizationContract,
    aiOutput: unknown
  ): PersonalizationResult {
    this.sanitizedKeys = [];
    const validate = this.ajv.compile(contract);
    const valid = validate(aiOutput);

    if (!valid) {
      const errors = this.formatErrors(validate.errors);
      return {
        valid: false,
        errors,
        diagnostics: this.createDiagnostics(false, errors.length, false),
      };
    }

    const unsafeValueErrors = this.validateSafeValues(aiOutput);
    if (unsafeValueErrors.length > 0) {
      return {
        valid: false,
        errors: unsafeValueErrors,
        diagnostics: this.createDiagnostics(
          false,
          unsafeValueErrors.length,
          false
        ),
      };
    }

    const patchResult = this.applyValidatedPatches(contract, aiOutput);
    if (!patchResult.valid) {
      return patchResult;
    }

    return {
      valid: true,
      data: patchResult.data,
      diagnostics: this.createDiagnostics(
        true,
        0,
        Boolean((aiOutput as PersonalizationData).patches?.length)
      ),
    };
  }

  /**
   * Applies the validated personalization data to the base props.
   */
  apply(
    baseProps: Record<string, unknown>,
    personalization: PersonalizationData
  ): Record<string, unknown> {
    this.sanitizedKeys = [];
    const result = this.safeMerge({}, baseProps);

    if (personalization.props) {
      this.safeMerge(result, personalization.props);
    }

    if (personalization.variant) {
      result.variant = personalization.variant;
    }

    if (personalization.slots) {
      this.safeMerge(result, personalization.slots);
    }

    if (personalization.designTokens) {
      result.designTokens = this.safeMerge({}, personalization.designTokens);
    }

    return result;
  }

  private safeMerge(
    target: Record<string, unknown>,
    source: Record<string, unknown>
  ): Record<string, unknown> {
    Object.entries(source).forEach(([key, value]) => {
      if (this.isUnsafeObjectKey(key)) {
        this.sanitizedKeys.push(key);
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

  private applyValidatedPatches(
    contract: PersonalizationContract,
    aiOutput: unknown
  ): PersonalizationResult {
    const personalization = aiOutput as PersonalizationData;

    if (!personalization.patches || personalization.patches.length === 0) {
      return {
        valid: true,
        data: personalization,
        diagnostics: this.createDiagnostics(true, 0, false),
      };
    }

    const pathErrors = this.validatePatchPaths(
      contract,
      personalization.patches
    );
    if (pathErrors.length > 0) {
      return {
        valid: false,
        errors: pathErrors,
        diagnostics: this.createDiagnostics(false, pathErrors.length, true),
      };
    }

    const unsafePatchErrors = this.validatePatchValues(personalization.patches);
    if (unsafePatchErrors.length > 0) {
      return {
        valid: false,
        errors: unsafePatchErrors,
        diagnostics: this.createDiagnostics(
          false,
          unsafePatchErrors.length,
          true
        ),
      };
    }

    try {
      const overlay = this.createPatchOverlay(personalization);
      const patched = jsonpatch.applyPatch(
        overlay,
        personalization.patches,
        true,
        false
      ).newDocument as PersonalizationData;
      const patchedData = this.stripEmptyOverlayContainers(patched);
      const validationErrors = this.validatePatchedData(contract, patchedData);

      if (validationErrors.length > 0) {
        return {
          valid: false,
          errors: validationErrors,
          diagnostics: this.createDiagnostics(
            false,
            validationErrors.length,
            true
          ),
        };
      }

      return {
        valid: true,
        data: patchedData,
        diagnostics: this.createDiagnostics(true, 0, true),
      };
    } catch (err: unknown) {
      return {
        valid: false,
        errors: [
          err instanceof Error
            ? `Invalid personalization patch: ${err.message}`
            : 'Invalid personalization patch',
        ],
        diagnostics: this.createDiagnostics(false, 1, true),
      };
    }
  }

  private validatePatchPaths(
    contract: PersonalizationContract,
    patches: jsonpatch.Operation[]
  ): string[] {
    const errors: string[] = [];

    patches.forEach((patch, index) => {
      if (!this.isAllowedPatchPath(contract, patch.path)) {
        errors.push(
          `/patches/${index}/path must target a declared personalization path`
        );
      }

      if (
        'from' in patch &&
        typeof patch.from === 'string' &&
        !this.isAllowedPatchPath(contract, patch.from)
      ) {
        errors.push(
          `/patches/${index}/from must target a declared personalization path`
        );
      }
    });

    return errors;
  }

  private validatePatchValues(patches: jsonpatch.Operation[]): string[] {
    const errors: string[] = [];

    patches.forEach((patch, index) => {
      if ('value' in patch && this.containsUnsafeObjectKey(patch.value)) {
        errors.push(`/patches/${index}/value contains an unsafe object key`);
      }
    });

    return errors;
  }

  private containsUnsafeObjectKey(value: unknown): boolean {
    if (Array.isArray(value)) {
      return value.some((item) => this.containsUnsafeObjectKey(item));
    }

    if (!this.isRecord(value)) {
      return false;
    }

    return Object.entries(value).some(
      ([key, nested]) =>
        this.isUnsafeObjectKey(key) || this.containsUnsafeObjectKey(nested)
    );
  }

  private isAllowedPatchPath(
    contract: PersonalizationContract,
    path: string
  ): boolean {
    const segments = this.parseJsonPointer(path);

    if (!segments) {
      return false;
    }

    if (segments.length === 1) {
      return segments[0] === 'variant';
    }

    if (segments.length !== 2) {
      return false;
    }

    const [section, name] = segments;

    if (!name || this.isUnsafeObjectKey(name)) {
      return false;
    }

    if (section === 'props') {
      return this.hasDeclaredProperty(contract, ['props'], name);
    }

    if (section === 'slots') {
      return this.hasDeclaredProperty(contract, ['slots'], name);
    }

    if (section === 'designTokens') {
      return this.hasDeclaredProperty(contract, ['designTokens'], name);
    }

    return false;
  }

  private parseJsonPointer(path: string): string[] | null {
    if (path === '' || !path.startsWith('/')) {
      return null;
    }

    return path
      .slice(1)
      .split('/')
      .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'));
  }

  private hasDeclaredProperty(
    contract: PersonalizationContract,
    path: string[],
    name: string
  ): boolean {
    const schema = path.reduce<unknown>((current, segment) => {
      if (!this.isRecord(current)) {
        return undefined;
      }

      const properties = current.properties;
      if (!this.isRecord(properties)) {
        return undefined;
      }

      return properties[segment];
    }, contract);

    if (!this.isRecord(schema) || !this.isRecord(schema.properties)) {
      return false;
    }

    return Object.prototype.hasOwnProperty.call(schema.properties, name);
  }

  private createPatchOverlay(
    personalization: PersonalizationData
  ): PersonalizationData {
    return {
      props: { ...(personalization.props ?? {}) },
      ...(personalization.variant && { variant: personalization.variant }),
      slots: { ...(personalization.slots ?? {}) },
      designTokens: { ...(personalization.designTokens ?? {}) },
    };
  }

  private stripEmptyOverlayContainers(
    personalization: PersonalizationData
  ): PersonalizationData {
    const data: PersonalizationData = {};

    if (
      personalization.props &&
      Object.keys(personalization.props).length > 0
    ) {
      data.props = personalization.props;
    }

    if (personalization.variant) {
      data.variant = personalization.variant;
    }

    if (
      personalization.slots &&
      Object.keys(personalization.slots).length > 0
    ) {
      data.slots = personalization.slots;
    }

    if (
      personalization.designTokens &&
      Object.keys(personalization.designTokens).length > 0
    ) {
      data.designTokens = personalization.designTokens;
    }

    return data;
  }

  private validatePatchedData(
    contract: PersonalizationContract,
    data: PersonalizationData
  ): string[] {
    const validate = this.ajv.compile(contract);
    const valid = validate(data);

    if (valid) {
      return [];
    }

    return this.formatErrors(validate.errors, [
      'Patched personalization data failed validation',
    ]);
  }

  private validateSafeValues(value: unknown): string[] {
    return this.containsUnsafeObjectKey(value)
      ? ['Personalization data contains an unsafe object key']
      : [];
  }

  private formatErrors(
    errors: ErrorObject[] | null | undefined,
    fallback: string[] = []
  ): string[] {
    return (
      errors?.map(
        (err: ErrorObject) =>
          `${err.instancePath || err.schemaPath} ${err.message}`
      ) ?? fallback
    );
  }

  private createDiagnostics(
    accepted: boolean,
    errorCount: number,
    usedPatchOverlay: boolean
  ): PersonalizationDiagnostics {
    return {
      accepted,
      errorCount,
      usedPatchOverlay,
      sanitizedKeys: [...this.sanitizedKeys],
    };
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
