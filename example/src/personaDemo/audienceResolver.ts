export type Audience =
  | 'developer'
  | 'security_reviewer'
  | 'hiring_manager'
  | 'open_source_contributor'
  | 'founder_customer'
  | 'unknown';

export type AudienceSource = 'query' | 'manual' | 'route';

export type AudienceHint = Readonly<{
  audience: Audience;
  source: AudienceSource;
}>;

export type AudienceResolution = Readonly<{
  audience: Audience;
  confidence: 0 | 1;
  hints: readonly AudienceHint[];
  resolvedBy: readonly AudienceSource[];
  reason:
    | 'explicit-query'
    | 'explicit-manual'
    | 'route-default'
    | 'neutral-default';
}>;

// The route adapter supplies decoded occurrences of the audience parameter
// only. No URL, storage, inference or navigation authority is held here.
type AudienceInputs = Readonly<{
  queryValues?: readonly unknown[];
  manual?: unknown;
  routeDefault?: unknown;
}>;

function admitAudience(value: unknown): Audience | undefined {
  switch (value) {
    case 'developer':
    case 'security_reviewer':
    case 'hiring_manager':
    case 'open_source_contributor':
    case 'founder_customer':
    case 'unknown':
      return value;
    default:
      return undefined;
  }
}

const reasons = {
  query: 'explicit-query',
  manual: 'explicit-manual',
  route: 'route-default',
} as const;

export function resolveAudience({
  queryValues,
  manual,
  routeDefault,
}: AudienceInputs): AudienceResolution {
  const candidates = [
    {
      source: 'query',
      audience:
        queryValues?.length === 1 ? admitAudience(queryValues[0]) : undefined,
    },
    { source: 'manual', audience: admitAudience(manual) },
    { source: 'route', audience: admitAudience(routeDefault) },
  ] as const;

  const hints: AudienceHint[] = [];
  for (const { audience, source } of candidates) {
    if (audience !== undefined) {
      hints.push({ audience, source });
    }
  }

  const winner = hints[0];
  const audience = winner?.audience ?? 'unknown';

  return {
    audience,
    confidence: audience === 'unknown' ? 0 : 1,
    hints,
    resolvedBy: winner ? [winner.source] : [],
    reason: winner ? reasons[winner.source] : 'neutral-default',
  };
}
