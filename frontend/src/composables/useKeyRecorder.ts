import { ref, onUnmounted, readonly, type Ref, type DeepReadonly } from 'vue';

export interface KeyRecorderState {
  /** The binding ID currently being recorded */
  bindingId: number;
  /** Internal key string result (e.g. "Mod-Shift-k") */
  result: string;
  /** Display parts for UI (e.g. ["Ctrl", "Shift", "K"]) */
  displayParts: string[];
  /** Whether a non-modifier key has been captured (recording complete) */
  completed: boolean;
}

export interface UseKeyRecorderOptions {
  isMacOS: boolean;
  onComplete?: (bindingId: number, keyString: string) => void;
  onCancel?: (bindingId: number) => void;
}

export interface UseKeyRecorderReturn {
  recording: DeepReadonly<Ref<KeyRecorderState | null>>;
  isRecording: (bindingId: number) => boolean;
  startRecording: (bindingId: number) => void;
  stopRecording: () => void;
}

const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta']);

const KEY_DISPLAY_MAP: Record<string, string> = {
  'ArrowUp': '↑',
  'ArrowDown': '↓',
  'ArrowLeft': '←',
  'ArrowRight': '→',
  ' ': 'Space',
};

const MAC_MODIFIER_DISPLAY: Record<string, string> = {
  'Mod': '⌘',
  'Alt': '⌥',
  'Shift': '⇧',
  'Ctrl': '⌃',
};

function normalizeKey(key: string): string {
  if (key === ' ') return 'Space';
  if (key.length === 1) return key.toLowerCase();
  return key;
}

function getDisplayKey(key: string, isMacOS: boolean): string {
  if (isMacOS && MAC_MODIFIER_DISPLAY[key]) return MAC_MODIFIER_DISPLAY[key];
  if (KEY_DISPLAY_MAP[key]) return KEY_DISPLAY_MAP[key];
  if (key.length === 1) return key.toUpperCase();
  return key;
}

/**
 * Composable for capturing keyboard shortcuts via keydown events.
 * Captures the full key combination (modifiers + main key) in a single interaction.
 */
export function useKeyRecorder(options: UseKeyRecorderOptions): UseKeyRecorderReturn {
  const { isMacOS, onComplete, onCancel } = options;

  const recording = ref<KeyRecorderState | null>(null);

  const buildParts = (e: KeyboardEvent): { internalParts: string[]; displayParts: string[] } => {
    const internalParts: string[] = [];
    const displayParts: string[] = [];

    const hasCtrlOrMeta = e.ctrlKey || e.metaKey;
    if (hasCtrlOrMeta) {
      internalParts.push('Mod');
      displayParts.push(getDisplayKey('Mod', isMacOS));
    }

    if (e.altKey) {
      internalParts.push('Alt');
      displayParts.push(getDisplayKey('Alt', isMacOS));
    }

    if (e.shiftKey) {
      internalParts.push('Shift');
      displayParts.push(getDisplayKey('Shift', isMacOS));
    }

    return { internalParts, displayParts };
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (!recording.value) return;

    e.preventDefault();
    e.stopPropagation();

    const { internalParts, displayParts } = buildParts(e);

    if (MODIFIER_KEYS.has(e.key)) {
      recording.value = {
        ...recording.value,
        result: '',
        displayParts,
        completed: false,
      };
      return;
    }

    const mainKey = normalizeKey(e.key);
    internalParts.push(mainKey);
    displayParts.push(getDisplayKey(e.key, isMacOS));

    const keyString = internalParts.join('-');

    recording.value = {
      ...recording.value,
      result: keyString,
      displayParts,
      completed: true,
    };

    const bindingId = recording.value.bindingId;
    cleanup();
    recording.value = null;
    onComplete?.(bindingId, keyString);
  };

  const onKeyUp = (e: KeyboardEvent) => {
    if (!recording.value) return;
    e.preventDefault();
    e.stopPropagation();
  };

  const preventDefaults = (e: KeyboardEvent) => {
    if (!recording.value) return;
    e.preventDefault();
    e.stopPropagation();
  };

  const cleanup = () => {
    document.removeEventListener('keydown', onKeyDown, true);
    document.removeEventListener('keyup', onKeyUp, true);
    document.removeEventListener('keypress', preventDefaults, true);
  };

  const startRecording = (bindingId: number) => {
    cleanup();

    recording.value = {
      bindingId,
      result: '',
      displayParts: [],
      completed: false,
    };

    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('keyup', onKeyUp, true);
    document.addEventListener('keypress', preventDefaults, true);
  };

  const stopRecording = () => {
    cleanup();
    recording.value = null;
  };

  const isRecording = (bindingId: number): boolean => {
    return recording.value?.bindingId === bindingId;
  };

  onUnmounted(cleanup);

  return {
    recording: readonly(recording) as DeepReadonly<Ref<KeyRecorderState | null>>,
    isRecording,
    startRecording,
    stopRecording,
  };
}
