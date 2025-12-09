import { LineBasedState } from "./linebasedstate";
import { Highlighter, highlightTree } from "@lezer/highlight";
import { ChangedRange, Tree, TreeFragment } from "@lezer/common";
import { highlightingFor, language } from "@codemirror/language";
import { EditorView, ViewUpdate } from "@codemirror/view";
import { DrawContext } from "./types";
import { Config, Options, Scale } from "./config";
import { LinesState, foldsChanged } from "./linesState";
import crelt from "crelt";
import { ChangeSet, EditorState } from "@codemirror/state";
import { createDocInput } from "./text/docInput";
import { TagSpan, FontInfo } from "./text/textTypes";
import { GlyphAtlas } from "./text/glyphAtlas";
import { LineRenderer } from "./text/lineRenderer";

export class TextState extends LineBasedState<Array<TagSpan>> {
  private _previousTree: Tree | undefined;
  private _displayText: Required<Options>["displayText"] | undefined;
  private _fontInfoMap: Map<string, FontInfo> = new Map();
  private _themeClasses: Set<string> | undefined;
  private _highlightingCallbackId: number | NodeJS.Timeout | undefined;
  private _fontInfoDirty: boolean = true;
  private _fontInfoVersion: number = 0;
  private _measurementCache:
    | { charWidth: number; lineHeight: number; version: number }
    | undefined;
  private _glyphAtlas = new GlyphAtlas();
  private _lineRenderer: LineRenderer;

  public constructor(view: EditorView) {
    super(view);

    this._themeClasses = new Set(Array.from(view.dom.classList));
    this._lineRenderer = new LineRenderer(
      this._glyphAtlas,
      this.getFontInfo.bind(this)
    );

    if (view.state.facet(Config).enabled) {
      this.updateImpl(view.state);
    }
  }

  private shouldUpdate(update: ViewUpdate) {
    // If the doc changed
    if (update.docChanged) {
      return true;
    }

    // If configuration settings changed
    if (update.state.facet(Config) !== update.startState.facet(Config)) {
      return true;
    }

    // If the theme changed
    if (this.themeChanged()) {
      return true;
    }

    // If the folds changed
    if (foldsChanged(update.transactions)) {
      return true;
    }

    return false;
  }

  public update(update: ViewUpdate) {
    if (!this.shouldUpdate(update)) {
      return;
    }

    if (this._highlightingCallbackId) {
      typeof window.requestIdleCallback !== "undefined"
        ? cancelIdleCallback(this._highlightingCallbackId as number)
        : clearTimeout(this._highlightingCallbackId);
    }

    this.updateImpl(update.state, update.changes);
  }

