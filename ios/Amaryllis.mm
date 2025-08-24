#import "Amaryllis.h"
#import <MediaPipeTasksGenAI/MediaPipeTasksGenAI.h>
#import <MediaPipeTasksVision/MediaPipeTasksVision.h>

static NSString *const EVENT_ON_PARTIAL_RESULT = @"onPartialResult";
static NSString *const EVENT_ON_FINAL_RESULT = @"onFinalResult";
static NSString *const EVENT_ON_ERROR = @"onError";
static NSString *const ERROR_CODE_INFER = @"ERR_INFER";
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
static NSString *const PARAM_NEW_SESSION = @"newSession";
static NSString *const PARAM_ENABLE_VISION = @"enableVisionModality";

@interface AmaryllisModule ()

@property(nonatomic, strong) MPPLLMInference *llmInference;
@property(nonatomic, strong) MPPLLMInferenceSession *session;

@end

@implementation AmaryllisModule

RCT_EXPORT_MODULE(Amaryllis)

#pragma mark - Event Emitter

- (NSArray *)supportedEvents {
  return @[ EVENT_ON_PARTIAL_RESULT, EVENT_ON_FINAL_RESULT, EVENT_ON_ERROR ];
}

#pragma mark - Helpers

- (void) updateSession: (MPPLLMInferenceSession *) session fromParams: (NSDictionary *) params withError: (NSError **) error {
  [session addQueryChunkWithInputText:params[PARAM_PROMPT] ?: @"" error: error];

  NSArray *imagesArray = params[PARAM_IMAGES];

  if (imagesArray) {
    for (NSString *path in imagesArray) {
      if (![path isKindOfClass:[NSString class]])
        continue;

      CGImageRef image = [self imageFromPath:path];
      [session addImageWithImage: image error: error];
      if (error) break;
    }
  }
}

- (MPPLLMInferenceSession *) newSessionFromParams: (NSDictionary *)params withError: (NSError **)error {
  MPPLLMInferenceSessionOptions *sessionOptions = [[MPPLLMInferenceSessionOptions alloc] init];
  sessionOptions.topk = [params[PARAM_TOP_K] intValue];
  sessionOptions.topp = [params[PARAM_TOP_P] floatValue];
  sessionOptions.temperature = [params[PARAM_TEMPERATURE] floatValue];
  sessionOptions.loraPath = params[PARAM_LORA_PATH];
  sessionOptions.randomSeed = [params[PARAM_RANDOM_SEED] intValue];
  sessionOptions.enableVisionModality = [params[PARAM_ENABLE_VISION] boolValue];

  MPPLLMInferenceSession * session = [[MPPLLMInferenceSession alloc] initWithLlmInference: self.llmInference
                                                  options:sessionOptions error: error];

  if (error && *error) return session;

  [self updateSession: session fromParams: params withError:error];
  return session;
}

- (MPPLLMInferenceSession *) updateOrInitSessionFromParams:(NSDictionary *)params withError: (NSError **)error {
  NSDictionary *newSession = params[PARAM_NEW_SESSION];
  if (newSession || !self.session) {
    MPPLLMInferenceSession * session = [self newSessionFromParams: newSession withError:error];
    [self updateSession: session fromParams: params withError:error];
    return session;
  }
  [self updateSession: self.session fromParams: params withError:error];
  return self.session;
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
  return resized.CGImage;
}

#pragma mark - Configure Engine

RCT_REMAP_METHOD(init,
    initWithConfig : (NSDictionary *)config
    resolver : (RCTPromiseResolveBlock) resolve
    rejecter : (RCTPromiseRejectBlock)reject) {
  @try {
    NSError *error = nil;
    MPPLLMInferenceOptions *taskOptions = [[MPPLLMInferenceOptions alloc] init];
    taskOptions.modelPath = config[PARAM_MODEL_PATH];
    taskOptions.maxTopk = [config[PARAM_MAX_TOP_K] intValue];
    taskOptions.maxTokens = [config[PARAM_MAX_TOKENS] intValue];
    taskOptions.maxImages = [config[PARAM_MAX_NUM_IMAGES] floatValue];
    taskOptions.visionAdapterPath = config[PARAM_VISION_ADAPTER];
    taskOptions.visionEncoderPath = config[PARAM_VISION_ENCODER];

    self.llmInference = [[MPPLLMInference alloc] initWithOptions: taskOptions error: &error];

    if (error) {
      reject(ERROR_CODE_INFER, @"unable to initialize inference", error);
      return;
    }

    self.session = [self newSessionFromParams: config[PARAM_NEW_SESSION] withError:&error];

    if (error) {
      reject(@"ERR_INFER", @"unable to create session", error);
      return;
    }

    resolve(nil);
  } @catch (NSException *exception) {
    reject(ERROR_CODE_INFER, @"unable to configure", nil);
  }
}

