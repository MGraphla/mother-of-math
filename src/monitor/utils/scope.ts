/**
 * Scope configuration for the partner monitor.
 *
 * The monitoring dashboard is currently scoped to **Nigeria** for the
 * implementing partner that operates there. Every data getter in
 * `services/monitorData.ts` filters down to Nigerian teachers (and the
 * students / lesson plans / assignments / chats / images / uploads they
 * own) before returning anything. UI components surface this scope to
 * the partner so they always know what they are looking at.
 */

export const SCOPE_COUNTRY_NAME = 'Nigeria';

/**
 * Country values we consider "Nigeria" when matching the
 * `profiles.country` / `schools.country` columns. The data is free-text in
 * many rows so we accept the most common variants.
 */
export const NIGERIA_LABELS = new Set([
  'nigeria',
  'nigerian',
  'ng',
  'nga',
  'federal republic of nigeria',
]);

export const isNigerianCountry = (raw: string | null | undefined): boolean => {
  if (!raw) return false;
  return NIGERIA_LABELS.has(raw.trim().toLowerCase());
};