  private updateImpl(state: EditorState, changes?: ChangeSet) {
    /* Store display text setting for rendering */
    this._displayText = state.facet(Config).displayText;
    this.refreshFontCachesIfNeeded();

    /* Incrementally parse the tree based on previous tree + changes */
    let treeFragments: ReadonlyArray<TreeFragment> | undefined = undefined;
    if (this._previousTree && changes) {
      const previousFragments = TreeFragment.addTree(this._previousTree);

      const changedRanges: Array<ChangedRange> = [];
      changes.iterChangedRanges((fromA, toA, fromB, toB) =>
        changedRanges.push({ fromA, toA, fromB, toB })
      );

      treeFragments = TreeFragment.applyChanges(
        previousFragments,
        changedRanges
      );
    }

    /* Parse the document into a lezer tree */
    const parser = state.facet(language)?.parser;
    const tree = parser
      ? parser.parse(createDocInput(state.doc), treeFragments)
      : undefined;
    this._previousTree = tree;

    /* Highlight the document, and store the text and tags for each line */
    const highlighter: Highlighter = {
      style: (tags) => highlightingFor(state, tags),
    };

    let highlights: Array<{ from: number; to: number; tags: string }> = [];
    let viewportLines:
      | {
          from: number;
          to: number;
        }
      | undefined;

    if (tree) {
      /**
       * The viewport renders a few extra lines above and below the editor view. To approximate
       * the lines visible in the minimap, we multiply the lines in the viewport by the scale multipliers.
       *
       * Based on the current scroll position, the minimap may show a larger portion of lines above or
       * below the lines currently in the editor view. On a long document, when the scroll position is
       * near the top of the document, the minimap will show a small number of lines above the lines
       * in the editor view, and a large number of lines below the lines in the editor view.
       *
       * To approximate this ratio, we can use the viewport scroll percentage
       *
       * ┌─────────────────────┐
       * │                     │
       * │   Extra viewport    │
       * │   buffer            │
       * ├─────────────────────┼───────┐
       * │                     │Minimap│
       * │                     │Gutter │
       * │                     ├───────┤
       * │    Editor View      │Scaled │
       * │                     │View   │
       * │                     │Overlay│
       * │                     ├───────┤
       * │                     │       │
       * │                     │       │
       * ├─────────────────────┼───────┘
       * │                     │
       * │    Extra viewport   │
       * │    buffer           │
       * └─────────────────────┘
       *
       **/

      const vpLineTop = state.doc.lineAt(this.view.viewport.from).number;
      const vpLineBottom = state.doc.lineAt(this.view.viewport.to).number;
      const vpLineCount = Math.max(1, vpLineBottom - vpLineTop);
      const scrollDenominator = Math.max(1, state.doc.lines - vpLineCount);
      const vpScroll = Math.min(1, Math.max(0, vpLineTop / scrollDenominator));

      const { SizeRatio, PixelMultiplier } = Scale;
      const mmLineCount = vpLineCount * SizeRatio * PixelMultiplier;
      const mmLineRatio = vpScroll * mmLineCount;

      const mmLineTopRaw = Math.max(1, Math.floor(vpLineTop - mmLineRatio));
      const mmLineBottomRaw = Math.min(
        vpLineBottom + Math.floor(mmLineCount - mmLineRatio),
        state.doc.lines
      );

      if (
        Number.isFinite(mmLineTopRaw) &&
        Number.isFinite(mmLineBottomRaw)
      ) {
        const mmLineTop = Math.max(1, Math.floor(mmLineTopRaw));
        const mmLineBottom = Math.max(mmLineTop, Math.floor(mmLineBottomRaw));

        viewportLines = {
          from: mmLineTop,
          to: mmLineBottom,
        };

        // Highlight the in-view lines synchronously
        highlightTree(
          tree,
          highlighter,
          (from, to, tags) => {
            highlights.push({ from, to, tags });
          },
          state.doc.line(mmLineTop).from,
          state.doc.line(mmLineBottom).to
        );
      }
    }

    const hasExistingData = this.map.size > 0;
    const lineRange =
      viewportLines && hasExistingData ? viewportLines : undefined;

    // Update the map
    this.updateMapImpl(state, highlights, lineRange);

    // Highlight the entire tree in an idle callback
    highlights = [];
    const highlightingCallback = () => {
      if (tree) {
        highlightTree(tree, highlighter, (from, to, tags) => {
          highlights.push({ from, to, tags });
        });
        this.updateMapImpl(state, highlights, {
          from: 1,
          to: state.doc.lines,
        });
        this._highlightingCallbackId = undefined;
      }
    };
    this._highlightingCallbackId =
      typeof window.requestIdleCallback !== "undefined"
        ? requestIdleCallback(highlightingCallback)
        : setTimeout(highlightingCallback);
  }

  private refreshFontCachesIfNeeded() {
    if (!this._fontInfoDirty) {
      return;
    }

    this._fontInfoMap.clear();
    this._glyphAtlas.bust();
    this._measurementCache = undefined;
    this._lineRenderer.markAllChanged();
    this._fontInfoDirty = false;
    this._fontInfoVersion++;
  }

  private updateMapImpl(
    state: EditorState,
    highlights: Array<{ from: number; to: number; tags: string }>,
    lineRange?: { from: number; to: number }
  ) {
    const lines = state.field(LinesState);
    const totalLines = lines.length;
    const startIndex = lineRange
      ? Math.max(0, Math.min(totalLines, lineRange.from) - 1)
      : 0;
    const endIndex = lineRange
      ? Math.min(totalLines, Math.max(lineRange.to, lineRange.from))
      : totalLines;

    if (!lineRange) {
      this.map.clear();
      this._lineRenderer.markAllChanged();
    } else {
      this._lineRenderer.pruneLines(totalLines);
      for (const lineNumber of Array.from(this.map.keys())) {
        if (lineNumber > totalLines) {
          this.map.delete(lineNumber);
        }
      }
    }

    if (startIndex >= endIndex) {
      return;
    }

    const slice = (from: number, to: number) => state.doc.sliceString(from, to);
    const highlightsIterator = highlights.values();
    let highlightPtr = highlightsIterator.next();

    for (let rawIndex = startIndex; rawIndex < endIndex; rawIndex++) {
      const line = lines[rawIndex];
      if (!line) {
        continue;
      }
      const spans: Array<TagSpan> = [];

      for (const span of line) {
        // Skip if it's a 0-length span
        if (span.from === span.to) {
          continue;
        }

        // Append a placeholder for a folded span
        if (span.folded) {
          spans.push({ text: "…", tags: "" });
          continue;
        }

        let position = span.from;
        while (!highlightPtr.done && highlightPtr.value.from < span.to) {
          const { from, to, tags } = highlightPtr.value;

          // Iterate until our highlight is over the current span
          if (to < position) {
            highlightPtr = highlightsIterator.next();
            continue;
          }

          // Append unstyled text before the highlight begins
          if (from > position) {
            spans.push({ text: slice(position, from), tags: "" });
          }

          // A highlight may start before and extend beyond the current span
          const start = Math.max(from, span.from);
          const end = Math.min(to, span.to);

          // Append the highlighted text
          spans.push({ text: slice(start, end), tags });
          position = end;

          // If the highlight continues beyond this span, break from this loop
          if (to > end) {
            break;
          }

          // Otherwise, move to the next highlight
          highlightPtr = highlightsIterator.next();
        }

        // If there are remaining spans that did not get highlighted, append them unstyled
        if (position !== span.to) {
          spans.push({
            text: slice(position, span.to),
            tags: "",
          });
        }
      }

      // Lines are indexed beginning at 1 instead of 0
      const lineNumber = rawIndex + 1;
      const previous = this.map.get(lineNumber);
      if (previous && this.areSpansEqual(previous, spans)) {
        continue;
      }

      this.setLine(lineNumber, spans);
    }
  }

