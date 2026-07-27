import type { TransformFnParams } from 'class-transformer';

/**
 * Normalizes a repeatable query param into a `string[]`. Express/Nest
 * hands back `undefined` when the param is absent, a single string when it
 * appears once (`?category=A`), or a string[] when it appears more than
 * once (`?category=A&category=B`) — the classic gotcha for this kind of
 * param. Each value is also split on commas, so `?category=A,B` is
 * accepted as an equivalent shorthand for repeating the param.
 */
export function toStringArray({ value }: TransformFnParams): string[] {
  if (value === undefined || value === null || value === '') return [];

  const values: unknown[] = Array.isArray(value) ? value : [value];

  return values
    .flatMap((entry) => String(entry).split(','))
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}
