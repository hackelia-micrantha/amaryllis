//
//  Header.h
//  Pods
//
//  Created by Ryan Jennings on 2025-09-05.
//

#ifndef Amaryllis_h
#define Amaryllis_h

typedef void (^PartialResponseHandler)(NSString *_Nullable partialResponse,
                                       NSError *_Nullable error);
typedef void (^CompletionHandler)(void);

@interface Amaryllis : NSObject

- (void) initWithParams: (NSDictionary *_Nonnull) params error: (NSError *_Nullable*_Nullable) error;
- (void) newSessionWithParams: (NSDictionary *_Nonnull) params error: (NSError *_Nullable*_Nullable) error;
- (NSString *_Nullable) generateWithParams: (NSDictionary *_Nonnull) params error: (NSError *_Nullable*_Nullable) error;
- (void) generateAsyncWithParams: (NSDictionary *_Nonnull) params error: (NSError *_Nullable*_Nullable) error
                        response: (PartialResponseHandler _Nullable ) progress completion: (CompletionHandler _Nullable ) completion;
- (void) close;
@end

extern NSString *_Nonnull const AmaryllisErrorDomain;

extern NSString *_Nonnull const PARAM_IMAGES;
extern NSString *_Nonnull const PARAM_PROMPT;
extern NSString *_Nonnull const PARAM_MAX_TOP_K;
extern NSString *_Nonnull const PARAM_MAX_TOKENS;
extern NSString *_Nonnull const PARAM_MAX_NUM_IMAGES;
extern NSString *_Nonnull const PARAM_VISION_ENCODER;
extern NSString *_Nonnull const PARAM_VISION_ADAPTER;
extern NSString *_Nonnull const PARAM_MODEL_PATH;
extern NSString *_Nonnull const PARAM_TEMPERATURE;
extern NSString *_Nonnull const PARAM_RANDOM_SEED;
extern NSString *_Nonnull const PARAM_LORA_PATH;
extern NSString *_Nonnull const PARAM_TOP_K;
extern NSString *_Nonnull const PARAM_TOP_P;
extern NSString *_Nonnull const PARAM_ENABLE_VISION;

typedef NS_ENUM(NSInteger, AmaryllisErrorCode) {
    AmaryllisErrorCodeInvalidModelPath = 1001,
    AmaryllisErrorCodeNotInitialized = 1002,
    AmaryllisErrorCodeNoSession = 1003,
    AmaryllisInvalidArgument = 1004
};

#endif /* Header_h */
