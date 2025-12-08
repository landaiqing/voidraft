<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { EditorView } from '@codemirror/view';
import {
    getSearchQuery,
    SearchQuery,
    setSearchQuery,
    findNext,
    findPrevious,
    replaceNext,
    replaceAll,
    closeSearchPanel,
    SearchCursor,
    RegExpCursor
} from '@codemirror/search';

const props = defineProps<{ view: EditorView }>();

// State - options will be initialized from getSearchQuery (uses config defaults)
const replaceVisible = ref(false);
const searchText = ref('');
const replaceText = ref('');
const matchCase = ref(false);  // Will be set from query in onMounted
const matchWord = ref(false);  // Will be set from query in onMounted
const useRegex = ref(false);   // Will be set from query in onMounted
const hasError = ref(false);
const totalMatches = ref(0);
const currentMatchIndex = ref(0);

const searchInput = ref<HTMLInputElement | null>(null);
const containerRef = ref<HTMLDivElement | null>(null);

// Computed
const matchCountText = computed(() => {
    if (hasError.value) return 'Invalid regex';
    if (!searchText.value || totalMatches.value === 0) return 'No results';
    return `${currentMatchIndex.value} of ${totalMatches.value}`;
});

const hasMatches = computed(() => totalMatches.value > 0);
const canReplace = computed(() => searchText.value.length > 0 && hasMatches.value);

// Core functions
function commit() {
    try {
        const query = new SearchQuery({
            search: searchText.value,
            replace: replaceText.value,
            caseSensitive: matchCase.value,
            regexp: useRegex.value,
            wholeWord: matchWord.value,
        });
        props.view.dispatch({ effects: setSearchQuery.of(query) });
        hasError.value = false;
        updateMatchCount();
    } catch {
        hasError.value = true;
        totalMatches.value = currentMatchIndex.value = 0;
    }
}

function updateMatchCount() {
    const query = getSearchQuery(props.view.state);
    if (!query.search) {
        totalMatches.value = currentMatchIndex.value = 0;
        return;
    }

    try {
        const cursorPos = props.view.state.selection.main.from;
        let total = 0, current = 0, foundCurrent = false;

        const cursor = query.regexp
            ? new RegExpCursor(props.view.state.doc, query.search, { ignoreCase: !query.caseSensitive })
            : new SearchCursor(props.view.state.doc, query.search, 0, props.view.state.doc.length, 
                query.caseSensitive ? undefined : (s: string) => s.toLowerCase());

        while (!cursor.next().done) {
            total++;
            if (!foundCurrent && cursor.value.from >= cursorPos) {
                current = total;
                foundCurrent = true;
            }
            if (total >= 9999) break;
        }

        totalMatches.value = total;
        currentMatchIndex.value = foundCurrent ? current : Math.min(1, total);
    } catch {
        totalMatches.value = currentMatchIndex.value = 0;
    }
}

// Actions - scrollToMatch is handled by search config in plugin.ts
const doFindNext = () => { findNext(props.view); updateMatchCount(); };
const doFindPrevious = () => { findPrevious(props.view); updateMatchCount(); };
const doReplace = () => { if (canReplace.value) { replaceNext(props.view); updateMatchCount(); } };
const doReplaceAll = () => { if (canReplace.value) { replaceAll(props.view); updateMatchCount(); } };

const toggleOption = (opt: 'case' | 'word' | 'regex') => {
    const map = { case: matchCase, word: matchWord, regex: useRegex };
    map[opt].value = !map[opt].value;
    commit();
};

const close = () => closeSearchPanel(props.view);

// Keyboard handlers
const onSearchKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); e.shiftKey ? doFindPrevious() : doFindNext(); }
    if (e.key === 'Escape') { e.preventDefault(); close(); }
};

const onReplaceKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); (e.ctrlKey || e.metaKey) ? doReplaceAll() : doReplace(); }
    if (e.key === 'Escape') { e.preventDefault(); close(); }
};