  public measure(context: CanvasRenderingContext2D): {
    charWidth: number;
    lineHeight: number;
  } {
    const { color, font, lineHeight } = this.getFontInfo("");

    context.textBaseline = "ideographic";
    context.fillStyle = color;
    context.font = font;

    if (
      this._measurementCache &&
      this._measurementCache.version === this._fontInfoVersion
    ) {
      return {
        charWidth: this._measurementCache.charWidth,
        lineHeight: this._measurementCache.lineHeight,
      };
    }

    const measurements = {
      charWidth: context.measureText("_").width,
      lineHeight: lineHeight,
      version: this._fontInfoVersion,
    };
    this._measurementCache = measurements;

    return {
      charWidth: measurements.charWidth,
      lineHeight: measurements.lineHeight,
    };
  }

  public beforeDraw() {
    this.refreshFontCachesIfNeeded(); // Confirm this worked for theme changes or get rid of it because it's slow
  }

  public drawLine(ctx: DrawContext, lineNumber: number) {
    const spans = this.get(lineNumber);
    if (!spans) {
      return;
    }

    const displayMode = this._displayText ?? "characters";
    this._lineRenderer.drawLine(lineNumber, spans, displayMode, ctx);
  }

  private getFontInfo(tags: string): FontInfo {
    const cached = this._fontInfoMap.get(tags);
    if (cached) {
      return cached;
    }

    // Create a mock token wrapped in a cm-line
    const mockToken = crelt("span", { class: tags });
    const mockLine = crelt(
      "div",
      { class: "cm-line", style: "display: none" },
      mockToken
    );
    this.view.contentDOM.appendChild(mockLine);

    // Get style information and store it
    const style = window.getComputedStyle(mockToken);
    const lineHeight = parseFloat(style.lineHeight) / Scale.SizeRatio;
    const result = {
      color: style.color,
      font: `${style.fontStyle} ${style.fontWeight} ${lineHeight}px ${style.fontFamily}`,
      lineHeight,
    };
    this._fontInfoMap.set(tags, result);

    // Clean up and return
    this.view.contentDOM.removeChild(mockLine);
    return result;
  }

  private setLine(lineNumber: number, spans: Array<TagSpan>) {
    this.map.set(lineNumber, spans);
    this._lineRenderer.markLineChanged(lineNumber);
  }

  private areSpansEqual(a: Array<TagSpan>, b: Array<TagSpan>) {
    if (a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i++) {
      if (a[i].text !== b[i].text || a[i].tags !== b[i].tags) {
        return false;
      }
    }
    return true;
  }

  private themeChanged(): boolean {
    const previous = this._themeClasses;
    const now = new Set<string>(Array.from(this.view.dom.classList));
    this._themeClasses = now;

    if (!previous) {
      this._fontInfoDirty = true;
      return true;
    }

    // Ignore certain classes being added/removed
    const previousComparable = new Set(previous);
    const nowComparable = new Set(now);
    previousComparable.delete("cm-focused");
    nowComparable.delete("cm-focused");

    if (previousComparable.size !== nowComparable.size) {
      this._fontInfoDirty = true;
      return true;
    }

    for (const theme of previousComparable) {
      if (!nowComparable.has(theme)) {
        this._fontInfoDirty = true;
        return true;
      }
    }

    return false;
  }
}

export function text(view: EditorView): TextState {
  return new TextState(view);
}
