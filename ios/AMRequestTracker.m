#import "AMRequestTracker.h"

@interface AMRequestTracker ()
@property(nonatomic, copy, nullable) NSString *activeRequestId;
@end

@implementation AMRequestTracker

- (BOOL)tryStart:(NSString *)requestId {
  @synchronized(self) {
    if (self.activeRequestId != nil) {
      return NO;
    }
    self.activeRequestId = requestId;
    return YES;
  }
}

- (BOOL)owns:(NSString *)requestId {
  @synchronized(self) {
    return [self.activeRequestId isEqualToString:requestId];
  }
}

- (BOOL)clear:(NSString *)requestId {
  @synchronized(self) {
    if (![self.activeRequestId isEqualToString:requestId]) {
      return NO;
    }
    self.activeRequestId = nil;
    return YES;
  }
}

- (void)clearAll {
  @synchronized(self) {
    self.activeRequestId = nil;
  }
}

@end
