import { search } from "@codemirror/search";
import { EditorView, Panel } from "@codemirror/view";
import { StateEffect } from "@codemirror/state";
import { createApp, App } from "vue";
import SearchPanel from "./SearchPanel.vue";

/**
 * Create custom search panel using Vue component
 * This integrates directly with CodeMirror's search extension
 */
function createSearchPanel(view: EditorView): Panel {
    const dom = document.createElement("div");
    dom.className = "vscode-search-container";
    
    let app: App | null = null;
    
    return {
        dom,
        top: true,
        mount() {
            // Mount Vue component after panel is added to DOM
            app = createApp(SearchPanel, { view });
            app.mount(dom);
        },
        destroy() {
            // Cleanup Vue component
            app?.unmount();
            app = null;
        }
    };
}

/**
 * Custom scroll behavior - scroll match to center of viewport
 * This is called automatically by findNext/findPrevious
 */
function scrollMatchToCenter(range: { from: number }, view: EditorView): StateEffect<unknown> {
    return EditorView.scrollIntoView(range.from, { y: 'center' });
}

/**
 * VSCode-style search extension
 * Uses CodeMirror's built-in search with custom Vue UI
 * 
 * Config options set default values for search query:
 * - caseSensitive: false (default) - match case
 * - wholeWord: false (default) - match whole word
 * - regexp: false (default) - use regular expression
 * - literal: false (default) - literal string search
 */
export const vscodeSearch = [
    search({ 
        createPanel: createSearchPanel,
        top: true,
        scrollToMatch: scrollMatchToCenter,
        caseSensitive: false,
        wholeWord: false,
        regexp: false,
        literal: false,
    }),
];

// Re-export for backwards compatibility
export { vscodeSearch as VSCodeSearch };