// Resize
let resizeState = { startX: 0, startWidth: 0 };
const onResize = (e: MouseEvent) => {
    if (!containerRef.value) return;
    containerRef.value.style.width = `${Math.max(411, Math.min(800, resizeState.startWidth + resizeState.startX - e.clientX))}px`;
};
const stopResize = () => { document.removeEventListener('mousemove', onResize); document.removeEventListener('mouseup', stopResize); };
const startResize = (e: MouseEvent) => {
    resizeState = { startX: e.clientX, startWidth: containerRef.value?.offsetWidth ?? 411 };
    document.addEventListener('mousemove', onResize);
    document.addEventListener('mouseup', stopResize);
};

// Watch for input changes
watch([searchText, replaceText], commit);

// Init - read options from query (defaults from search config), pre-populate search text
onMounted(() => {
    // Always read options from query - this uses defaults from search() config
    const query = getSearchQuery(props.view.state);
    matchCase.value = query.caseSensitive;
    matchWord.value = query.wholeWord;
    useRegex.value = query.regexp;
    
    // Pre-populate search/replace text
    if (query?.search) {
        searchText.value = query.search;
        replaceText.value = query.replace;
    } else {
        // Pre-populate from selection if no existing search
        const { main } = props.view.state.selection;
        if (!main.empty) {
            const text = props.view.state.doc.sliceString(main.from, main.to);
            if (!text.includes('\n') && text.length < 200) searchText.value = text;
        }
    }
    
    // Focus input
    nextTick(() => {
        searchInput.value?.focus();
        searchInput.value?.select();
        if (searchText.value) commit();
    });
});
</script>

