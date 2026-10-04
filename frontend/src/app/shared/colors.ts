/**
 * Identity colors (avatars, project marks), Linear-style: each person / project always gets the
 * same color, derived from its id. Every color keeps white text readable (contrast ≥ 4.5:1) in the
 * light and the dark theme.
 */
export const IDENTITY_COLORS: readonly string[] = [
  '#5e6ad2', // indigo
  '#0f766e', // teal
  '#b45309', // amber
  '#9333ea', // purple
  '#1d6fd1', // blue
  '#be185d', // pink
  '#15803d', // green
  '#6d28d9', // violet
];

/** Stable color for a key (id or name): a simple string hash picks one of the palette entries. */
export function identityColor(key: string): string {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return IDENTITY_COLORS[Math.abs(hash) % IDENTITY_COLORS.length];
}

/** "Sara Manager" → "SM"; "E-commerce platform" → "E" (one letter when there is one word). */
export function initials(...parts: (string | null | undefined)[]): string {
  const words = parts.flatMap((part) => (part ?? '').trim().split(/\s+/)).filter(Boolean);
  if (words.length === 0) return '?';
  const letters = words.length === 1 ? words[0][0] : words[0][0] + words[words.length - 1][0];
  return letters.toUpperCase();
}
