import {snapdom} from '@zumer/snapdom';
import {syntaxTree, highlightingFor} from '@codemirror/language';
import {Highlighter, highlightTree} from '@lezer/highlight';
import {Facet, type Extension} from '@codemirror/state';
import {EditorView, Command} from '@codemirror/view';
import type {Block} from '../codeblock/types';
import {blockState, getActiveNoteBlock} from '../codeblock/state';

/**
 * 高亮片段信息
 */
interface HighlightSpan {
  from: number;
  to: number;
  cssClass: string;
}

/**
 * 从语法树获取指定范围的高亮信息
 */
function getHighlights(view: EditorView, from: number, to: number): HighlightSpan[] {
  const tree = syntaxTree(view.state);
  const highlights: HighlightSpan[] = [];

  if (tree.length === 0) {
    return highlights;
  }

  const highlighter: Highlighter = {
    style: tags => highlightingFor(view.state, tags),
  };

  highlightTree(
    tree,
    highlighter,
    (hlFrom, hlTo, cssClass) => {
      if (hlFrom < to && hlTo > from) {
        highlights.push({
          from: Math.max(hlFrom, from),
          to: Math.min(hlTo, to),
          cssClass: cssClass || '',
        });
      }
    },
    from,
    to,
  );

  return highlights;
}

/**
 * 构建带高亮的单行元素
 */
function createHighlightedLine(
  lineText: string,
  lineFrom: number,
  lineTo: number,
  highlights: HighlightSpan[],
): HTMLElement {
  const lineElement = document.createElement('div');
  lineElement.className = 'cm-line';
  lineElement.style.whiteSpace = 'pre';

  if (highlights.length === 0 || lineText.length === 0) {
    lineElement.textContent = lineText || ' ';
    return lineElement;
  }

  const spans: Array<{text: string; cssClass: string}> = [];
  let pos = lineFrom;

  const lineHighlights = highlights
    .filter(h => h.from < lineTo && h.to > lineFrom)
    .sort((a, b) => a.from - b.from);

  for (const hl of lineHighlights) {
    if (hl.from > pos) {
      spans.push({
        text: lineText.slice(pos - lineFrom, hl.from - lineFrom),
        cssClass: '',
      });
    }

    const hlStart = Math.max(hl.from, lineFrom);
    const hlEnd = Math.min(hl.to, lineTo);
    spans.push({
      text: lineText.slice(hlStart - lineFrom, hlEnd - lineFrom),
      cssClass: hl.cssClass,
    });

    pos = hlEnd;
  }

  if (pos < lineTo) {
    spans.push({
      text: lineText.slice(pos - lineFrom),
      cssClass: '',
    });
  }

  for (const span of spans) {
    if (span.cssClass) {
      const spanElement = document.createElement('span');
      spanElement.className = span.cssClass;
      spanElement.textContent = span.text;
      lineElement.appendChild(spanElement);
    } else {
      lineElement.appendChild(document.createTextNode(span.text));
    }
  }

  return lineElement;
}

/**
 * 构建用于截图的块 DOM
 */
function inlineStyle(style: CSSStyleDeclaration, props: string[]): string {
  return props
    .map(prop => {
      const val = style.getPropertyValue(prop);
      return val ? `${prop}:${val};` : '';
    })
    .join('');
}

