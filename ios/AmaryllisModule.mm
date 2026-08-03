#import "AmaryllisModule.h"
#import "AMRequestTracker.h"
#import "Amaryllis.h"
#import <ReactCommon/RCTTurboModule.h>

static NSString *const EVENT_ON_PARTIAL_RESULT = @"onPartialResult";
static NSString *const EVENT_ON_FINAL_RESULT = @"onFinalResult";
static NSString *const EVENT_ON_ERROR = @"onError";
static NSString *const ERROR_CODE_INFER = @"ERR_INFER";
static NSString *const ERROR_CODE_SESSION = @"ERR_SESSION";
static NSString *const ERROR_CODE_IN_PROGRESS = @"GENERATION_IN_PROGRESS";

@interface AmaryllisModule ()

@property(nonatomic, strong) Amaryllis *amaryllis;
@property(nonatomic, strong) AMRequestTracker *requestTracker;

@end

@implementation AmaryllisModule

RCT_EXPORT_MODULE(Amaryllis)

- (instancetype)init {
  self = [super init];
  self.amaryllis = [[Amaryllis alloc] init];
  self.requestTracker = [[AMRequestTracker alloc] init];
  return self;
}

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
  NSError *error = nil;

  @try {
    [self.amaryllis initWithParams:config error:&error];

    if (error) {
      reject(ERROR_CODE_INFER, @"unable to initialize inference", error);
      return;
    }

    resolve(nil);
  } @catch (NSException *exception) {
    NSLog(@"Amaryllis: error initializing (%@)", exception.description);
    reject(ERROR_CODE_INFER, @"unable to configure", nil);
  }
}

- (void)newSession:(NSDictionary *)params
           resolve:(nonnull RCTPromiseResolveBlock)resolve
            reject:(nonnull RCTPromiseRejectBlock)reject {
  NSError *error = nil;

  @try {
    [self.amaryllis newSessionWithParams:params error:&error];

    if (error) {
      reject(ERROR_CODE_INFER, @"unable to initialize inference", error);
      return;
    }

    resolve(nil);
  } @catch (NSException *exception) {
    NSLog(@"Amaryllis: error create new session (%@)", exception.description);
    reject(ERROR_CODE_SESSION, @"unable to create session", nil);
  }
}

#pragma mark - Generate Sync

- (void)generate:(nonnull NSDictionary *)params
         resolve:(nonnull RCTPromiseResolveBlock)resolve
          reject:(nonnull RCTPromiseRejectBlock)reject {
  @try {
    NSError *error = nil;
    NSString *result = [self.amaryllis generateWithParams:params error:&error];

    if (error) {
      reject(ERROR_CODE_INFER, @"unable to generate response", error);
      return;
    }
    resolve(result);
  } @catch (NSException *exception) {
    NSLog(@"Amaryllis: error generating inference (%@)", exception.description);
    reject(ERROR_CODE_INFER, @"unable to generate response", nil);
  }
}

#pragma mark - Generate Async

- (void)generateAsync:(nonnull NSDictionary *)params
             requestId:(nonnull NSString *)requestId
               resolve:(nonnull RCTPromiseResolveBlock)resolve
                reject:(nonnull RCTPromiseRejectBlock)reject {
  @synchronized(self) {
    if (![self.requestTracker tryStart:requestId]) {
      reject(ERROR_CODE_IN_PROGRESS, @"generation already in progress", nil);
      return;
    }

    @try {
      NSError *error = nil;
      NSMutableString *accumulatedText = [NSMutableString string];
      __weak AmaryllisModule *weakSelf = self;

      PartialResponseHandler progress = ^(NSString *result, NSError *err) {
        AmaryllisModule *strongSelf = weakSelf;
        if (!strongSelf || ![strongSelf.requestTracker owns:requestId]) {
          return;
        }

        if (err) {
          [strongSelf.requestTracker clear:requestId];
          [strongSelf sendEventWithName:EVENT_ON_ERROR
                                   body:@{
                                     @"requestId" : requestId,
                                     @"message" : err.localizedDescription ?: @"unknown error",
                                     @"code" : ERROR_CODE_INFER,
                                   }];
          return;
        }

        NSString *partialText = result ?: @"";
        @synchronized(accumulatedText) {
          [accumulatedText appendString:partialText];
        }
        [strongSelf sendEventWithName:EVENT_ON_PARTIAL_RESULT
                                 body:@{
                                   @"requestId" : requestId,
                                   @"text" : partialText,
                                 }];
      };

      CompletionHandler completion = ^{
        AmaryllisModule *strongSelf = weakSelf;
        if (!strongSelf || ![strongSelf.requestTracker clear:requestId]) {
          return;
        }

        NSString *finalText;
        @synchronized(accumulatedText) {
          finalText = [accumulatedText copy];
        }
        [strongSelf sendEventWithName:EVENT_ON_FINAL_RESULT
                                 body:@{
                                   @"requestId" : requestId,
                                   @"text" : @"",
                                   @"finalText" : finalText,
                                 }];
      };

      [self.amaryllis generateAsyncWithParams:params
                                        error:&error
                                     response:progress
                                   completion:completion];

      if (error) {
        [self.requestTracker clear:requestId];
        reject(ERROR_CODE_INFER, @"unable to generate response", error);
        return;
      }

      resolve(nil);
    } @catch (NSException *exception) {
      [self.requestTracker clear:requestId];
      NSLog(@"Amaryllis: error generating inference (%@)", exception.description);
      [self sendEventWithName:EVENT_ON_ERROR
                         body:@{
                           @"requestId" : requestId,
                           @"message" : @"unable to generate response",
                           @"code" : ERROR_CODE_INFER,
                         }];
      reject(ERROR_CODE_INFER, @"unable to generate response", nil);
    }
  }
}

#pragma mark - Close Engine

- (void)close {
  @synchronized(self) {
    [self.requestTracker clearAll];
    [self.amaryllis close];
  }
}

- (void)cancelAsync:(nonnull NSString *)requestId {
  if (![self.requestTracker clear:requestId]) {
    return;
  }
  [self.amaryllis cancelAsync];
}

- (NSDictionary *)constantsToExport {
  return @{
    @"EVENT_ON_PARTIAL_RESULT" : EVENT_ON_PARTIAL_RESULT,
    @"EVENT_ON_FINAL_RESULT" : EVENT_ON_FINAL_RESULT,
    @"EVENT_ON_ERROR" : EVENT_ON_ERROR,
    @"ERROR_CODE_INFER" : ERROR_CODE_INFER,
    @"ERROR_CODE_SESSION" : ERROR_CODE_SESSION,
    @"ERROR_CODE_IN_PROGRESS" : ERROR_CODE_IN_PROGRESS,
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
