#import "Amaryllis.h"
#import <MediaPipeTasksGenAI/MediaPipeTasksGenAI.h>
#import <MediaPipeTasksVision/MediaPipeTasksVision.h>

@interface AmaryllisModule ()

@property(nonatomic, strong) MPPLLMInference *MPPLLMInference;
@property(nonatomic, strong) MPPLLMInferenceSession *session;

static NSString *const EVENT_ON_PARTIAL_RESULT = @"onPartialResult";
static NSString *const EVENT_ON_FINAL_RESULT = @"OnFinalResult";
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

@end

@implementation AmaryllisModule

RCT_EXPORT_MODULE(Amaryllis)

#pragma mark - Event Emitter

- (NSArray<NSString *> *)supportedEvents {
  return @[ EVENT_ON_PARTIAL_RESULT, EVENT_ON_FINAL_RESULT,
           EVENT_ON_ERROR ];
}

#pragma mark - Configure Engine

RCT_REMAP_METHOD(
    init, config : (NSDictionary *)config resolver : (RCTPromiseResolveBlock)
              resolve rejecter : (RCTPromiseRejectBlock)reject) {
  @try {
    NSError *error = nil;
    // Build MPPLLMInferenceOptions
    MPPLLMInferenceOptions *taskOptions = [MPPLLMInferenceOptions init];
    taskOptions.modelPath = config[PARAM_MODEL_PATH];
    taskOptions.maxTopK = [config[PARAM_MAX_TOP_K] intValue];
    taskOptions.maxTokens = [config[PARAM_MAX_TOKENS] intValue];
    taskOptions.maxNumImages = [config[PARAM_MAX_NUM_IMAGES] floatValue];
    taskOptions.visionAdapterPath = config[PARAM_VISION_ADAPTER];
    taskOptions.visionEncoderPath = config[PARAM_VISION_ENCODER];

    self.llmInference = [MPPLLMInference initWithOptions:taskOptions error: &error];

    if (error) {
      reject(ERROR_CODE_INFER, @"unable to initialize inference", error);
      return;
    }

    self.session = [self initSessionFromParams:config error:&error];

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

RCT_REMAP_METHOD(generateSync,
                 params : (NSDictionary *)
                     params resolver : (RCTPromiseResolveBlock)
                         resolve rejecter : (RCTPromiseRejectBlock)reject) {
  @try {
    NSError *error = nil;
    self.session = [self updateOrInitSessionFromParams:params error:&error];
    if (error) {
      reject(ERROR_CODE_INFER, @"unable to update or create session", error);
      return;
    }

    NSString *result = [self.session generateResponse];
    resolve(result);
  } @catch (NSException *exception) {
    reject(ERROR_CODE_INFER, @"unable to generate response", nil);
  }
}

#pragma mark - Generate Async

RCT_REMAP_METHOD(generateAsync, params : (NSDictionary *)params) {
  NSError *error = nil;
  self.session = [self updateOrInitSessionFromParams:params];

  if (error) {
    [self sendEventWithName:EVENT_ON_ERROR body:error.localizedDescription];
    return;
  }
  [self.session generateResponseAsync:^(NSString *partialResult, BOOL done) {
    if (!done) {
      [self sendEventWithName:EVENT_ON_PARTIAL_RESULT body:partialResult];
    } else {
      [self sendEventWithName:EVENT_ON_FINAL_RESULT body:partialResult];
    }
  }];
}

#pragma mark - Close Engine

RCT_EXPORT_METHOD(close) {
  [self.session close];
  [self.llmInference close];
  self.session = nil;
  self.llmInference = nil;
}

RCT_EXPORT_METHOD(cancelAsync) { [self.session cancelAsync]; }

RCT_EXPORT_METHOD(constantsToExport : (NSDictionary *)constants) {
  return @{
     // events
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
    @"PARAM_NEW_SESSION": PARAM_NEW_SESSION
  };
}

#pragma mark - Helpers

- (void) updateSessionFromParams: (MPPLLMSession *) session params: (NSDictionary *)params {
  [session addQueryChunk:params[PARAM_PROMPT] ?: @""];

  NSArray *imagesArray = params[@"images"];
  session.enableVisionModality = ([imagesArray count] > 0);

  if (imagesArray) {
    NSArray<CGImageRef> *images = [self preprocessImages:imagesArray];
    for (CGImageRef image in images) {
      [session addImageWithImage:image];
    }
  }
}

- (MPPLLMInferenceSession *)initSessionFromParams: (NSDictionary *)params error: (NSError **)error {
  MPPLLMInferenceSessionOptions *sessionOptions = [MPPInferenceSessionOptions init];
  sessionOptions.topK = [params[PARAM_TOP_K] intValue];
  sessionOptions.topP = [params[PARAM_TOP_P] floatValue];
  sessionOptions.temperature = [params[PARAM_TEMPERATURE] floatValue];
  sessionOptions.loraPath = params[PARAM_LORA_PATH];
  sessionOptions.randomSeed = [params[PARAM_RANDOM_SEED] intValue];

  MPPLLMSession * session = [MPPLLMInferenceSession initWithLLMInference:self.llmInference
                                                  options:sessionOptions error:&error];

  [self updateSessionFromParams:session params:params];
  return session
}

- (MPPLLMInferenceSession *) updateOrInitSessionFromParams:(NSDictionary *)params error: (NSError **)error {
  if ([params[PARAM_NEW_SESSION] boolValue] || !self.session) {
    MPPLLMSession * session = [self initSessionFromParams:params error:&error];
    [self updateSessionFromParams:session params:params];
    return session;
  }
  [self updateSessionFromParams:self.session params:params];
  return self.session;
}

- (NSArray<CGImageRef> *)preprocessImages:(NSArray<NSString *> *)paths {
  NSMutableArray<CGImageRef> *images = [NSMutableArray array];
  for (NSString *path in paths) {
    if (![path isKindOfClass:[NSString class]])
      continue;

    CGImageRef *image = [self imageFromPath:path];
    if (image)
      [images addObject:image];
  }
  return images;
}

- (CGImageRef *)imageFromPath:(NSString *)path {
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

@end
