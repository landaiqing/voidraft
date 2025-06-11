import { getSearchQuery, search, SearchQuery } from "@codemirror/search";
import { EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { CustomSearchPanel } from "./FindReplaceControl";
import { SearchVisibilityEffect } from "./state";
import { searchBaseTheme } from "./theme";


export class SearchPlugin {
    private searchControl: CustomSearchPanel;
    private prevQuery: SearchQuery | null = null;

    constructor(view: EditorView) {
        this.searchControl = new CustomSearchPanel(view);
    }

    update(update: ViewUpdate) {
        const currentQuery = getSearchQuery(update.state);
        if (!this.prevQuery || !currentQuery.eq(this.prevQuery)) {
            this.searchControl.findMatchesAndSelectClosest(update.state);
        }
        this.prevQuery = currentQuery;

        for (let tr of update.transactions) {
          for (let e of tr.effects) {
            if (e.is(SearchVisibilityEffect)) {
              this.searchControl.setVisibility(e.value);
            }
          }
        }
    }

    destroy() {
        this.searchControl.dom.remove(); // Clean up
    }

    toggleCaseInsensitive() {
        this.searchControl.toggleCase();
    }

    toggleWholeWord() {
        this.searchControl.toggleWord();
    }

    toggleRegex() {
        this.searchControl.toggleRegex();
    }

    showReplace() {
        this.searchControl.setVisibility(true);
        this.searchControl.showReplace();
    }

    findReplaceMatch() {
        this.searchControl.findReplaceMatch();
    }

    findNext() {
        this.searchControl.matchNext()
    }

    replace() {
        this.searchControl.replace()
    }

    replaceAll() {
        this.searchControl.replaceAll()
    }

    findPrevious() {
        this.searchControl.matchPrevious()
    }
}

export const VSCodeSearch = ViewPlugin.fromClass(SearchPlugin);

export const vscodeSearch = [
    search({}),
    VSCodeSearch,
    searchBaseTheme
]