import * as runtime from '@wailsio/runtime';

/**
 * Titlebar utility functions
 */

// Window control functions
export const minimizeWindow = async () => {
  try {
    await runtime.Window.Minimise();
  } catch (error) {
    console.error('Failed to minimize window:', error);
  }
};

export const toggleMaximize = async () => {
  try {
    await runtime.Window.ToggleMaximise();
  } catch (error) {
    console.error('Failed to toggle maximize:', error);
  }
};

export const closeWindow = async () => {
  try {
    await runtime.Window.Close();
  } catch (error) {
    console.error('Failed to close window:', error);
  }
};

export const getMaximizedState = async (): Promise<boolean> => {
  try {
    return await runtime.Window.IsMaximised();
  } catch (error) {
    console.error('Failed to check maximized state:', error);
    return false;
  }
};

/**
 * Generate title text with optional truncation
 */
export const generateTitleText = (
  title: string | undefined,
  maxLength: number = 30
): string => {
  if (!title) return 'voidraft';
  const truncated = title.length > maxLength
    ? title.substring(0, maxLength) + '...'
    : title;
  return `voidraft - ${truncated}`;
};

/**
 * Generate full title text (no truncation)
 */
export const generateFullTitleText = (title: string | undefined): string => {
  return title ? `voidraft - ${title}` : 'voidraft';
};
