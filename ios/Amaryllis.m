//
//  Amaryllis.m
//  Amaryllis
//
//  Created by Ryan Jennings on 2025-09-05.
//

#import <Foundation/Foundation.h>
#import <MediaPipeTasksGenAI/MediaPipeTasksGenAI.h>
#import "Amaryllis.h"

NSString *const PARAM_IMAGES = @"images";
NSString *const PARAM_PROMPT = @"prompt";
NSString *const PARAM_MAX_TOP_K = @"maxTopK";
NSString *const PARAM_MAX_TOKENS = @"maxTokens";
NSString *const PARAM_MAX_NUM_IMAGES = @"maxNumImages";
NSString *const PARAM_VISION_ENCODER = @"visionEncoderPath";
NSString *const PARAM_VISION_ADAPTER = @"visionAdapterPath";
NSString *const PARAM_MODEL_PATH = @"modelPath";
NSString *const PARAM_TEMPERATURE = @"temperature";
NSString *const PARAM_RANDOM_SEED = @"randomSeed";
NSString *const PARAM_LORA_PATH = @"loraPath";
NSString *const PARAM_TOP_K = @"topK";
NSString *const PARAM_TOP_P = @"topP";
NSString *const PARAM_ENABLE_VISION = @"enableVisionModality";

NSString *const AmaryllisErrorDomain = @"com.example.amaryllis";

static NSString *const ERR_NOT_INITIALIZED = @"please initialize the SDK first";
static NSString *const ERR_INVALID_ARGUMENT = @"invalid argument provided";
static NSString *const ERR_NO_SESSION = @"new session required";

@interface Amaryllis ()

@property(nonatomic, strong) MPPLLMInference *llmInference;
@property(nonatomic, strong) MPPLLMInferenceSession *session;

@end

@implementation Amaryllis

- (void) initWithParams: (NSDictionary*) params error: (NSError**) error {

  NSString *modelPath = params[PARAM_MODEL_PATH];

  MPPLLMInferenceOptions *taskOptions = [[MPPLLMInferenceOptions alloc]
                                         initWithModelPath:modelPath];
  taskOptions.maxTopk = [params[PARAM_MAX_TOP_K] intValue];
  taskOptions.maxTokens = [params[PARAM_MAX_TOKENS] intValue];
  taskOptions.maxImages = [params[PARAM_MAX_NUM_IMAGES] intValue];
  taskOptions.visionAdapterPath = params[PARAM_VISION_ADAPTER];
  taskOptions.visionEncoderPath = params[PARAM_VISION_ENCODER];

  NSLog(@"Initializing llm inference");

  self.llmInference = [[MPPLLMInference alloc] initWithOptions:taskOptions
                                                         error:error];
}

- (void) newSessionWithParams: (NSDictionary *) params error: (NSError **) error {
  if (![self validateInitialized:error]) {
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

  NSLog(@"starting new session");

  self.session =
      [[MPPLLMInferenceSession alloc] initWithLlmInference:self.llmInference
                                                   options:sessionOptions
                                                     error:error];
}

- (NSString *) generateWithParams: (NSDictionary *) params error: (NSError **) error {

  if (![self validateInitialized:error]) {
    return nil;
  }

  if (self.session) {
    if (![self updateSessionFromParams:params error:error]) {
      return nil;
    }

    return [self.session generateResponseAndReturnError:error];
  }

  if (![self validateNoSession:params error:error]) {
    return nil;
  }

  return [self.llmInference generateResponseWithInputText:params[PARAM_PROMPT] error:error];
}

- (void) generateAsyncWithParams: (NSDictionary *) params error: (NSError **) error response: (PartialResponseHandler) progress completion: (CompletionHandler) completion {

  if (![self validateInitialized:error]) {
    return;
  }

  if (self.session) {

    if (![self updateSessionFromParams:params error:error]) {
      return;
    }

    [self.session generateResponseAsyncAndReturnError:error
                                             progress:progress
                                           completion:completion];

  } else {

    if (![self validateNoSession:params error:error]) {
      return;
    }

    [self.llmInference generateResponseAsyncWithInputText:params[PARAM_PROMPT]
                                                    error:error
                                                 progress:progress
                                               completion:completion];
  }
}

- (void) close {
  self.session = nil;
  self.llmInference = nil;
}

#pragma mark - Helpers

- (BOOL)updateSessionFromParams:(NSDictionary *)params error: (NSError **) error {

  NSString *prompt = params ? params[PARAM_PROMPT] : nil;
  NSArray *images = params ? params[PARAM_IMAGES] : nil;

  if (!prompt && !images) {
    *error = [NSError errorWithDomain:AmaryllisErrorDomain code:AmaryllisInvalidArgument userInfo:@{NSLocalizedDescriptionKey: ERR_INVALID_ARGUMENT}];
    return NO;
  }

  [self.session addQueryChunkWithInputText:prompt error:error];

  if (error) return NO;

  if (images) {
    for (NSString *path in images) {
      CGImageRef image = [self imageFromPath:path];
      [self.session addImageWithImage:image error:error];
      CGImageRelease(image);
      if (error) {
        return NO;
      }
    }
  }
  return YES;
}

- (BOOL)validateNoSession:(NSDictionary *)params
                    error: (NSError **) error {
  if (params && params[PARAM_IMAGES]) {
    *error = [NSError errorWithDomain:AmaryllisErrorDomain code:AmaryllisErrorCodeNoSession userInfo:@{NSLocalizedDescriptionKey: ERR_NO_SESSION}];
    return NO;
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

- (BOOL) validateInitialized: (NSError**) error {
  if (self.llmInference == nil) {
    *error = [NSError errorWithDomain:AmaryllisErrorDomain
                                code:AmaryllisErrorCodeNotInitialized
                            userInfo:@{NSLocalizedDescriptionKey: ERR_NOT_INITIALIZED}];
    return NO;
  }
  return YES;
}
@end
