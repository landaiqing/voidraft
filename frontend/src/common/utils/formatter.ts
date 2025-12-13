/**
 * Formatter utility functions
 */

export interface DateTimeFormatOptions {
  locale?: string;
  includeTime?: boolean;
  hour12?: boolean;
}

/**
 * Format date time string to localized format
 * @param dateString - ISO date string or null
 * @param options - Formatting options
 * @returns Formatted date string or error message
 */
export const formatDateTime = (
  dateString: string | null,
  options: DateTimeFormatOptions = {}
): string => {
  const {
    locale = 'en-US',
    includeTime = true,
    hour12 = false
  } = options;

  if (!dateString) {
    return 'Unknown time';
  }

  try {
    const date = new Date(dateString);
    
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }

    const formatOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    };

    if (includeTime) {
      formatOptions.hour = '2-digit';
      formatOptions.minute = '2-digit';
      formatOptions.hour12 = hour12;
    }

    return date.toLocaleString(locale, formatOptions);
  } catch {
    return 'Time error';
  }
};

/**
 * Truncate string with ellipsis
 * @param str - String to truncate
 * @param maxLength - Maximum length before truncation
 * @returns Truncated string with ellipsis if needed
 */
export const truncateString = (str: string, maxLength: number): string => {
  if (!str) return '';
  return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
};
