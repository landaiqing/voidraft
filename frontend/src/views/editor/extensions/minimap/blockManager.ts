import { EditorView } from '@codemirror/view';
import { EditorState, ChangeSet } from '@codemirror/state';
import { syntaxTree, highlightingFor } from '@codemirror/language';
import { Highlighter, highlightTree } from '@lezer/highlight';
import { Scale } from './config';
import { LinesState, getLinesSnapshot } from './linesState';
import {
  ToWorkerMessage,
  ToMainMessage,
  BlockRequest,
  Highlight,
  LineSpan,
  FontInfo,
} from './worker/protocol';
import crelt from 'crelt';

const BLOCK_LINES = 50;
const MAX_BLOCKS = 20;

interface Block {
  index: number;
  startLine: number;
  endLine: number;
  bitmap: ImageBitmap | null;
  dirty: boolean;
  rendering: boolean;
  requestId: number;
  lastUsed: number; // LRU 时间戳
}

export class BlockManager {
  private worker: Worker | null = null;
  private blocks = new Map<number, Block>();
  private fontInfoMap = new Map<string, FontInfo>();
  private fontDirty = true;
  private fontVersion = 0;
  private measureCache: { charWidth: number; lineHeight: number; version: number } | null = null;
  private displayText: 'blocks' | 'characters' = 'characters';
  private themeClasses: Set<string>;
  private requestId = 0;
  private onBlockReady: (() => void) | null = null;
  
  // 批量处理块完成事件
  private pendingBlockReadyHandle: ReturnType<typeof setTimeout> | null = null;
  private renderingCount = 0;

  constructor(private view: EditorView) {
    this.themeClasses = new Set(Array.from(view.dom.classList));
    this.initWorker();
  }

  private initWorker(): void {
    this.worker = new Worker(
      new URL('./worker/block.worker.ts', import.meta.url),
      { type: 'module' }
    );

    this.worker.onmessage = (e: MessageEvent<ToMainMessage>) => {
      this.handleWorkerMessage(e.data);
    };

    this.worker.onerror = (e) => {
      console.error('[BlockManager] Worker error:', e);
    };

    this.worker.postMessage({ type: 'init' } as ToWorkerMessage);
  }

  private handleWorkerMessage(msg: ToMainMessage): void {
    switch (msg.type) {
      case 'ready':
        break;
      case 'blockComplete': {
        const block = this.blocks.get(msg.blockIndex);
        if (block && block.requestId === msg.blockId) {
          block.bitmap = msg.bitmap;
          block.dirty = false;
          block.rendering = false;
          this.renderingCount = Math.max(0, this.renderingCount - 1);
          this.scheduleBlockReady();
        }
        break;
      }
      case 'error':
        console.error('[BlockManager] Worker error:', msg.message);
        break;
    }
  }

  // 批量触发块就绪回调
  // 策略：等 30ms，让多个块完成事件合并
  private scheduleBlockReady(): void {
    if (this.pendingBlockReadyHandle !== null) {
      clearTimeout(this.pendingBlockReadyHandle);
    }
    
    this.pendingBlockReadyHandle = setTimeout(() => {
      this.pendingBlockReadyHandle = null;
      if (this.renderingCount === 0) {
        this.onBlockReady?.();
      }
    }, 30);
  }

  setOnBlockReady(callback: () => void): void {
    this.onBlockReady = callback;
  }

  setDisplayText(mode: 'blocks' | 'characters'): void {
    if (this.displayText !== mode) {
      this.displayText = mode;
      this.markAllDirty();
    }
  }

  checkThemeChange(): boolean {
    const nowClasses = Array.from(this.view.dom.classList);
    const now = new Set(nowClasses);
    const prev = this.themeClasses;
    this.themeClasses = now;

    if (!prev) {
      this.fontDirty = true;
      this.markAllDirty();
      return true;
    }

    const prevSet = new Set(prev);
    const nowSet = new Set(now);
    prevSet.delete('cm-focused');
    nowSet.delete('cm-focused');

    if (prevSet.size !== nowSet.size) {
      this.fontDirty = true;
      this.markAllDirty();
      return true;
    }

    for (const cls of prevSet) {
      if (!nowSet.has(cls)) {
        this.fontDirty = true;
        this.markAllDirty();
        return true;
      }
    }

    return false;
  }

