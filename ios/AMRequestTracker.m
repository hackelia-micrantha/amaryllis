#import "AMRequestTracker.h"

@interface AMRequestTracker ()
@property(nonatomic, copy, nullable) NSString *activeRequestId;
@property(nonatomic, assign) AMRequestState state;
@end

@implementation AMRequestTracker

- (BOOL)tryStart:(NSString *)requestId {
  @synchronized(self) {
    if (self.activeRequestId != nil) {
      return NO;
    }
    self.activeRequestId = requestId;
    self.state = AMRequestStateGenerating;
    return YES;
  }
}

- (BOOL)owns:(NSString *)requestId {
  @synchronized(self) {
    return [self.activeRequestId isEqualToString:requestId];
  }
}

- (BOOL)isCancelling:(NSString *)requestId {
  @synchronized(self) {
    return [self.activeRequestId isEqualToString:requestId] &&
           self.state == AMRequestStateCancelling;
  }
}

- (BOOL)requestCancellation:(NSString *)requestId {
  @synchronized(self) {
    if (![self.activeRequestId isEqualToString:requestId] ||
        self.state != AMRequestStateGenerating) {
      return NO;
    }
    self.state = AMRequestStateCancelling;
    return YES;
  }
}

- (BOOL)restoreGenerating:(NSString *)requestId {
  @synchronized(self) {
    if (![self.activeRequestId isEqualToString:requestId] ||
        self.state != AMRequestStateCancelling) {
      return NO;
    }
    self.state = AMRequestStateGenerating;
    return YES;
  }
}

- (AMRequestState)settle:(NSString *)requestId {
  @synchronized(self) {
    if (![self.activeRequestId isEqualToString:requestId]) {
      return AMRequestStateNone;
    }
    AMRequestState settledState = self.state;
    self.activeRequestId = nil;
    self.state = AMRequestStateNone;
    return settledState;
  }
}

- (void)clearAll {
  @synchronized(self) {
    self.activeRequestId = nil;
    self.state = AMRequestStateNone;
  }
}

@end
