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
    Assert(![tracker requestCancellation:@"other"],
           @"unrelated cancellation should be ignored");
    Assert([tracker requestCancellation:@"first"],
           @"owner cancellation should transition state");
    Assert([tracker owns:@"first"], @"cancellation should retain ownership");
    Assert([tracker isCancelling:@"first"],
           @"request should be marked cancelling");
    Assert(![tracker tryStart:@"second"],
           @"cancelling request should still reject overlap");
    Assert(![tracker requestCancellation:@"first"],
           @"repeated cancellation should be idempotent");
    Assert([tracker settle:@"first"] == AMRequestStateCancelling,
           @"terminal settlement should report cancellation state");
    Assert(![tracker owns:@"first"],
           @"terminal settlement should release ownership");

    Assert([tracker tryStart:@"second"],
           @"restart after terminal settlement should succeed");
    Assert([tracker requestCancellation:@"second"],
           @"second request should enter cancelling");
    Assert([tracker restoreGenerating:@"second"],
           @"failed cancellation should restore generating");
    Assert(![tracker isCancelling:@"second"],
           @"restored request should no longer be cancelling");
    Assert([tracker settle:@"second"] == AMRequestStateGenerating,
           @"restored request should settle as generating");

    Assert([tracker tryStart:@"third"], @"third request should start");
    Assert([tracker settle:@"third"] == AMRequestStateGenerating,
           @"normal completion should report generating state");
    Assert([tracker tryStart:@"fourth"], @"fourth request should start");
    Assert([tracker settle:@"third"] == AMRequestStateNone,
           @"stale completion must not clear newer request");
    Assert([tracker owns:@"fourth"], @"newer request should remain active");

    [tracker clearAll];
    Assert(![tracker owns:@"fourth"], @"close should clear active request");
    Assert([tracker tryStart:@"fifth"], @"restart after close should succeed");
    [tracker clearAll];

    dispatch_group_t group = dispatch_group_create();
    dispatch_queue_t queue =
        dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0);
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
