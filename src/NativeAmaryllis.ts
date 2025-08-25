import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  init(config: Object, newSession?: Object): Promise<void>;

  generate(params: Object, newSession?: Object): Promise<string>;

  generateAsync(params: Object, newSession?: Object): Promise<void>;

  close(): void;

  cancelAsync(): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('Amaryllis');
