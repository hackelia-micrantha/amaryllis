#import "Amaryllis.h"
#import <MediaPipeTasksGenAI/MediaPipeTasksGenAI.h>
#import <ReactCommon/RCTTurboModule.h>

static NSString *const EVENT_ON_PARTIAL_RESULT = @"onPartialResult";
static NSString *const EVENT_ON_FINAL_RESULT = @"onFinalResult";
static NSString *const EVENT_ON_ERROR = @"onError";
static NSString *const ERROR_CODE_INFER = @"ERR_INFER";
static NSString *const ERROR_CODE_SESSION = @"ERR_SESSION";
static NSString *const PARAM_IMAGES = @"images";
static NSString *const PARAM_PROMPT = @"prompt";
static NSString *const PARAM_MAX_TOP_K = @"maxTopK";
static NSString *const PARAM_MAX_TOKENS = @"maxTokens";
static NSString *const PARAM_MAX_NUM_IMAGES = @"maxNumImages";
static NSString *const PARAM_VISION_ENCODER = @"visionEncoderPath";
static NSString *const PARAM_VISION_ADAPTER = @"visionAdapterPath";
static NSString *const PARAM_MODEL_PATH = @"modelPath";
static NSString *const PARAM_TEMPERATURE = @"temperature";
static NSString *const PARAM_RANDOM_SEED = @"randomSeed";
static NSString *const PARAM_LORA_PATH = @"loraPath";
static NSString *const PARAM_TOP_K = @"topK";
static NSString *const PARAM_TOP_P = @"topP";
static NSString *const PARAM_ENABLE_VISION = @"enableVisionModality";

typedef void (^PartialResponseHandler)(NSString *_Nullable partialResponse,
                                       NSError *_Nullable error);
typedef void (^CompletionHandler)(void);

@interface AmaryllisModule ()

@property(nonatomic, strong) MPPLLMInference *llmInference;
@property(nonatomic, strong) MPPLLMInferenceSession *session;

@end

@implementation AmaryllisModule

RCT_EXPORT_MODULE(Amaryllis)

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeAmaryllisSpecJSI>(params);
}
#pragma mark - Event Emitter

- (NSArray *)supportedEvents {
  return @[ EVENT_ON_PARTIAL_RESULT, EVENT_ON_FINAL_RESULT, EVENT_ON_ERROR ];
}

#pragma mark - Configure Engine

- (void)init:(nonnull NSDictionary *)config
       resolve:(nonnull RCTPromiseResolveBlock)resolve
        reject:(nonnull RCTPromiseRejectBlock)reject {
  @try {
    NSError *error = nil;
    MPPLLMInferenceOptions *taskOptions = [[MPPLLMInferenceOptions alloc]
        initWithModelPath:config[PARAM_MODEL_PATH]];
    taskOptions.maxTopk = [config[PARAM_MAX_TOP_K] intValue];
    taskOptions.maxTokens = [config[PARAM_MAX_TOKENS] intValue];
    taskOptions.maxImages = [config[PARAM_MAX_NUM_IMAGES] intValue];
    taskOptions.visionAdapterPath = config[PARAM_VISION_ADAPTER];
    taskOptions.visionEncoderPath = config[PARAM_VISION_ENCODER];

    self.llmInference = [[MPPLLMInference alloc] initWithOptions:taskOptions
                                                           error:&error];

    if (error) {
      reject(ERROR_CODE_INFER, @"unable to initialize inference", error);
      return;
    }

    MPPLLMInferenceSessionOptions *sessionOptions =
        [[MPPLLMInferenceSessionOptions alloc] init];
    self.session =
        [[MPPLLMInferenceSession alloc] initWithLlmInference:self.llmInference
                                                     options:sessionOptions
                                                       error:&error];

    if (error) {
      reject(@"ERR_INFER", @"unable to create session", error);
      return;
    }

    resolve(nil);
  } @catch (NSException *exception) {
    reject(ERROR_CODE_INFER, @"unable to configure", nil);
  }
}