<template>
    <div ref="containerRef" class="search-panel" @keydown.esc="close">
        <div class="resize-handle" @mousedown="startResize" />
        
        <div class="toggle-section">
            <div class="toggle-replace" @click="replaceVisible = !replaceVisible" :title="replaceVisible ? 'Hide Replace' : 'Show Replace'">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path v-if="replaceVisible" fill-rule="evenodd" clip-rule="evenodd" d="M7.976 10.072l4.357-4.357.62.618L8.284 11h-.618L3 6.333l.619-.618 4.357 4.357z"/>
                    <path v-else fill-rule="evenodd" clip-rule="evenodd" d="M10.072 8.024L5.715 3.667l.618-.62L11 7.716v.618L6.333 13l-.618-.619 4.357-4.357z"/>
                </svg>
            </div>
        </div>

        <div class="input-section">
            <div class="search-bar">
                <input ref="searchInput" v-model="searchText" type="text" class="find-input" :class="{ error: hasError }" placeholder="Find" @keydown="onSearchKeydown" />
                <div class="search-controls">
                    <div class="control-btn" :class="{ active: matchCase }" title="Match Case (Alt+C)" @click="toggleOption('case')">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8.85352 11.7021H7.85449L7.03809 9.54297H3.77246L3.00439 11.7021H2L4.9541 4H5.88867L8.85352 11.7021ZM6.74268 8.73193L5.53418 5.4502C5.49479 5.34277 5.4554 5.1709 5.41602 4.93457H5.39453C5.35872 5.15299 5.31755 5.32487 5.271 5.4502L4.07324 8.73193H6.74268Z"/><path d="M13.756 11.7021H12.8752V10.8428H12.8537C12.4706 11.5016 11.9066 11.8311 11.1618 11.8311C10.6139 11.8311 10.1843 11.686 9.87273 11.396C9.56479 11.106 9.41082 10.721 9.41082 10.2412C9.41082 9.21354 10.016 8.61556 11.2262 8.44727L12.8752 8.21631C12.8752 7.28174 12.4974 6.81445 11.7419 6.81445C11.0794 6.81445 10.4815 7.04004 9.94793 7.49121V6.58887C10.4886 6.24512 11.1117 6.07324 11.8171 6.07324C13.1097 6.07324 13.756 6.75716 13.756 8.125V11.7021ZM12.8752 8.91992L11.5485 9.10254C11.1403 9.15983 10.8324 9.26188 10.6247 9.40869C10.417 9.55192 10.3132 9.80794 10.3132 10.1768C10.3132 10.4453 10.4081 10.6655 10.5978 10.8374C10.7912 11.0057 11.0472 11.0898 11.3659 11.0898C11.8027 11.0898 12.1626 10.9377 12.4455 10.6333C12.7319 10.3254 12.8752 9.93685 12.8752 9.46777V8.91992Z"/></svg>
                    </div>
                    <div class="control-btn" :class="{ active: matchWord }" title="Match Whole Word (Alt+W)" @click="toggleOption('word')">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M0 11H1V13H15V11H16V14H15H1H0V11Z"/><path d="M6.84048 11H5.95963V10.1406H5.93814C5.555 10.7995 4.99104 11.1289 4.24625 11.1289C3.69839 11.1289 3.26871 10.9839 2.95718 10.6938C2.64924 10.4038 2.49527 10.0189 2.49527 9.53906C2.49527 8.51139 3.10041 7.91341 4.3107 7.74512L5.95963 7.51416C5.95963 6.57959 5.58186 6.1123 4.82632 6.1123C4.16389 6.1123 3.56591 6.33789 3.03238 6.78906V5.88672C3.57307 5.54297 4.19612 5.37109 4.90152 5.37109C6.19416 5.37109 6.84048 6.05501 6.84048 7.42285V11ZM5.95963 8.21777L4.63297 8.40039C4.22476 8.45768 3.91682 8.55973 3.70914 8.70654C3.50145 8.84977 3.39761 9.10579 3.39761 9.47461C3.39761 9.74316 3.4925 9.96338 3.68228 10.1353C3.87564 10.3035 4.13166 10.3877 4.45035 10.3877C4.8872 10.3877 5.24706 10.2355 5.52994 9.93115C5.8164 9.62321 5.95963 9.2347 5.95963 8.76562V8.21777Z"/><path d="M9.3475 10.2051H9.32601V11H8.44515V2.85742H9.32601V6.4668H9.3475C9.78076 5.73633 10.4146 5.37109 11.2489 5.37109C11.9543 5.37109 12.5057 5.61816 12.9032 6.1123C13.3042 6.60286 13.5047 7.26172 13.5047 8.08887C13.5047 9.00911 13.2809 9.74674 12.8333 10.3018C12.3857 10.8532 11.7734 11.1289 10.9964 11.1289C10.2695 11.1289 9.71989 10.821 9.3475 10.2051ZM9.32601 7.98682V8.75488C9.32601 9.20964 9.47282 9.59635 9.76644 9.91504C10.0636 10.2301 10.4396 10.3877 10.8944 10.3877C11.4279 10.3877 11.8451 10.1836 12.1458 9.77539C12.4502 9.36719 12.6024 8.79964 12.6024 8.07275C12.6024 7.46045 12.4609 6.98063 12.1781 6.6333C11.8952 6.28597 11.512 6.1123 11.0286 6.1123C10.5166 6.1123 10.1048 6.29134 9.7933 6.64941C9.48177 7.00391 9.32601 7.44971 9.32601 7.98682Z"/></svg>
                    </div>
                    <div class="control-btn" :class="{ active: useRegex }" title="Use Regular Expression (Alt+R)" @click="toggleOption('regex')">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M10.012 2h.976v3.113l2.56-1.557.486.885L11.47 6l2.564 1.559-.485.885-2.561-1.557V10h-.976V6.887l-2.56 1.557-.486-.885L9.53 6 6.966 4.441l.485-.885 2.561 1.557V2zM2 10h4v4H2v-4z"/></svg>
                    </div>
                </div>
            </div>
            <div v-show="replaceVisible" class="replace-bar">
                <input v-model="replaceText" type="text" class="replace-input" placeholder="Replace" @keydown="onReplaceKeydown" />
            </div>
        </div>

        <div class="actions-section">
            <div class="button-group">
                <span class="match-count">{{ matchCountText }}</span>
                <div class="search-icons">
                    <div class="icon-btn" :class="{ disabled: !hasMatches }" title="Previous Match (Shift+Enter)" @click="doFindPrevious">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M13.854 7l-5-5h-.707l-5 5 .707.707L8 3.561V14h1V3.56l4.146 4.147.708-.707z"/></svg>
                    </div>
                    <div class="icon-btn" :class="{ disabled: !hasMatches }" title="Next Match (Enter)" @click="doFindNext">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M3.147 9l5 5h.707l5-5-.707-.707L9 12.439V2H8v10.44L3.854 8.292 3.147 9z"/></svg>
                    </div>
                    <div class="icon-btn" title="Close (Escape)" @click="close">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.707.708L7.293 8l-3.646 3.646.707.708L8 8.707z"/></svg>
                    </div>
                </div>
            </div>
            <div v-show="replaceVisible" class="replace-buttons">
                <div class="icon-btn" :class="{ disabled: !canReplace }" title="Replace (Enter)" @click="doReplace">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M3.221 3.739l2.261 2.269L7.7 3.784l-.7-.7-1.012 1.007-.008-1.6a.523.523 0 0 1 .5-.526H8V1H6.48A1.482 1.482 0 0 0 5 2.489V4.1L3.927 3.033l-.706.706zm6.67 1.794h.01c.183.311.451.467.806.467.393 0 .706-.168.94-.503.236-.335.353-.78.353-1.333 0-.511-.1-.913-.301-1.207-.201-.295-.488-.442-.86-.442-.405 0-.718.194-.938.581h-.01V1H9v4.919h.89v-.386zm-.015-1.061v-.34c0-.248.058-.448.175-.601a.54.54 0 0 1 .445-.23.49.49 0 0 1 .436.233c.104.154.155.368.155.643 0 .33-.056.587-.169.768a.524.524 0 0 1-.47.27.495.495 0 0 1-.411-.211.853.853 0 0 1-.16-.532zM9 12.769c-.256.154-.625.231-1.108.231-.563 0-1.02-.178-1.369-.533-.349-.355-.523-.813-.523-1.374 0-.648.186-1.158.56-1.53.374-.376.875-.563 1.5-.563.433 0 .746.06.94.179v.998a1.26 1.26 0 0 0-.792-.276c-.325 0-.583.1-.774.298-.19.196-.283.468-.283.816 0 .338.09.603.272.797.182.191.431.287.749.287.282 0 .558-.092.828-.276v.946zM4 7L3 8v6l1 1h7l1-1V8l-1-1H4zm0 1h7v6H4V8z"/></svg>
                </div>
                <div class="icon-btn" :class="{ disabled: !canReplace }" title="Replace All (Ctrl+Enter)" @click="doReplaceAll">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M11.6 2.677c.147-.31.356-.465.626-.465.248 0 .44.118.573.353.134.236.201.557.201.966 0 .443-.078.798-.235 1.067-.156.268-.365.402-.627.402-.237 0-.416-.125-.537-.374h-.008v.31H11V1h.593v1.677h.008zm-.016 1.1a.78.78 0 0 0 .107.426c.071.113.163.169.274.169.136 0 .24-.072.314-.216.075-.145.113-.35.113-.615 0-.22-.035-.39-.104-.514-.067-.124-.164-.187-.29-.187-.12 0-.219.062-.297.185a.886.886 0 0 0-.117.48v.272zM4.12 7.695L2 5.568l.662-.662 1.006 1v-1.51A1.39 1.39 0 0 1 5.055 3H7.4v.905H5.055a.49.49 0 0 0-.468.493l.007 1.5.949-.944.656.656-2.08 2.085zM9.356 4.93H10V3.22C10 2.408 9.685 2 9.056 2c-.135 0-.285.024-.45.073a1.444 1.444 0 0 0-.388.167v.665c.237-.203.487-.304.75-.304.261 0 .392.156.392.469l-.6.103c-.506.086-.76.406-.76.961 0 .263.061.473.183.631A.61.61 0 0 0 8.69 5c.29 0 .509-.16.657-.48h.009v.41zm.004-1.355v.193a.75.75 0 0 1-.12.436.368.368 0 0 1-.313.17.276.276 0 0 1-.22-.095.38.38 0 0 1-.08-.248c0-.222.11-.351.332-.389l.4-.067zM7 12.93h-.644v-.41h-.009c-.148.32-.367.48-.657.48a.61.61 0 0 1-.507-.235c-.122-.158-.183-.368-.183-.63 0-.556.254-.876.76-.962l.6-.103c0-.313-.13-.47-.392-.47-.263 0-.513.102-.75.305v-.665c.095-.063.224-.119.388-.167.165-.049.315-.073.45-.073.63 0 .944.407.944 1.22v1.71zm-.64-1.162v-.193l-.4.068c-.222.037-.333.166-.333.388 0 .1.027.183.08.248a.276.276 0 0 0 .22.095.368.368 0 0 0 .312-.17c.08-.116.12-.26.12-.436zM9.262 13c.321 0 .568-.058.738-.173v-.71a.9.9 0 0 1-.552.207.619.619 0 0 1-.5-.215c-.12-.145-.181-.345-.181-.598 0-.26.063-.464.189-.612a.644.644 0 0 1 .516-.223c.194 0 .37.069.528.207v-.749c-.129-.09-.338-.134-.626-.134-.417 0-.751.14-1.001.422-.249.28-.373.662-.373 1.148 0 .42.116.764.349 1.03.232.267.537.4.913.4zM2 9l1-1h9l1 1v5l-1 1H3l-1-1V9zm1 0v5h9V9H3zm3-2l1-1h7l1 1v5l-1 1V7H6z"/></svg>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped lang="scss">
