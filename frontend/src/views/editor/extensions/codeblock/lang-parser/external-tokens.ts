/**
 * 外部标记器
 * 用于识别代码块内容的边界
 */

import { ExternalTokenizer } from "@lezer/lr";
import { BlockContent } from "./parser.terms";
import { LANGUAGES } from "./languages";
import { DELIMITER_PREFIX, DELIMITER_SUFFIX } from "../types";

const EOF = -1;
const FIRST_TOKEN_CHAR = DELIMITER_PREFIX.charCodeAt(0);
const SECOND_TOKEN_CHAR = DELIMITER_PREFIX.charCodeAt(1);

const languageTokensMatcher = LANGUAGES.map(l => l.token).join("|");
const escapeForRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const tokenRegEx = new RegExp(
  `^${escapeForRegex(DELIMITER_PREFIX)}(?:${languageTokensMatcher})(?:-(?:a|r|w))*(?:;created=[^\\n;]+)?${escapeForRegex(DELIMITER_SUFFIX)}`,
);
const maxDelimiterLookahead = 256;

/**
 * 代码块内容标记器
 * 识别分隔符之间的内容
 */
export const blockContent = new ExternalTokenizer((input) => {
  let current = input.peek(0);
  let next = input.peek(1);

  if (current === EOF) {
    return;
  }

  while (true) {
    if (current === FIRST_TOKEN_CHAR && next === SECOND_TOKEN_CHAR) {
      let potentialDelimiter = "";
      for (let i = 0; i < maxDelimiterLookahead; i++) {
        const char = input.peek(i);
        if (char === EOF) {
          break;
        }
        potentialDelimiter += String.fromCharCode(char);
      }

      if (tokenRegEx.test(potentialDelimiter)) {
        input.acceptToken(BlockContent);
        return;
      }
    }

    if (next === EOF) {
      input.acceptToken(BlockContent, 1);
      return;
    }

    current = input.advance(1);
    next = input.peek(1);
  }
});
