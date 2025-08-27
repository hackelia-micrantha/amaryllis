import { NativeModules, NativeEventEmitter } from 'react-native';
import { LlmPipe } from './Amaryllis';

export const newLlmPipe = () =>
  new LlmPipe({
    nativeModule: NativeModules.Amaryllis,
    eventEmitter: new NativeEventEmitter(NativeModules.Amaryllis),
  });