.search-panel {
    position: absolute;
    top: 0;
    right: 14px;
    z-index: 9999;
    display: flex;
    min-width: 411px;
    max-width: calc(100% - 28px);
    padding: 4px;
    border-radius: 4px;
    box-shadow: 0 0 8px 2px rgba(0, 0, 0, 0.36);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
    box-sizing: border-box;
    background-color: var(--search-panel-bg);
    color: var(--search-panel-text);
    border: 1px solid var(--search-panel-border);
}

.resize-handle {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    cursor: col-resize;
    &:hover { background-color: var(--search-focus-border); }
}

.toggle-section {
    display: flex;
    flex-direction: column;
    padding: 3px 2px 3px 3px;
}

.toggle-replace {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 100%;
    padding: 3px;
    border-radius: 3px;
    cursor: pointer;
    &:hover { background-color: var(--search-btn-hover); }
}

.input-section {
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex: 1;
    min-width: 0;
    padding: 3px 0;
}

.search-bar { display: flex; position: relative; }

.find-input, .replace-input {
    width: 100%;
    height: 24px;
    padding: 3px 70px 3px 6px;
    border-radius: 2px;
    outline: none;
    font-size: 13px;
    line-height: 18px;
    box-sizing: border-box;
    background: var(--search-input-bg);
    color: var(--search-input-text);
    border: 1px solid var(--search-input-border);
    &:focus {
        border-color: var(--search-focus-border);
        outline: 1px solid var(--search-focus-border);
        outline-offset: -1px;
    }
    &.error {
        border-color: var(--search-error-border) !important;
        background-color: var(--search-error-bg) !important;
    }
}

