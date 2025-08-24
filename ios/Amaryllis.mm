#import "AmaryllisModule.h"
#import <MLImage/MLImage.h>                 // MediaPipe MLImage
#import <LLMInference/LLMInference.h>       // MediaPipe LLMInference framework

@interface AmaryllisModule ()

@property(nonatomic, strong) LlmInference *llmInference;
@property(nonatomic, strong) LlmInferenceSession *session;

@end

@implementation AmaryllisModule

RCT_EXPORT_MODULE(Amaryllis)

#pragma mark - Event Emitter

- (NSArray<NSString *> *)supportedEvents {
  return @[@"onPartialResult", @"onError"];
}

#pragma mark - Configure Engine

RCT_REMAP_METHOD(init,
                 config:(NSDictionary *)config
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  @try {
    // Build LlmInferenceOptions
    LlmInferenceOptions *taskOptions = [[[[LlmInferenceOptions builder]
                                          setModelPath:config[@"modelPath"]]
                                         setMaxTopK:[config[@"maxTopK"] intValue]]
                                        build];

    self.llmInference = [LlmInference createFromOptions:taskOptions];

    // Build GraphOptions for vision modality
    GraphOptions *graphOptions = [[[GraphOptions builder]
                                   setEnableVisionModality:[config[@"enableVision"] boolValue]]
                                  build];

    // Build LlmInferenceSessionOptions
    LlmInferenceSessionOptions *sessionOptions = [[[[LlmInferenceSessionOptions builder]
                                                     setGraphOptions:graphOptions]
                                                    setTopK:[config[@"maxTopK"] intValue]]
                                                   build];

    self.session = [LlmInferenceSession createFromOptions:self.llmInference options:sessionOptions];

    resolve(nil);
  } @catch (NSException *exception) {
    reject(@"ERR_INFER", @"unable to configure", nil);
  }
}

#pragma mark - Generate Sync

RCT_REMAP_METHOD(generateSync,
                 params:(NSDictionary *)params
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  @try {
    NSString *prompt = params[@"prompt"] ?: @"";
    [self.session addQueryChunk:prompt];

    NSArray *imagesArray = params[@"images"];
    if (imagesArray) {
      NSArray<MLImage *> *mlImages = [self preprocessImages:imagesArray];
      for (MLImage *image in mlImages) {
        [self.session addImage:image];
      }
    }

    NSString *result = [self.session generateResponse];
    resolve(result);
  } @catch (NSException *exception) {
    reject(@"ERR_INFER", @"unable to generate response", nil);
  }
}

#pragma mark - Generate Async

RCT_REMAP_METHOD(generateAsync,
                 params:(NSDictionary *)params)
{
  NSString *prompt = params[@"prompt"] ?: @"";
  [self.session addQueryChunk:prompt];

  NSArray *imagesArray = params[@"images"];
  if (imagesArray) {
    NSArray<MLImage *> *mlImages = [self preprocessImages:imagesArray];
    for (MLImage *image in mlImages) {
      [self.session addImage:image];
    }
  }

  [self.session generateResponseAsync:^(NSString *partialResult, BOOL done) {
    if (!done) {
      [self sendEventWithName:@"onPartialResult" body:partialResult];
    }
  }];
}

#pragma mark - Close Engine

RCT_EXPORT_METHOD(close)
{
  [self.session close];
  [self.llmInference close];
  self.session = nil;
  self.llmInference = nil;
}

#pragma mark - Helpers

- (NSArray<MLImage *> *)preprocessImages:(NSArray<NSString *> *)paths {
  NSMutableArray<MLImage *> *images = [NSMutableArray array];
  for (NSString *path in paths) {
    if (![path isKindOfClass:[NSString class]]) continue;

    MLImage *mlImage = [self mlImageFromPath:path];
    if (mlImage) [images addObject:mlImage];
  }
  return images;
}

- (MLImage *)mlImageFromPath:(NSString *)path {
  UIImage *uiImage = [UIImage imageWithContentsOfFile:path];
  if (!uiImage) return nil;

  // Resize to 512x512 if necessary
  CGSize targetSize = CGSizeMake(512, 512);
  UIGraphicsBeginImageContextWithOptions(targetSize, NO, 1.0);
  [uiImage drawInRect:CGRectMake(0, 0, targetSize.width, targetSize.height)];
  UIImage *resized = UIGraphicsGetImageFromCurrentImageContext();
  UIGraphicsEndImageContext();

  // Convert to MLImage
  return [[MLImage alloc] initWithUIImage:resized];
}

@end
