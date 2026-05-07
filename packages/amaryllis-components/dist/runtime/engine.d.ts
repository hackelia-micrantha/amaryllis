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
export declare class PersonalizationEngine {
    private ajv;
    constructor();
    validate(contract: PersonalizationContract, aiOutput: unknown): PersonalizationResult;
    /**
     * Applies the validated personalization data to the base props.
     */
    apply(baseProps: Record<string, unknown>, personalization: PersonalizationData): Record<string, unknown>;
}
