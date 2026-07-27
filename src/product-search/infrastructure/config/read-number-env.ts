import type { ConfigService } from '@nestjs/config';

/**
 * `ConfigService#get` returns whatever's in `process.env`, which is always
 * a string (or the literal fallback passed in) — reading a numeric env var
 * needs an explicit parse. An unset/empty value falls back silently (the
 * normal case); a non-numeric value also falls back rather than
 * propagating `NaN` into request handling, since that's a configuration
 * mistake, not something that should manifest as broken search behavior.
 */
export function readNumberEnv(
  config: ConfigService,
  key: string,
  fallback: number,
): number {
  const raw = config.get<string>(key);
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}
