/**
 * Validation utility functions
 */

/**
 * Validate document title
 * @param title - The title to validate
 * @param maxLength - Maximum allowed length (default: 50)
 * @returns Error message if invalid, null if valid
 */
export const validateDocumentTitle = (title: string, maxLength: number = 50): string | null => {
  const trimmed = title.trim();
  
  if (!trimmed) {
    return 'Document name cannot be empty';
  }
  
  if (trimmed.length > maxLength) {
    return `Document name cannot exceed ${maxLength} characters`;
  }
  
  return null;
};

/**
 * Check if a string is empty or whitespace only
 * @param value - The string to check
 * @returns true if empty or whitespace only
 */
export const isEmpty = (value: string | null | undefined): boolean => {
  return !value || value.trim().length === 0;
};

/**
 * Check if a string exceeds max length
 * @param value - The string to check
 * @param maxLength - Maximum allowed length
 * @returns true if exceeds max length
 */
export const exceedsMaxLength = (value: string, maxLength: number): boolean => {
  return value.trim().length > maxLength;
};
