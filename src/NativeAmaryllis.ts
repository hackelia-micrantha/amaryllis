import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  init(params: Object): Promise<void>;

  newSession(params: Object): Promise<void>;

  generate(params: Object): Promise<string>;

  generateAsync(params: Object): Promise<void>;

  close(): void;

  cancelAsync(): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('Amaryllis');