#pragma mark - Generate Sync

RCT_REMAP_METHOD(generate,
                generateWithParams: (NSDictionary *) params
                resolver : (RCTPromiseResolveBlock) resolve
                rejecter : (RCTPromiseRejectBlock) reject) {
  @try {
    NSError *error = nil;
    self.session = [self updateOrInitSessionFromParams:params withError:&error];
    if (error) {
      reject(ERROR_CODE_INFER, @"unable to update or create session", error);
      return;
    }

    NSString *result = [self.session generateResponseAndReturnError: &error];
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

RCT_REMAP_METHOD(generateAsync,
                generateAsyncWithParams: (NSDictionary *) params
                resolver : (RCTPromiseResolveBlock) resolve
                rejecter : (RCTPromiseRejectBlock) reject) {
  @try {
    NSError *error = nil;
    self.session = [self updateOrInitSessionFromParams:params withError: &error];

    if (error) {
      [self sendEventWithName:EVENT_ON_ERROR body:error];
      reject(ERROR_CODE_INFER, @"unable to update or create session", error);
      return;
    }
    [self.session generateResponseAsyncAndReturnError: &error progress: ^(NSString *result, NSError *err) {
      if (!err) {
        [self sendEventWithName:EVENT_ON_PARTIAL_RESULT body:result];
      } else {
        [self sendEventWithName:EVENT_ON_ERROR body:err];
      }
    } completion: ^{
      [self sendEventWithName:EVENT_ON_FINAL_RESULT body:nil];
    }];
    resolve(nil);
  } @catch(NSException *exception) {
    [self sendEventWithName:EVENT_ON_ERROR body: nil];
    reject(ERROR_CODE_INFER, @"unable to generate response", nil);
  }
}

#pragma mark - Close Engine

RCT_EXPORT_METHOD(close) {
  self.session = nil;
  self.llmInference = nil;
}

RCT_EXPORT_METHOD(cancelAsync) { }

- (NSDictionary *) constantsToExport {
  return @{
    @"EVENT_ON_PARTIAL_RESULT": EVENT_ON_PARTIAL_RESULT,
    @"EVENT_ON_FINAL_RESULT": EVENT_ON_FINAL_RESULT,
    @"EVENT_ON_ERROR": EVENT_ON_ERROR,
    // errors
    @"ERROR_CODE_INFER": ERROR_CODE_INFER,
    // params
    @"PARAM_IMAGES": PARAM_IMAGES,
    @"PARAM_PROMPT": PARAM_PROMPT,
    @"PARAM_MAX_TOP_K": PARAM_MAX_TOP_K,
    @"PARAM_MAX_TOKENS": PARAM_MAX_TOKENS,
    @"PARAM_MAX_NUM_IMAGES": PARAM_MAX_NUM_IMAGES,
    @"PARAM_VISION_ENCODER": PARAM_VISION_ENCODER,
    @"PARAM_VISION_ADAPTER": PARAM_VISION_ADAPTER,
    @"PARAM_MODEL_PATH": PARAM_MODEL_PATH,
    @"PARAM_TEMPERATURE": PARAM_TEMPERATURE,
    @"PARAM_RANDOM_SEED": PARAM_RANDOM_SEED,
    @"PARAM_LORA_PATH": PARAM_LORA_PATH,
    @"PARAM_TOP_K": PARAM_TOP_K,
    @"PARAM_TOP_P": PARAM_TOP_P,
    @"PARAM_NEW_SESSION": PARAM_NEW_SESSION,
    @"PARAM_ENABLE_VISION": PARAM_ENABLE_VISION,
  };
}



@end