.replace-input { padding: 3px 6px; }
.replace-bar { display: flex; }

.search-controls {
    display: flex;
    position: absolute;
    right: 2px;
    top: 50%;
    transform: translateY(-50%);
    gap: 1px;
}

.control-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    padding: 2px;
    border-radius: 3px;
    cursor: pointer;
    border: 1px solid transparent;
    svg { width: 16px; height: 16px; }
    &:hover { background-color: var(--search-btn-hover); }
    &.active {
        background-color: var(--search-btn-active-bg);
        color: var(--search-btn-active-text);
        border-color: var(--search-focus-border);
        svg { fill: var(--search-btn-active-text); }
    }
}

.actions-section {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 3px 4px;
}

.button-group {
    display: flex;
    align-items: center;
    height: 24px;
    gap: 4px;
}

.match-count {
    font-size: 12px;
    white-space: nowrap;
    min-width: 50px;
    text-align: center;
    line-height: 22px;
}

.search-icons, .replace-buttons { display: flex; gap: 1px; }
.replace-buttons { height: 24px; }

.icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    padding: 2px;
    border-radius: 3px;
    cursor: pointer;
    svg { width: 16px; height: 16px; }
    &:hover { background-color: var(--search-btn-hover); }
    &.disabled { opacity: 0.4; pointer-events: none; }
}
</style>
