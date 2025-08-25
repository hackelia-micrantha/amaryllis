import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';
import type {
  LlmEngineConfig,
  LlmSessionParams,
  LlmRequestParams,
} from './Types';

export interface Spec extends TurboModule {
  init(config: LlmEngineConfig, newSession?: LlmSessionParams): Promise<void>;

  generate(
    params: LlmRequestParams,
    newSession?: LlmSessionParams
  ): Promise<string>;

  generateAsync(
    params: LlmRequestParams,
    newSession?: LlmSessionParams
  ): Promise<void>;

  close(): void;

  cancelAsync(): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('Amaryllis');
