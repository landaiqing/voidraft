/**
 * 嵌套解析器配置
 * 为不同语言的代码块提供语法高亮支持
 */

import { parseMixed } from "@lezer/common";
import { BlockContent, BlockLanguage } from "./parser.terms.js";
import { languageMapping } from "./languages";

/**
 * 配置嵌套解析器
 * 根据代码块的语言标记选择相应的解析器
 */
export function configureNesting() {
  return parseMixed((node, input) => {
    const id = node.type.id;
    
    if (id === BlockContent) {
      // 获取父节点中的语言标记
      const blockLang = node.node.parent?.firstChild?.getChildren(BlockLanguage)[0];
      let langName = blockLang ? input.read(blockLang.from, blockLang.to) : null;
      
      // 如果 BlockContent 为空，不返回解析器
      // 这可以避免 StreamLanguage 解析器在大缓冲区时出错
      if (node.node.from === node.node.to) {
        return null;
      }
      
      // 处理自动检测标记
      if (langName && langName.endsWith('-a')) {
        langName = langName.slice(0, -2); // 移除 '-a' 后缀
      }
      
      // 查找对应的语言解析器
      if (langName && langName in languageMapping && languageMapping[langName] !== null) {
        return {
          parser: languageMapping[langName],
        };
      }
    }
    
    return null;
  });
} 