  markAllDirty(): void {
    for (const block of this.blocks.values()) {
      block.dirty = true;
    }
  }

  handleDocChange(state: EditorState, changes: ChangeSet, oldLineCount: number): void {
    const totalLines = state.doc.lines;
    const maxIndex = Math.ceil(totalLines / BLOCK_LINES) - 1;

    // 找出变化影响的块
    const affectedBlocks = new Set<number>();
    
    // 正确检测行数变化：比较新旧文档总行数
    const hasLineCountChange = totalLines !== oldLineCount;

    changes.iterChanges((fromA, toA, fromB, toB) => {
      // 找出新文档中受影响的行范围
      const startLine = state.doc.lineAt(fromB).number;
      const endLine = state.doc.lineAt(Math.min(toB, state.doc.length)).number;
      
      const startBlock = Math.floor((startLine - 1) / BLOCK_LINES);
      const endBlock = Math.floor((endLine - 1) / BLOCK_LINES);
      
      for (let i = startBlock; i <= endBlock; i++) {
        affectedBlocks.add(i);
      }
    });

    // 如果行数变化，后续所有块都需要标记为 dirty
    let markRest = false;

    for (const [index, block] of this.blocks) {
      if (index > maxIndex) {
        block.bitmap?.close();
        this.blocks.delete(index);
      } else if (affectedBlocks.has(index)) {
        block.dirty = true;
        if (hasLineCountChange) {
          markRest = true; // 从这个块开始，后续块都需要更新
        }
      } else if (markRest) {
        block.dirty = true;
      }
    }

  }

  /**
   * 计算可见范围（提取公共计算逻辑）
   */
  private getVisibleRange(
    canvasHeight: number,
    lineHeight: number,
    scrollInfo: { scrollTop: number; clientHeight: number; scrollHeight: number }
  ): {
    valid: boolean;
    totalLines: number;
    scaledPTop: number;
    canvasTop: number;
    startBlock: number;
    endBlock: number;
  } | null {
    const totalLines = this.view.state.field(LinesState).length;
    if (totalLines === 0 || canvasHeight <= 0) {
      return null;
    }

    const { top: pTop, bottom: pBottom } = this.view.documentPadding;
    const scaledPTop = pTop / Scale.SizeRatio;
    const scaledPBottom = pBottom / Scale.SizeRatio;
    const totalHeight = scaledPTop + scaledPBottom + totalLines * lineHeight;

    const { scrollTop, clientHeight, scrollHeight } = scrollInfo;
    const scrollPercent = Math.max(0, Math.min(1, scrollTop / (scrollHeight - clientHeight))) || 0;
    const canvasTop = Math.max(0, scrollPercent * (totalHeight - canvasHeight));

    const visibleStart = Math.max(1, Math.floor((canvasTop - scaledPTop) / lineHeight) + 1);
    const visibleEnd = Math.min(totalLines, Math.ceil((canvasTop + canvasHeight - scaledPTop) / lineHeight));

    if (visibleEnd < visibleStart) {
      return null;
    }

    return {
      valid: true,
      totalLines,
      scaledPTop,
      canvasTop,
      startBlock: Math.floor((visibleStart - 1) / BLOCK_LINES),
      endBlock: Math.floor((visibleEnd - 1) / BLOCK_LINES),
    };
  }

