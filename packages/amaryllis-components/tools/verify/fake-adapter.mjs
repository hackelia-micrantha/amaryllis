function scriptedError(failure, phase, iteration) {
  if (!failure || failure.phase !== phase) {
    return null;
  }
  if (failure.iteration !== undefined && failure.iteration !== iteration) {
    return null;
  }

  const error = new Error(failure.message ?? `fake adapter ${phase} failure`);
  error.code = failure.code ?? `fake-${phase}-failure`;
  return error;
}

async function delay(milliseconds, signal) {
  if (!milliseconds || milliseconds <= 0) {
    return;
  }
  if (signal?.aborted) {
    throw signal.reason instanceof Error ? signal.reason : new Error('operation aborted');
  }

  await new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason instanceof Error ? signal.reason : new Error('operation aborted'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    timer.unref?.();
  });
}

export class FakePlatformAdapter {
  constructor(script) {
    this.script = structuredClone(script ?? {});
    this.calls = [];
  }

  async capabilities(signal) {
    this.calls.push({ phase: 'capabilities' });
    await delay(this.script.delays?.capabilitiesMs, signal);
    const failure = scriptedError(this.script.failure, 'capabilities');
    if (failure) throw failure;

    return {
      environment: structuredClone(this.script.environment),
      collectors: structuredClone(this.script.collectors ?? []),
      evaluationSuites: structuredClone(this.script.evaluationSuites ?? []),
    };
  }

  async prepare(context, signal) {
    this.calls.push({ phase: 'prepare', fixtureCount: context.fixtures.size });
    await delay(this.script.delays?.prepareMs, signal);
    const failure = scriptedError(this.script.failure, 'prepare');
    if (failure) throw failure;
  }

  async warmup(_context, iteration, signal) {
    this.calls.push({ phase: 'warmup', iteration });
    await delay(this.script.delays?.warmupMs, signal);
    const failure = scriptedError(this.script.failure, 'warmup', iteration);
    if (failure) throw failure;
  }

  async execute(_context, iteration, signal) {
    this.calls.push({ phase: 'execute', iteration });
    await delay(this.script.delays?.executeMs, signal);
    const failure = scriptedError(this.script.failure, 'execute', iteration);
    if (failure) throw failure;

    return structuredClone(this.script.iterations?.[iteration - 1] ?? {});
  }

  async cleanup(_context, signal) {
    this.calls.push({ phase: 'cleanup' });
    await delay(this.script.delays?.cleanupMs, signal);
    const failure = scriptedError(this.script.failure, 'cleanup');
    if (failure) throw failure;
  }
}