- (void)newSession:(NSDictionary *)params
           resolve:(nonnull RCTPromiseResolveBlock)resolve
            reject:(nonnull RCTPromiseRejectBlock)reject {
  NSError *error = nil;

  @try {
    if (self.llmInference == nil) {
      reject(ERROR_CODE_SESSION, @"please initialize the engine first", nil);
      return;
    }

    MPPLLMInferenceSessionOptions *sessionOptions =
        [[MPPLLMInferenceSessionOptions alloc] init];
    sessionOptions.topk = [params[PARAM_TOP_K] intValue];
    sessionOptions.topp = [params[PARAM_TOP_P] floatValue];
    sessionOptions.temperature = [params[PARAM_TEMPERATURE] floatValue];
    sessionOptions.loraPath = params[PARAM_LORA_PATH];
    sessionOptions.randomSeed = [params[PARAM_RANDOM_SEED] intValue];
    sessionOptions.enableVisionModality =
        [params[PARAM_ENABLE_VISION] boolValue];

    self.session =
        [[MPPLLMInferenceSession alloc] initWithLlmInference:self.llmInference
                                                     options:sessionOptions
                                                       error:&error];
    resolve(nil);
  } @catch (NSException *exception) {
    reject(ERROR_CODE_SESSION, @"unable to create session", nil);
  }
}

#pragma mark - Generate Sync

- (void)generate:(nonnull NSDictionary *)params
         resolve:(nonnull RCTPromiseResolveBlock)resolve
          reject:(nonnull RCTPromiseRejectBlock)reject {
  @try {
    NSError *error = nil;
    NSString *result = nil;

    if (self.llmInference == nil) {
      reject(ERROR_CODE_SESSION, @"please initialize the engine first", nil);
      return;
    }

    if (self.session) {
      if (![self updateSessionFromParams:params reject:reject]) {
        return;
      }

      result = [self.session generateResponseAndReturnError:&error];
    } else {
      if (![self validateNoSession:params reject:reject]) {
        return;
      }

      result =
          [self.llmInference generateResponseWithInputText:params[PARAM_PROMPT]
                                                     error:&error];
    }
    if (error) {
      reject(ERROR_CODE_INFER, @"unable to generate response", error);
      return;
    }
    resolve(result);
  } @catch (NSException *exception) {
    reject(ERROR_CODE_INFER, @"unable to generate response", nil);
  }
}

#pragma mark - Generate Async

- (void)generateAsync:(nonnull NSDictionary *)params
              resolve:(nonnull RCTPromiseResolveBlock)resolve
               reject:(nonnull RCTPromiseRejectBlock)reject {
  @try {
    NSError *error = nil;

    if (self.llmInference == nil) {
      reject(ERROR_CODE_SESSION, @"please initialize the engine first", nil);
      return;
    }

    PartialResponseHandler progress = ^(NSString *result, NSError *err) {
      if (!err) {
        [self sendEventWithName:EVENT_ON_PARTIAL_RESULT body:result];
      } else {
        [self sendEventWithName:EVENT_ON_ERROR body:err];
      }
    };

    CompletionHandler completion = ^{
      [self sendEventWithName:EVENT_ON_FINAL_RESULT body:nil];
    };

    if (self.session) {

      if (![self updateSessionFromParams:params reject:reject]) {
        return;
      }

      [self.session generateResponseAsyncAndReturnError:&error
                                               progress:progress
                                             completion:completion];

    } else {

      if (![self validateNoSession:params reject:reject]) {
        return;
      }
      [self.llmInference generateResponseAsyncWithInputText:params[PARAM_PROMPT]
                                                      error:&error
                                                   progress:progress
                                                 completion:completion];

      if (error) {
        [self sendEventWithName:EVENT_ON_ERROR body:error];
        reject(ERROR_CODE_INFER, @"unable to generate response", error);
        return;
      }
    }
    resolve(nil);
  } @catch (NSException *exception) {
    [self sendEventWithName:EVENT_ON_ERROR body:nil];
    reject(ERROR_CODE_INFER, @"unable to generate response", nil);
  }
}

