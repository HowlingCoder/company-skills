/**
 * Hue (0-359) for a skill, derived from its name with the FNV-1a hash. The same name always
 * gives the same hue, independent of upper and lower case.
 */
export function skillHue(name: string): number {
  let hash = 0x811c9dc5;
  for (const char of name.trim().toLowerCase()) {
    hash ^= char.codePointAt(0)!;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % 360;
}
