import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';
import type {
  LlmEngineConfig,
  LlmSessionParams,
  LlmRequestParams,
} from './Types';

export interface Spec extends TurboModule {
  init(params: LlmEngineConfig): Promise<void>;

  newSession(params?: LlmSessionParams): Promise<void>;

  generate(params: LlmRequestParams): Promise<string>;

  generateAsync(params: LlmRequestParams): Promise<void>;

  close(): void;

  cancelAsync(): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('Amaryllis');
