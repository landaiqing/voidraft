import {
  ToWorkerMessage,
  ToMainMessage,
  BlockRequest,
  TagSpan,
  FontInfo,
} from './protocol';

// 缓存字体信息，只在主题变化时更新
let cachedFontInfoMap: Record<string, FontInfo> = {};
let cachedDefaultFont: FontInfo = { color: '#000', font: '12px monospace', lineHeight: 14 };

function post(msg: ToMainMessage, transfer?: Transferable[]): void {
  self.postMessage(msg, { transfer });
}

/**
 * 二分查找：找到第一个 to > pos 的高亮索引
 */
function findHighlightStart(highlights: BlockRequest['highlights'], pos: number): number {
  let left = 0;
  let right = highlights.length;
  while (left < right) {
    const mid = (left + right) >>> 1;
    if (highlights[mid].to <= pos) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }
  return left;
}

function buildLineSpans(
  request: BlockRequest
): Map<number, TagSpan[]> {
  const { highlights, lines, textSlice, textOffset, startLine, endLine } = request;
  const result = new Map<number, TagSpan[]>();
  
  const slice = (from: number, to: number): string => {
    return textSlice.slice(from - textOffset, to - textOffset);
  };

  // 使用二分查找找到起始高亮索引
  const firstSpanPos = lines[0]?.[0]?.from ?? 0;
  let hlIndex = findHighlightStart(highlights, firstSpanPos);

  for (let i = 0; i < lines.length && i < endLine - startLine + 1; i++) {
    const lineNumber = startLine + i;
    const line = lines[i];
    if (!line) continue;

    const spans: TagSpan[] = [];

    for (const span of line) {
      if (span.from === span.to) continue;

      if (span.folded) {
        spans.push({ text: '…', tags: '' });
        continue;
      }

      let pos = span.from;
      
      // 从当前索引继续查找
      while (hlIndex < highlights.length && highlights[hlIndex].from < span.to) {
        const hl = highlights[hlIndex];

        if (hl.to <= pos) {
          hlIndex++;
          continue;
        }

        if (hl.from > pos) {
          spans.push({ text: slice(pos, Math.min(hl.from, span.to)), tags: '' });
          pos = Math.min(hl.from, span.to);
        }

        if (hl.from < span.to) {
          const start = Math.max(hl.from, span.from);
          const end = Math.min(hl.to, span.to);
          if (start < end) {
            spans.push({ text: slice(start, end), tags: hl.tags });
            pos = end;
          }
        }

        if (hl.to <= span.to) {
          hlIndex++;
        } else {
          break;
        }
      }

      if (pos < span.to) {
        spans.push({ text: slice(pos, span.to), tags: '' });
      }
    }

    result.set(lineNumber, spans);
  }

  return result;
}

function renderBlock(request: BlockRequest): void {
  const {
    blockId,
    blockIndex,
    startLine,
    endLine,
    width,
    height,
    displayText,
    charWidth,
    lineHeight,
    gutterOffset,
  } = request;

  // 使用缓存的字体信息
  const fontInfoMap = cachedFontInfoMap;
  const defaultFont = cachedDefaultFont;

  // Create OffscreenCanvas for this block
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    post({ type: 'error', message: 'Failed to get 2d context' });
    return;
  }

  // Build line data
  const lineSpans = buildLineSpans(request);

  // Render each line
  ctx.textBaseline = 'ideographic';
  let offsetY = 0;

  for (let lineNum = startLine; lineNum <= endLine; lineNum++) {
    const spans = lineSpans.get(lineNum);
    if (spans && spans.length > 0) {
      drawLine(ctx, spans, fontInfoMap, defaultFont, displayText, gutterOffset, offsetY, charWidth, lineHeight, width);
    }
    offsetY += lineHeight;
  }

  // Convert to ImageBitmap and send back
  const bitmap = canvas.transferToImageBitmap();
  post({ type: 'blockComplete', blockId, blockIndex, bitmap }, [bitmap]);
}

function drawLine(
  ctx: OffscreenCanvasRenderingContext2D,
  spans: TagSpan[],
  fontInfoMap: Record<string, FontInfo>,
  defaultFont: FontInfo,
  displayText: 'blocks' | 'characters',
  offsetX: number,
  offsetY: number,
  charWidth: number,
  lineHeight: number,
  availableWidth: number
): void {
  let cursorX = offsetX;
  let prevFont: FontInfo | null = null;

  for (const span of spans) {
    const info = fontInfoMap[span.tags] || defaultFont;

    if (!prevFont || prevFont.color !== info.color) {
      ctx.fillStyle = info.color;
    }
    if (!prevFont || prevFont.font !== info.font) {
      ctx.font = info.font;
    }
    prevFont = info;

    if (displayText === 'characters') {
      cursorX = drawCharacters(ctx, span.text, cursorX, offsetY, charWidth, lineHeight);
    } else {
      cursorX = drawTextBlocks(ctx, span.text, cursorX, offsetY, charWidth, lineHeight, availableWidth - offsetX);
    }
  }
}

function drawCharacters(
  ctx: OffscreenCanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  charWidth: number,
  lineHeight: number
): number {
  const yPos = y + lineHeight;
  let batchStart = -1;
  let batchX = x;

  for (let i = 0; i <= text.length; i++) {
    const char = text[i];
    const isWhitespace = !char || char === ' ' || char === '\t';

    if (isWhitespace) {
      // 输出之前积累的批次
      if (batchStart !== -1) {
        ctx.fillText(text.slice(batchStart, i), batchX, yPos);
        batchStart = -1;
      }
      if (char) x += charWidth;
    } else {
      // 开始新批次
      if (batchStart === -1) {
        batchStart = i;
        batchX = x;
      }
      x += charWidth;
    }
  }

  return x;
}

function drawTextBlocks(
  ctx: OffscreenCanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  charWidth: number,
  lineHeight: number,
  availableWidth: number
): number {
  const nonWhitespace = /\S+/g;
  let match: RegExpExecArray | null;
  
  while ((match = nonWhitespace.exec(text)) !== null) {
    const startX = x + match.index * charWidth;
    let width = (nonWhitespace.lastIndex - match.index) * charWidth;
    
    if (startX > availableWidth) break;
    if (startX + width > availableWidth) {
      width = availableWidth - startX;
    }
    
    if (width > 0) {
      ctx.fillRect(startX, y, width, lineHeight);
    }
  }
  
  return x + text.length * charWidth;
}

function handleMessage(msg: ToWorkerMessage): void {
  switch (msg.type) {
    case 'init':
      // 重置字体缓存
      cachedFontInfoMap = {};
      cachedDefaultFont = { color: '#000', font: '12px monospace', lineHeight: 14 };
      post({ type: 'ready' });
      break;
    case 'updateFontInfo':
      // 增量合并字体信息
      Object.assign(cachedFontInfoMap, msg.fontInfoMap);
      cachedDefaultFont = msg.defaultFont;
      break;
    case 'renderBlock':
      renderBlock(msg);
      break;
    case 'destroy':
      // 清理缓存
      cachedFontInfoMap = {};
      break;
  }
}

self.onmessage = (e: MessageEvent<ToWorkerMessage>) => {
  try {
    handleMessage(e.data);
  } catch (err) {
    post({ type: 'error', message: String(err) });
  }
};