function getBlockDomElement(view: EditorView, block: Block): HTMLElement | null {
  try {
    const blocks = view.state.field(blockState, false);
    if (!blocks) return null;

    const blockIndex = blocks.indexOf(block);
    const isEvenBlock = blockIndex % 2 === 0;

    const blockLayerElem = view.dom.querySelector(
      `.code-blocks-layer .${isEvenBlock ? 'block-even' : 'block-odd'}`,
    ) as HTMLElement | null;
    const backgroundColor =
      blockLayerElem?.ownerDocument
        ? getComputedStyle(blockLayerElem).backgroundColor
        : isEvenBlock
          ? '#252B37'
          : '#213644';

    const contentDom = view.dom.querySelector('.cm-content') as HTMLElement | null;
    const sourceStyle = contentDom ? getComputedStyle(contentDom) : getComputedStyle(view.dom);

    const container = document.createElement('div');
    container.className = 'cm-editor cm-focused block-export-wrapper';
    container.style.cssText = `
      padding: 18px 22px;
      background-color: ${backgroundColor};
      border-radius: 8px;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.25);
      display: inline-block;
      min-width: 360px;
      max-width: 960px;
      color: ${sourceStyle.color};
      font-family: ${sourceStyle.fontFamily};
      font-size: ${sourceStyle.fontSize};
      line-height: ${sourceStyle.lineHeight};
      position: relative;
    `;

    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'cm-content';
    contentWrapper.style.whiteSpace = 'pre';
    contentWrapper.style.cssText += inlineStyle(sourceStyle, [
      'color',
      'font-family',
      'font-size',
      'font-weight',
      'font-style',
      'line-height',
      'letter-spacing',
      'tab-size',
      'text-rendering',
      'background',
      'background-color',
      'text-shadow',
    ]);

    const highlights = getHighlights(view, block.content.from, block.content.to);
    const fromLine = view.state.doc.lineAt(block.content.from);
    const toLine = view.state.doc.lineAt(block.content.to);
    for (let lineNum = fromLine.number; lineNum <= toLine.number; lineNum++) {
      const line = view.state.doc.line(lineNum);
      const lineElement = createHighlightedLine(line.text, line.from, line.to, highlights);
      contentWrapper.appendChild(lineElement);
    }

    if (block.language.name && block.language.name !== 'text') {
      const langLabel = document.createElement('div');
      langLabel.className = 'block-language-label';
      langLabel.textContent = block.language.name;
      langLabel.style.cssText = `
        position: absolute;
        top: 6px;
        right: 10px;
        padding: 3px 8px;
        background-color: rgba(0, 0, 0, 0.35);
        color: rgba(255, 255, 255, 0.85);
        font-size: 11px;
        font-family: system-ui, -apple-system, sans-serif;
        font-weight: 600;
        border-radius: 4px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        pointer-events: none;
      `;
      container.appendChild(langLabel);
    }

    container.appendChild(contentWrapper);
    return container;
  } catch (error) {
    console.error('[blockImage] Failed to build block DOM:', error);
    return null;
  }
}

/**
 * 将 Canvas 转换为 PNG Blob
 */
function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Canvas toBlob returned null'));
      }
    }, 'image/png');
  });
}

/**
 * 写入剪贴板（PNG）
 */
async function writeImageToClipboard(blob: Blob): Promise<void> {
  const ClipboardItemCtor = (window as any).ClipboardItem;
  if (ClipboardItemCtor && navigator.clipboard?.write) {
    const item = new ClipboardItemCtor({'image/png': blob});
    await navigator.clipboard.write([item]);
    return;
  }
}

/**
 * 将当前活动块导出为图片并复制到剪贴板
 */
async function copyActiveBlockAsImage(view: EditorView): Promise<boolean> {
  const activeBlock = getActiveNoteBlock(view.state);
  if (!activeBlock) {
    console.warn('[blockImage] No active block found');
    return false;
  }

  const targetDom = view.scrollDOM || document.body;
  const prevCursor = (targetDom as HTMLElement).style.cursor;
  (targetDom as HTMLElement).style.cursor = 'progress';

  const blockDom = getBlockDomElement(view, activeBlock);
  if (!blockDom) {
    console.warn('[blockImage] Cannot create block DOM');
    (targetDom as HTMLElement).style.cursor = prevCursor;
    return false;
  }

  // 将节点挂到文档外层，确保样式可用
  const mount = document.createElement('div');
  mount.style.cssText = 'position: fixed; left: -10000px; top: -10000px; pointer-events: none; z-index: -1;';
  mount.appendChild(blockDom);
  document.body.appendChild(mount);

  try {
    const canvas = await snapdom.toCanvas(blockDom, {
      scale: 2,
      dpr: window.devicePixelRatio || 1,
      cache: 'auto',
      backgroundColor: getComputedStyle(blockDom).backgroundColor,
      outerShadows: false,
    });

    const blob = await canvasToPngBlob(canvas);
    await writeImageToClipboard(blob);
    return true;
  } catch (error) {
    console.error('[blockImage] Failed to copy block image:', error);
    return false;
  } finally {
    mount.remove();
    (targetDom as HTMLElement).style.cursor = prevCursor;
  }
}

/**
 * 命令：复制当前块为图片
 */
export const copyBlockImageCommand: Command = view => {
  void copyActiveBlockAsImage(view);
  return true;
};

export const blockImageEnabledFacet = Facet.define<boolean, boolean>({
  combine: values => values.some(Boolean),
});

/**
 * BlockImage 扩展入口
 */
export function createBlockImageExtension(): Extension {
  return [
    blockImageEnabledFacet.of(true),
  ];
}

export default createBlockImageExtension;
