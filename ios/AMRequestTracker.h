#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

typedef NS_ENUM(NSInteger, AMRequestState) {
  AMRequestStateNone = 0,
  AMRequestStateGenerating,
  AMRequestStateCancelling,
};

@interface AMRequestTracker : NSObject

- (BOOL)tryStart:(NSString *)requestId;
- (BOOL)owns:(NSString *)requestId;
- (BOOL)isCancelling:(NSString *)requestId;
- (BOOL)requestCancellation:(NSString *)requestId;
- (BOOL)restoreGenerating:(NSString *)requestId;
- (AMRequestState)settle:(NSString *)requestId;
- (void)clearAll;

@end

NS_ASSUME_NONNULL_END
