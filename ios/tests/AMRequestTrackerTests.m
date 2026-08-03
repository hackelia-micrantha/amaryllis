#import <Foundation/Foundation.h>
#import "../AMRequestTracker.h"

static void Assert(BOOL condition, NSString *message) {
  if (!condition) {
    NSLog(@"FAILED: %@", message);
    exit(1);
  }
}

int main(void) {
  @autoreleasepool {
    AMRequestTracker *tracker = [[AMRequestTracker alloc] init];

    Assert([tracker tryStart:@"first"], @"first request should start");
    Assert(![tracker tryStart:@"second"], @"overlap should be rejected");
    Assert(![tracker clear:@"other"], @"unrelated cancellation should be ignored");
    Assert([tracker owns:@"first"], @"first request should remain active");
    Assert([tracker clear:@"first"], @"owner should clear request");
    Assert(![tracker clear:@"first"], @"late completion should be ignored");
    Assert([tracker tryStart:@"second"], @"restart after completion should succeed");
    Assert(![tracker clear:@"first"], @"stale completion must not clear newer request");
    Assert([tracker owns:@"second"], @"second request should remain active");

    [tracker clearAll];
    Assert(![tracker owns:@"second"], @"close should clear active request");
    Assert([tracker tryStart:@"third"], @"restart after close should succeed");
    [tracker clearAll];

    dispatch_group_t group = dispatch_group_create();
    dispatch_queue_t queue = dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0);
    NSLock *lock = [[NSLock alloc] init];
    __block NSInteger winners = 0;

    for (NSString *requestId in @[ @"a", @"b" ]) {
      dispatch_group_async(group, queue, ^{
        if ([tracker tryStart:requestId]) {
          [lock lock];
          winners += 1;
          [lock unlock];
        }
      });
    }

    dispatch_group_wait(group, DISPATCH_TIME_FOREVER);
    Assert(winners == 1, @"concurrent starts should have exactly one winner");
  }

  return 0;
}
