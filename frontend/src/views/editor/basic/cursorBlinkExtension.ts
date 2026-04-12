import { Compartment, type Extension } from '@codemirror/state';
import { drawSelection, type EditorView } from '@codemirror/view';

export const cursorBlinkCompartment = new Compartment();

const DEFAULT_CURSOR_BLINK_RATE = 1000;

function normalizeCursorBlinkRate(rate?: number): number {
    if (!Number.isFinite(rate)) {
        return DEFAULT_CURSOR_BLINK_RATE;
    }

    const nextRate = Math.round(rate ?? DEFAULT_CURSOR_BLINK_RATE);
    return Math.max(0, Math.min(2000, nextRate));
}

function createCursorBlinkConfig(rate?: number): Extension {
    return drawSelection({
        cursorBlinkRate: normalizeCursorBlinkRate(rate),
    });
}

export function createCursorBlinkExtension(rate?: number): Extension {
    return cursorBlinkCompartment.of(createCursorBlinkConfig(rate));
}

export function updateCursorBlinkRate(view: EditorView, rate?: number): void {
    view.dispatch({
        effects: cursorBlinkCompartment.reconfigure(createCursorBlinkConfig(rate)),
    });
}
