import {ensureSyntaxTree} from '@codemirror/language';
import type {EditorState} from '@codemirror/state';
import type {SyntaxNode, Tree} from '@lezer/common';
import {blockState} from '@/views/editor/extensions/codeblock/state';
import type {Block} from '@/views/editor/extensions/codeblock/types';
import {IMAGE_BLOCK_LANGUAGE} from './constants';
import type {ImageBlockItem} from './types';

const NODE_NAMES = {
  imageElement: 'ImageElement',
  imageConfig: 'ImageConfig',
  requiredAttributePair: 'RequiredAttributePair',
  optionalAttributeList: 'OptionalAttributeList',
  optionalAttribute: 'OptionalAttribute',
  refAttribute: 'RefAttribute',
  srcAttribute: 'SrcAttribute',
  widthAttribute: 'WidthAttribute',
  heightAttribute: 'HeightAttribute',
  altAttribute: 'AltAttribute',
  titleAttribute: 'TitleAttribute',
  stringLiteral: 'StringLiteral',
  numberLiteral: 'NumberLiteral',
} as const;

const EMPTY_OPTIONAL_ATTRIBUTE_MAP = new Map<string, SyntaxNode>();
const EMPTY_IMAGE_ITEM_MAP = new Map<number, readonly ImageBlockItem[]>();

function parseQuotedLiteral(raw: string): string {
  if (raw.length < 2) {
    return raw;
  }

  const quote = raw[0];
  if ((quote !== '"' && quote !== '\'') || raw[raw.length - 1] !== quote) {
    return raw;
  }

  if (quote === '"') {
    try {
      return JSON.parse(raw);
    } catch {
      // Keep the raw token if JSON parsing fails.
    }
  }

  let result = '';
  let escaping = false;
  for (const char of raw.slice(1, -1)) {
    if (escaping) {
      if (char === 'n') result += '\n';
      else if (char === 'r') result += '\r';
      else if (char === 't') result += '\t';
      else result += char;
      escaping = false;
      continue;
    }

    if (char === '\\') {
      escaping = true;
      continue;
    }

    result += char;
  }

  return escaping ? `${result}\\` : result;
}

function readStringLiteral(state: EditorState, attribute: SyntaxNode | null | undefined): string | undefined {
  const valueNode = attribute?.getChild(NODE_NAMES.stringLiteral);
  if (!valueNode) {
    return undefined;
  }

  return parseQuotedLiteral(state.sliceDoc(valueNode.from, valueNode.to));
}

function readNumberLiteral(state: EditorState, attribute: SyntaxNode | null | undefined): number | undefined {
  const valueNode = attribute?.getChild(NODE_NAMES.numberLiteral);
  if (!valueNode) {
    return undefined;
  }

  const value = Number(state.sliceDoc(valueNode.from, valueNode.to));
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function getOptionalAttributes(config: SyntaxNode): ReadonlyMap<string, SyntaxNode> {
  const optionalList = config.getChild(NODE_NAMES.optionalAttributeList);
  if (!optionalList) {
    return EMPTY_OPTIONAL_ATTRIBUTE_MAP;
  }

  return new Map(
    optionalList
      .getChildren(NODE_NAMES.optionalAttribute)
      .flatMap(optionalAttribute => {
        const attribute = optionalAttribute.firstChild;
        return attribute ? [[attribute.name, attribute] as const] : [];
      }),
  );
}

function readImageElement(state: EditorState, node: SyntaxNode): ImageBlockItem | null {
  const config = node.getChild(NODE_NAMES.imageConfig);
  const requiredAttributes = config?.getChild(NODE_NAMES.requiredAttributePair);
  if (!config || !requiredAttributes) {
    return null;
  }

  const ref = readStringLiteral(state, requiredAttributes.getChild(NODE_NAMES.refAttribute));
  const src = readStringLiteral(state, requiredAttributes.getChild(NODE_NAMES.srcAttribute));
  if (!ref || !src) {
    return null;
  }

  const optionalAttributes = getOptionalAttributes(config);

  return {
    ref,
    src,
    alt: readStringLiteral(state, optionalAttributes.get(NODE_NAMES.altAttribute)),
    title: readStringLiteral(state, optionalAttributes.get(NODE_NAMES.titleAttribute)),
    width: readNumberLiteral(state, optionalAttributes.get(NODE_NAMES.widthAttribute)),
    height: readNumberLiteral(state, optionalAttributes.get(NODE_NAMES.heightAttribute)),
  };
}

export function isImageBlock(block: Block | null | undefined): block is Block {
  return Boolean(block && block.language.name === IMAGE_BLOCK_LANGUAGE);
}

function collectImageBlockItems(state: EditorState, tree: Tree, block: Block): ImageBlockItem[] {
  const items: ImageBlockItem[] = [];
  tree.iterate({
    from: block.content.from,
    to: block.content.to,
    enter: nodeRef => {
      if (nodeRef.name !== NODE_NAMES.imageElement) {
        return;
      }

      const item = readImageElement(state, nodeRef.node);
      if (item) {
        items.push(item);
      }
    },
  });

  return items;
}

export function getImageBlockItems(state: EditorState, block: Block): ImageBlockItem[] {
  if (!isImageBlock(block)) {
    return [];
  }

  const tree = ensureSyntaxTree(state, state.doc.length, 1000);
  if (!tree) {
    return [];
  }

  return collectImageBlockItems(state, tree, block);
}

export function getImageBlockItemMap(state: EditorState): ReadonlyMap<number, readonly ImageBlockItem[]> {
  const blocks = (state.field(blockState, false) ?? []).filter(isImageBlock);
  if (blocks.length === 0) {
    return EMPTY_IMAGE_ITEM_MAP;
  }

  const tree = ensureSyntaxTree(state, state.doc.length, 1000);
  if (!tree) {
    return EMPTY_IMAGE_ITEM_MAP;
  }

  const entries = blocks
    .map(block => [block.content.from, collectImageBlockItems(state, tree, block)] as const)
    .filter(([, items]) => items.length > 0);

  return entries.length > 0 ? new Map(entries) : EMPTY_IMAGE_ITEM_MAP;
}