#pragma mark - Close Engine

- (void) close {
  self.session = nil;
  self.llmInference = nil;
}

- (void) cancelAsync {}

#pragma mark - Helpers

- (BOOL)validateNoSession:(NSDictionary *)params
                   reject:(nonnull RCTPromiseRejectBlock)reject {
  if (params && params[PARAM_IMAGES]) {
    [self sendEventWithName:EVENT_ON_ERROR body:nil];
    reject(ERROR_CODE_SESSION, @"please create a session before sending images",
           nil);
    return NO;
  }
  return YES;
}

- (BOOL)updateSessionFromParams:(NSDictionary *)params
                         reject:(nonnull RCTPromiseRejectBlock)reject {

  NSString *prompt = params ? params[PARAM_PROMPT] : nil;
  NSArray *images = params ? params[PARAM_IMAGES] : nil;
  NSError *error = nil;

  if (!prompt && !images) {
    [self sendEventWithName:EVENT_ON_ERROR body:nil];
    reject(ERROR_CODE_SESSION,
           @"either prompt or images are required to update session", nil);
    return NO;
  }

  [self.session addQueryChunkWithInputText:prompt error:&error];

  if (images) {
    for (NSString *path in images) {
      CGImageRef image = [self imageFromPath:path];
      [self.session addImageWithImage:image error:&error];
      CGImageRelease(image);
      if (error) {
        [self sendEventWithName:EVENT_ON_ERROR body:error];
        reject(ERROR_CODE_SESSION, @"unable to add image to session", error);
        return NO;
      }
    }
  }
  return YES;
}

- (CGImageRef)imageFromPath:(NSString *)path {
  UIImage *uiImage = [UIImage imageWithContentsOfFile:path];
  if (!uiImage)
    return nil;

  // Resize to 512x512 if necessary
  CGSize targetSize = CGSizeMake(512, 512);
  UIGraphicsBeginImageContextWithOptions(targetSize, NO, 1.0);
  [uiImage drawInRect:CGRectMake(0, 0, targetSize.width, targetSize.height)];
  UIImage *resized = UIGraphicsGetImageFromCurrentImageContext();
  UIGraphicsEndImageContext();

  // Convert to MLImage
  return CGImageRetain(resized.CGImage);
}

- (NSDictionary *)constantsToExport {
  return @{
    @"EVENT_ON_PARTIAL_RESULT" : EVENT_ON_PARTIAL_RESULT,
    @"EVENT_ON_FINAL_RESULT" : EVENT_ON_FINAL_RESULT,
    @"EVENT_ON_ERROR" : EVENT_ON_ERROR,
    // errors
    @"ERROR_CODE_INFER" : ERROR_CODE_INFER,
    @"ERROR_CODE_SESSION" : ERROR_CODE_SESSION,
    // params
    @"PARAM_IMAGES" : PARAM_IMAGES,
    @"PARAM_PROMPT" : PARAM_PROMPT,
    @"PARAM_MAX_TOP_K" : PARAM_MAX_TOP_K,
    @"PARAM_MAX_TOKENS" : PARAM_MAX_TOKENS,
    @"PARAM_MAX_NUM_IMAGES" : PARAM_MAX_NUM_IMAGES,
    @"PARAM_VISION_ENCODER" : PARAM_VISION_ENCODER,
    @"PARAM_VISION_ADAPTER" : PARAM_VISION_ADAPTER,
    @"PARAM_MODEL_PATH" : PARAM_MODEL_PATH,
    @"PARAM_TEMPERATURE" : PARAM_TEMPERATURE,
    @"PARAM_RANDOM_SEED" : PARAM_RANDOM_SEED,
    @"PARAM_LORA_PATH" : PARAM_LORA_PATH,
    @"PARAM_TOP_K" : PARAM_TOP_K,
    @"PARAM_TOP_P" : PARAM_TOP_P,
    @"PARAM_ENABLE_VISION" : PARAM_ENABLE_VISION,
  };
}

@end
