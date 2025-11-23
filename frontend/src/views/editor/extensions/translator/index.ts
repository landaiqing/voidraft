import { Extension, StateField } from '@codemirror/state';
import { EditorView, showTooltip, Tooltip } from '@codemirror/view';
import { translatorManager } from './manager';
import { TRANSLATION_ICON_SVG } from '@/common/constant/translation';

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