  render(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    scrollInfo: { scrollTop: number; clientHeight: number; scrollHeight: number }
  ): void {
    if (this.fontDirty) {
      this.refreshFontCache();
    }

    const { charWidth, lineHeight } = this.measure(ctx);
    const range = this.getVisibleRange(canvas.height, lineHeight, scrollInfo);
    if (!range) return;

    const { totalLines, scaledPTop, canvasTop, startBlock, endBlock } = range;
    const state = this.view.state;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = startBlock; i <= endBlock; i++) {
      const block = this.getOrCreateBlock(i, state, totalLines);
      if (!block) continue;

      if (block.dirty && !block.rendering) {
        this.requestBlockRender(block, state, charWidth, lineHeight);
      }

      if (block.bitmap) {
        const blockY = scaledPTop + (block.startLine - 1) * lineHeight - canvasTop;
        ctx.drawImage(block.bitmap, 0, blockY);
      }
    }

    this.fontDirty = false;
    this.evictOldBlocks();
  }

  /**
   * 只绘制缓存的块，不请求新渲染（用于 overlay-only 更新）
   */
  drawCachedBlocks(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    scrollInfo: { scrollTop: number; clientHeight: number; scrollHeight: number }
  ): void {
    const { lineHeight } = this.measure(ctx);
    const range = this.getVisibleRange(canvas.height, lineHeight, scrollInfo);
    if (!range) return;

    const { scaledPTop, canvasTop, startBlock, endBlock } = range;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = startBlock; i <= endBlock; i++) {
      const block = this.blocks.get(i);
      if (block?.bitmap) {
        const blockY = scaledPTop + (block.startLine - 1) * lineHeight - canvasTop;
        ctx.drawImage(block.bitmap, 0, blockY);
      }
    }
  }

  private getOrCreateBlock(index: number, state: EditorState, totalLines: number): Block | null {
    const startLine = index * BLOCK_LINES + 1;
    if (startLine > totalLines) return null;

    const endLine = Math.min((index + 1) * BLOCK_LINES, totalLines);
    const now = performance.now();

    let block = this.blocks.get(index);
    if (!block) {
      block = {
        index,
        startLine,
        endLine,
        bitmap: null,
        dirty: true,
        rendering: false,
        requestId: 0,
        lastUsed: now,
      };
      this.blocks.set(index, block);
    } else {
      block.startLine = startLine;
      block.endLine = endLine;
      block.lastUsed = now; // 更新 LRU 时间戳
    }

    return block;
  }

  private requestBlockRender(
    block: Block,
    state: EditorState,
    charWidth: number,
    lineHeight: number
  ): void {
    if (!this.worker) return;

    block.rendering = true;
    block.requestId = ++this.requestId;
    this.renderingCount++;

    const { startLine, endLine } = block;
    const linesSnapshot = getLinesSnapshot(state);
    const tree = syntaxTree(state);

    // Collect highlights
    const highlights: Highlight[] = [];
    if (tree.length > 0 && startLine <= state.doc.lines) {
      const highlighter: Highlighter = {
        style: (tags) => highlightingFor(state, tags),
      };
      const startPos = state.doc.line(startLine).from;
      const endPos = state.doc.line(Math.min(endLine, state.doc.lines)).to;

      highlightTree(tree, highlighter, (from, to, tags) => {
        highlights.push({ from, to, tags });
      }, startPos, endPos);
    }

    // Extract relevant lines
    const startIdx = startLine - 1;
    const endIdx = Math.min(endLine, linesSnapshot.length);
    const lines: LineSpan[][] = linesSnapshot.slice(startIdx, endIdx).map(line =>
      line.map(span => ({ from: span.from, to: span.to, folded: span.folded }))
    );

    // Get text slice
    let textOffset = 0;
    let textEnd = 0;
    if (lines.length > 0 && lines[0].length > 0) {
      textOffset = lines[0][0].from;
      const lastLine = lines[lines.length - 1];
      if (lastLine.length > 0) {
        textEnd = lastLine[lastLine.length - 1].to;
      }
    }
    const textSlice = state.doc.sliceString(textOffset, textEnd);

    // Build font info map
    const fontInfoMap: Record<string, FontInfo> = {};
    for (const hl of highlights) {
      if (!fontInfoMap[hl.tags]) {
        const info = this.getFontInfo(hl.tags);
        fontInfoMap[hl.tags] = info;
      }
    }
    fontInfoMap[''] = this.getFontInfo('');

    const blockLines = endLine - startLine + 1;
    const request: BlockRequest = {
      type: 'renderBlock',
      blockId: block.requestId,
      blockIndex: block.index,
      startLine,
      endLine,
      width: Math.ceil(Scale.MaxWidth * Scale.PixelMultiplier),
      height: Math.ceil(blockLines * lineHeight),
      highlights,
      lines,
      textSlice,
      textOffset,
      fontInfoMap,
      defaultFont: fontInfoMap[''],
      displayText: this.displayText,
      charWidth,
      lineHeight,
      gutterOffset: 0,
    };

    this.worker.postMessage(request);
  }

  private evictOldBlocks(): void {
    if (this.blocks.size <= MAX_BLOCKS) return;

    // LRU 驱逐：按 lastUsed 升序排序，驱逐最久未使用的块
    const sorted = Array.from(this.blocks.entries())
      .filter(([, b]) => !b.rendering)
      .sort((a, b) => a[1].lastUsed - b[1].lastUsed);

    const toRemove = sorted.slice(0, this.blocks.size - MAX_BLOCKS);
    for (const [index, block] of toRemove) {
      block.bitmap?.close();
      this.blocks.delete(index);
    }
  }

  private refreshFontCache(): void {
    this.fontInfoMap.clear();
    this.measureCache = null;
    // 注意：fontDirty 在成功渲染块后才设为 false
    this.fontVersion++;
    this.markAllDirty();
  }

  measure(ctx: CanvasRenderingContext2D): { charWidth: number; lineHeight: number } {
    const info = this.getFontInfo('');
    ctx.textBaseline = 'ideographic';
    ctx.fillStyle = info.color;
    ctx.font = info.font;

    if (this.measureCache?.version === this.fontVersion) {
      return { charWidth: this.measureCache.charWidth, lineHeight: this.measureCache.lineHeight };
    }

    const charWidth = ctx.measureText('_').width;
    this.measureCache = { charWidth, lineHeight: info.lineHeight, version: this.fontVersion };
    return { charWidth, lineHeight: info.lineHeight };
  }

  private getFontInfo(tags: string): FontInfo {
    const cached = this.fontInfoMap.get(tags);
    if (cached) return cached;

    const mockToken = crelt('span', { class: tags });
    const mockLine = crelt('div', { class: 'cm-line', style: 'display: none' }, mockToken);
    this.view.contentDOM.appendChild(mockLine);

    const style = window.getComputedStyle(mockToken);
    
    // 获取字体大小（用于渲染字符）
    const fontSize = parseFloat(style.fontSize) || this.view.defaultLineHeight;
    const scaledFontSize = Math.max(1, fontSize / Scale.SizeRatio);
    
    // 获取行高（用于行间距）
    const rawLineHeight = parseFloat(style.lineHeight);
    const resolvedLineHeight = Number.isFinite(rawLineHeight) && rawLineHeight > 0 ? rawLineHeight : fontSize;
    const lineHeight = Math.max(1, resolvedLineHeight / Scale.SizeRatio);

    const result: FontInfo = {
      color: style.color,
      font: `${style.fontStyle} ${style.fontWeight} ${scaledFontSize}px ${style.fontFamily}`,
      lineHeight,
    };

    this.view.contentDOM.removeChild(mockLine);
    this.fontInfoMap.set(tags, result);
    return result;
  }

  destroy(): void {
    if (this.pendingBlockReadyHandle !== null) {
      clearTimeout(this.pendingBlockReadyHandle);
    }
    for (const block of this.blocks.values()) {
      block.bitmap?.close();
    }
    this.blocks.clear();
    this.worker?.postMessage({ type: 'destroy' } as ToWorkerMessage);
    this.worker?.terminate();
    this.worker = null;
  }
}

