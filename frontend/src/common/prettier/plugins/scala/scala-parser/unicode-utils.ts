/**
 * Unicode utilities for Scala parser
 * Handles Unicode normalization and character validation
 */

/**
 * Normalizes Unicode strings using NFC (Canonical Decomposition, followed by Canonical Composition)
 * This ensures consistent representation of Unicode characters.
 *
 * @param text - The input text to normalize
 * @returns The normalized text
 */
export function normalizeUnicode(text: string): string {
  return text.normalize("NFC");
}

/**
 * Checks if a character is a valid Scala identifier start character
 * Follows Unicode identifier specification for Scala
 *
 * @param char - The character to check
 * @returns True if the character can start an identifier
 */
export function isIdentifierStart(char: string): boolean {
  if (char.length !== 1) return false;

  const codePoint = char.codePointAt(0);
  if (codePoint === undefined) return false;

  // Basic ASCII identifier characters
  if (
    (codePoint >= 0x41 && codePoint <= 0x5a) || // A-Z
    (codePoint >= 0x61 && codePoint <= 0x7a) || // a-z
    codePoint === 0x5f || // _
    codePoint === 0x24
  ) {
    // $
    return true;
  }

  // Mathematical symbols range (extended)
  if (
    (codePoint >= 0x2200 && codePoint <= 0x22ff) || // Mathematical Operators
    (codePoint >= 0x27c0 && codePoint <= 0x27ef) || // Miscellaneous Mathematical Symbols-A
    (codePoint >= 0x2980 && codePoint <= 0x29ff) || // Miscellaneous Mathematical Symbols-B
    (codePoint >= 0x2a00 && codePoint <= 0x2aff)
  ) {
    // Supplemental Mathematical Operators
    return true;
  }

  // Use Unicode property test for other characters (excluding digits for start characters)
  const testRegex = /\p{L}|\p{Mn}|\p{Mc}|\p{Pc}/u;
  return testRegex.test(char);
}

/**
 * Checks if a character is a valid Scala identifier continuation character
 *
 * @param char - The character to check
 * @returns True if the character can continue an identifier
 */
export function isIdentifierContinue(char: string): boolean {
  if (char.length !== 1) return false;

  const codePoint = char.codePointAt(0);
  if (codePoint === undefined) return false;

  // Basic ASCII identifier characters
  if (
    (codePoint >= 0x41 && codePoint <= 0x5a) || // A-Z
    (codePoint >= 0x61 && codePoint <= 0x7a) || // a-z
    (codePoint >= 0x30 && codePoint <= 0x39) || // 0-9
    codePoint === 0x5f || // _
    codePoint === 0x24
  ) {
    // $
    return true;
  }

  // Mathematical symbols range (extended)
  if (
    (codePoint >= 0x2200 && codePoint <= 0x22ff) || // Mathematical Operators
    (codePoint >= 0x27c0 && codePoint <= 0x27ef) || // Miscellaneous Mathematical Symbols-A
    (codePoint >= 0x2980 && codePoint <= 0x29ff) || // Miscellaneous Mathematical Symbols-B
    (codePoint >= 0x2a00 && codePoint <= 0x2aff)
  ) {
    // Supplemental Mathematical Operators
    return true;
  }

  // Use Unicode property test for other characters (including format characters)
  const testRegex = /\p{L}|\p{Mn}|\p{Mc}|\p{Nd}|\p{Pc}|\p{Cf}/u;
  return testRegex.test(char);
}

/**
 * Validates that a string is a valid Scala identifier
 *
 * @param identifier - The identifier string to validate
 * @returns True if the string is a valid identifier
 */
export function isValidIdentifier(identifier: string): boolean {
  if (!identifier || identifier.length === 0) return false;

  // Normalize the identifier
  const normalized = normalizeUnicode(identifier);

  // Check first character
  if (!isIdentifierStart(normalized[0])) return false;

  // Check remaining characters
  for (let i = 1; i < normalized.length; i++) {
    if (!isIdentifierContinue(normalized[i])) return false;
  }

  return true;
}

/**
 * Converts Unicode escape sequences in strings to actual Unicode characters
 * Handles \uXXXX patterns in string literals
 *
 * @param text - The text containing Unicode escapes
 * @returns The text with Unicode escapes converted to actual characters
 */
export function processUnicodeEscapes(text: string): string {
  return text.replace(/\\u([0-9A-Fa-f]{4})/g, (_, hex) => {
    const codePoint = parseInt(hex, 16);
    return String.fromCharCode(codePoint);
  });
}

/**
 * Escapes Unicode characters in strings for safe output
 * Converts non-ASCII characters back to \uXXXX format if needed
 *
 * @param text - The text to escape
 * @param escapeNonAscii - Whether to escape all non-ASCII characters
 * @returns The escaped text
 */
export function escapeUnicode(text: string, escapeNonAscii = false): string {
  if (!escapeNonAscii) return text;

  return text.replace(/[\u0080-\uFFFF]/g, (char) => {
    const codePoint = char.charCodeAt(0);
    return `\\u${codePoint.toString(16).padStart(4, "0").toUpperCase()}`;
  });
}

/**
 * Extended mathematical symbols commonly used in Scala functional programming
 */
export const MATHEMATICAL_SYMBOLS = {
  // Greek letters commonly used in functional programming
  ALPHA: "α", // U+03B1
  BETA: "β", // U+03B2
  GAMMA: "γ", // U+03B3
  DELTA: "δ", // U+03B4
  LAMBDA: "λ", // U+03BB
  MU: "μ", // U+03BC
  PI: "π", // U+03C0
  SIGMA: "σ", // U+03C3
  TAU: "τ", // U+03C4
  PHI: "φ", // U+03C6

  // Mathematical operators
  FORALL: "∀", // U+2200
  EXISTS: "∃", // U+2203
  ELEMENT_OF: "∈", // U+2208
  NOT_ELEMENT_OF: "∉", // U+2209
  SUBSET: "⊂", // U+2282
  SUPERSET: "⊃", // U+2283
  UNION: "∪", // U+222A
  INTERSECTION: "∩", // U+2229

  // Arrows and other symbols
  RIGHTWARDS_ARROW: "→", // U+2192
  LEFTWARDS_ARROW: "←", // U+2190
  UP_ARROW: "↑", // U+2191
  DOWN_ARROW: "↓", // U+2193
} as const;
