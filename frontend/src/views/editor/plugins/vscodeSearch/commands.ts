import { Command } from "@codemirror/view";
import { simulateBackspace } from "./utility";
import { cursorCharLeft, cursorCharRight, deleteCharBackward, deleteCharForward } from "@codemirror/commands";
import { SearchVisibilityEffect } from "./state";
import { VSCodeSearch } from "./plugin";

const isSearchActive = () : boolean => {
    if (document.activeElement){
        return document.activeElement.classList.contains('find-input');
    }
    return false;
}

const isReplaceActive = () : boolean => {
    if (document.activeElement){
        return document.activeElement.classList.contains('replace-input');
    }
    return false;
}

export const selectAllCommand: Command = (view) => {
    if (isSearchActive() || isReplaceActive()) {
        (document.activeElement as HTMLInputElement).select();
        return true;
    }
    else {
        view.dispatch({
            selection: { anchor: 0, head: view.state.doc.length }
        })
        return true;
    }
};

export const deleteCharacterBackwards: Command = (view) => {
    if (isSearchActive() || isReplaceActive()) {
        simulateBackspace(document.activeElement as HTMLInputElement);
        return true;
    }
    else {
        deleteCharBackward(view)
        return true;
    }
};

export const deleteCharacterFowards: Command = (view) => {
    if (isSearchActive() || isReplaceActive()) {
        simulateBackspace(document.activeElement as HTMLInputElement, "forward");
        return true;
    }
    else {
        deleteCharForward(view)
        return true;
    }
};

export const showSearchVisibilityCommand: Command = (view) => {
    console.log("SHOW");
    view.dispatch({
      effects: SearchVisibilityEffect.of(true) // Dispatch the effect to show the search
    });
    
    // 延迟聚焦，确保DOM已经更新
    setTimeout(() => {
        const searchInput = view.dom.querySelector('.find-input') as HTMLInputElement;
        if (searchInput) {
            searchInput.focus();
            searchInput.select();
        }
    }, 10);
    
    return true;
};

export const searchMoveCursorLeft: Command = (view) => {
    if (isSearchActive() || isReplaceActive()) {
        const input = document.activeElement as HTMLInputElement
        const pos = input.selectionStart ?? 0;
        if (pos > 0) {
            input.selectionStart = input.selectionEnd = pos - 1;
        }
        return true;
    }
    else {
        cursorCharLeft(view)
        return true;
    }
}

export const searchMoveCursorRight: Command = (view) => {
    if (isSearchActive() || isReplaceActive()) {
        const input = document.activeElement as HTMLInputElement
        const pos = input.selectionStart ?? 0;
        if (pos < input.value.length) {
            input.selectionStart = input.selectionEnd = pos + 1;
        }
        return true;
    }
    else {
        cursorCharRight(view)
        return true;
    }
}

export const hideSearchVisibilityCommand: Command = (view) => {
    view.dispatch({
      effects: SearchVisibilityEffect.of(false) // Dispatch the effect to hide the search
    });
    return true;
};

export const searchToggleCase: Command = (view) => {
    const plugin = view.plugin(VSCodeSearch)

    if (!plugin) return false;

    plugin.toggleCaseInsensitive();
    return true;
}

export const searchToggleWholeWord: Command = (view) => {
    const plugin = view.plugin(VSCodeSearch)

    if (!plugin) return false;

    plugin.toggleWholeWord();
    return true;
}

export const searchToggleRegex: Command = (view) => {
    const plugin = view.plugin(VSCodeSearch)

    if (!plugin) return false;

    plugin.toggleRegex();
    return true;
}

export const searchShowReplace: Command = (view) => {
    const plugin = view.plugin(VSCodeSearch)

    if (!plugin) return false;

    plugin.showReplace();
    return true;
}

export const searchFindReplaceMatch: Command = (view) => {
    const plugin = view.plugin(VSCodeSearch)

    if (!plugin) return false;

    plugin.findReplaceMatch();
    return true;
}

export const searchFindPrevious: Command = (view) => {
    const plugin = view.plugin(VSCodeSearch)

    if (!plugin) return false;

    plugin.findPrevious();
    return true;
}

export const searchReplaceAll: Command = (view) => {
    const plugin = view.plugin(VSCodeSearch)

    if (!plugin) return false;

    plugin.replaceAll();
    return true;
}