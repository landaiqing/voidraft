import { EditorState } from "@codemirror/state";
import { foldNodeProp } from "@codemirror/language";
import { describe, expect, it, vi } from "vitest";

vi.mock("./lang-parser/languages", () => ({
  LANGUAGES: [
    { token: "text" },
    { token: "ts" },
    { token: "json" },
  ],
  languageMapping: {
    text: null,
    ts: null,
    json: null,
  },
}));

import { createDelimiter, getBlocksFromString } from "./parser";
import { CodeBlockLanguage } from "./lang-parser";

function getBlockContentFoldRange(doc: string, targetFrom: number) {
  const state = EditorState.create({ doc });
  const tree = CodeBlockLanguage.parser.parse(doc);
  let foldRange: { from: number; to: number } | null = null;

  tree.iterate({
    enter(node) {
      if (node.name !== "BlockContent" || node.from !== targetFrom) {
        return;
      }

      const prop = node.type.prop(foldNodeProp);
      if (!prop) {
        return false;
      }

      foldRange = prop(node.node, state);
      return false;
    },
  });

  return foldRange;
}

describe("codeblock fold ranges", () => {
  it("默认折叠范围会包含分隔符前的最后一个字符", () => {
    const doc = [
      createDelimiter("ts", false, "write"),
      "public",
      createDelimiter("json", false, "write"),
      "{}",
    ].join("");
    const state = EditorState.create({ doc });
    const [block] = getBlocksFromString(state);

    expect(block).toBeTruthy();

    expect(getBlockContentFoldRange(doc, block!.content.from)).toEqual({
      from: block!.content.from,
      to: block!.content.to,
    });
  });

  it("文档末尾块折叠时不会漏掉最后一个字符", () => {
    const doc = [
      createDelimiter("ts", false, "write"),
      "console.log('done')",
    ].join("");
    const state = EditorState.create({ doc });
    const [block] = getBlocksFromString(state);

    expect(block).toBeTruthy();

    expect(getBlockContentFoldRange(doc, block!.content.from)).toEqual({
      from: block!.content.from,
      to: block!.content.to,
    });
  });
});
