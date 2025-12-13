import { Extension, StateField } from '@codemirror/state';
import { EditorView, showTooltip, Tooltip } from '@codemirror/view';
import { translatorManager } from './manager';

const TRANSLATION_ICON_SVG = `
<svg class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="24" height="24">
  <path d="M599.68 485.056h-8l30.592 164.672c20.352-7.04 38.72-17.344 54.912-31.104a271.36 271.36 0 0 1-40.704-64.64l32.256-4.032c8.896 17.664 19.072 33.28 30.592 46.72 23.872-27.968 42.24-65.152 55.04-111.744l-154.688 0.128z m121.92 133.76c18.368 15.36 39.36 26.56 62.848 33.472l14.784 4.416-8.64 30.336-14.72-4.352a205.696 205.696 0 0 1-76.48-41.728c-20.672 17.92-44.928 31.552-71.232 40.064l20.736 110.912H519.424l-9.984 72.512h385.152c18.112 0 32.704-14.144 32.704-31.616V295.424a32.128 32.128 0 0 0-32.704-31.552H550.528l35.2 189.696h79.424v-31.552h61.44v31.552h102.4v31.616h-42.688c-14.272 55.488-35.712 100.096-64.64 133.568zM479.36 791.68H193.472c-36.224 0-65.472-28.288-65.472-63.168V191.168C128 156.16 157.312 128 193.472 128h327.68l20.544 104.32h352.832c36.224 0 65.472 28.224 65.472 63.104v537.408c0 34.944-29.312 63.168-65.472 63.168H468.608l10.688-104.32zM337.472 548.352v-33.28H272.768v-48.896h60.16V433.28h-60.16v-41.728h64.704v-32.896h-102.4v189.632h102.4z m158.272 0V453.76c0-17.216-4.032-30.272-12.16-39.488-8.192-9.152-20.288-13.696-36.032-13.696a55.04 55.04 0 0 0-24.768 5.376 39.04 39.04 0 0 0-17.088 15.936h-1.984l-5.056-18.56h-28.352V548.48h37.12V480c0-17.088 2.304-29.376 6.912-36.736 4.608-7.424 12.16-11.072 22.528-11.072 7.616 0 13.248 2.56 16.64 7.872 3.52 5.248 5.312 13.056 5.312 23.488v84.736h36.928z" fill="currentColor"></path>
</svg>`;

function TranslationTooltips(state: any): readonly Tooltip[] {
  const selection = state.selection.main;
  if (selection.empty) return [];
  
  const selectedText = state.sliceDoc(selection.from, selection.to);
  if (!selectedText.trim()) return [];
  
  return [{
    pos: selection.to,
    above: false,
    strictSide: true,
    arrow: false,
    create: (view) => {
      const dom = document.createElement('div');
      dom.className = 'cm-translator-button';
      dom.innerHTML = TRANSLATION_ICON_SVG;

      dom.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showTranslatorDialog(view);
      });

      return { dom };
    }
  }];
}

function showTranslatorDialog(view: EditorView) {
  const selection = view.state.selection.main;
  if (selection.empty) return;
  
  const selectedText = view.state.sliceDoc(selection.from, selection.to);
  if (!selectedText.trim()) return;
  
  const coords = view.coordsAtPos(selection.to);
  if (!coords) return;
  
  translatorManager.show(view, coords.left, coords.bottom + 5, selectedText);
}

const translationButtonField = StateField.define<readonly Tooltip[]>({
  create: (state) => TranslationTooltips(state),
  update: (tooltips, tr) => {
    if (tr.docChanged || tr.selection) {
      return TranslationTooltips(tr.state);
    }
    return tooltips;
  },
  provide: field => showTooltip.computeN([field], state => state.field(field))
});

export function createTranslatorExtension(): Extension {
  return [
    translationButtonField,
    EditorView.baseTheme({
      ".cm-translator-button": {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        background: "var(--bg-secondary, transparent)",
        color: "var(--text-muted, #4285f4)",
        border: "1px solid var(--border-color, #dadce0)",
        borderRadius: "3px",
        padding: "2px",
        width: "24px",
        height: "24px",
        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.08)",
        userSelect: "none",
        "&:hover": {
          background: "var(--bg-hover, rgba(66, 133, 244, 0.1))"
        }
      }
    })
  ];
}

export default createTranslatorExtension;