import { describe, expect, it } from 'vitest';
import { parser } from './image.parser';

function parseCode(code: string) {
  return parser.parse(code);
}

function getErrorNodes(tree: any, code: string) {
  const errors: Array<{ from: number; to: number; text: string }> = [];

  tree.iterate({
    enter: (node: any) => {
      if (node.type?.isError || node.name === '⚠') {
        errors.push({
          from: node.from,
          to: node.to,
          text: code.slice(node.from, node.to),
        });
      }
    },
  });

  return errors;
}

function countNodes(tree: any, name: string) {
  let count = 0;

  tree.iterate({
    enter: (node: any) => {
      if (node.name === name) {
        count += 1;
      }
    },
  });

  return count;
}

describe('image grammar', () => {
  it('parses flat img records with required ref and src', () => {
    const code = `img(ref="media-id-1", src="/media/2026/04/a.png", alt="封面", width=320, height=180, title="封面图")
img(ref="media-id-2", src="/media/2026/04/b.png", alt="流程图", width=240, height=240)
img(ref="media-id-3", src="https://example.com/demo.png", alt="外链图")`;

    const tree = parseCode(code);
    const errors = getErrorNodes(tree, code);

    expect(errors).toHaveLength(0);
    expect(countNodes(tree, 'ImageElement')).toBe(3);
    expect(countNodes(tree, 'RefAttribute')).toBe(3);
    expect(countNodes(tree, 'SrcAttribute')).toBe(3);
    expect(countNodes(tree, 'WidthAttribute')).toBe(2);
    expect(countNodes(tree, 'HeightAttribute')).toBe(2);
    expect(countNodes(tree, 'AltAttribute')).toBe(3);
    expect(countNodes(tree, 'TitleAttribute')).toBe(1);
  });

  it('supports required attributes in either order', () => {
    const code = `img(src="/media/2026/04/a.png", ref="media-id-1", alt="封面")
img(ref="media-id-2", src="/media/2026/04/b.png")`;

    const tree = parseCode(code);
    const errors = getErrorNodes(tree, code);

    expect(errors).toHaveLength(0);
    expect(countNodes(tree, 'ImageElement')).toBe(2);
    expect(countNodes(tree, 'RefAttribute')).toBe(2);
    expect(countNodes(tree, 'SrcAttribute')).toBe(2);
  });

  it('rejects plain text lines', () => {
    const code = `hello world
img(ref="media-id-1", src="/media/2026/04/a.png")`;

    const tree = parseCode(code);
    const errors = getErrorNodes(tree, code);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects records missing ref or src', () => {
    const code = `img(ref="media-id-1", alt="only ref")
img(src="/media/2026/04/a.png", alt="only src")`;

    const tree = parseCode(code);
    const errors = getErrorNodes(tree, code);

    expect(errors.length).toBeGreaterThan(0);
  });
});
