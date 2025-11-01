/**
 * 外部标记器
 * 用于识别代码块内容的边界
 */

import { ExternalTokenizer } from "@lezer/lr";
import { BlockContent } from "./parser.terms";
import { LANGUAGES } from "./languages";

const EOF = -1;

const FIRST_TOKEN_CHAR = "\n".charCodeAt(0);
const SECOND_TOKEN_CHAR = "∞".charCodeAt(0);

// 创建语言标记匹配器
const languageTokensMatcher = LANGUAGES.map(l => l.token).join("|");
const tokenRegEx = new RegExp(`^\\n∞∞∞(${languageTokensMatcher})(-a)?\\n`, "g");

/**
 * 代码块内容标记器
 * 识别 ∞∞∞ 分隔符之间的内容
 */
export const blockContent = new ExternalTokenizer((input) => {
  let current = input.peek(0);
  let next = input.peek(1);

  if (current === EOF) {
    return;
  }

  while (true) {
    // 除非前两个字符是换行符和"∞"字符，否则我们没有代码块内容标记
    // 所以我们不需要检查标记的其余部分
    if (current === FIRST_TOKEN_CHAR && next === SECOND_TOKEN_CHAR) {
      let potentialLang = "";
      for (let i = 0; i < 18; i++) {
        potentialLang += String.fromCharCode(input.peek(i));
      }
      if (potentialLang.match(tokenRegEx)) {
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