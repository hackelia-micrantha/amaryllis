#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface AMRequestTracker : NSObject

- (BOOL)tryStart:(NSString *)requestId;
- (BOOL)owns:(NSString *)requestId;
- (BOOL)clear:(NSString *)requestId;
- (void)clearAll;

@end

NS_ASSUME_NONNULL_END
