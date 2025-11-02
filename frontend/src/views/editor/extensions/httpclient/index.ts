/**
 * HTTP Client 扩展
 */

import {Extension} from '@codemirror/state';

import {httpRequestsField, httpRunButtonGutter, httpRunButtonTheme} from './widgets/run-gutter';

/**
 * 创建 HTTP Client 扩展
 */
export function createHttpClientExtension(): Extension[] {
    return [
        httpRequestsField,
        httpRunButtonGutter,
        httpRunButtonTheme,
    ] as Extension[];
}


