/**
 * HTTP Client 扩展
 */

import {Extension} from '@codemirror/state';

import {httpRunButtonGutter, httpRunButtonTheme} from './widgets/run-gutter';

/**
 * 创建 HTTP Client 扩展
 */
export function createHttpClientExtension(): Extension[] {

    const extensions: Extension[] = [];

    // HTTP 语言解析器
    // extensions.push(httpLanguage);

    // 运行按钮 Gutte
    extensions.push(httpRunButtonGutter);
    extensions.push(httpRunButtonTheme);


    // TODO: 后续阶段添加
    // - 自动补全（可选）
    // - 变量支持（可选）

    return extensions;
}


