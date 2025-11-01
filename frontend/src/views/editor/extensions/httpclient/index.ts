/**
 * HTTP Client 扩展
 */

import {Extension} from '@codemirror/state';

import {httpRequestsField, httpRunButtonGutter, httpRunButtonTheme} from './widgets/run-gutter';
import {responseCacheField} from "@/views/editor/extensions/httpclient/parser/response-inserter";

/**
 * 创建 HTTP Client 扩展
 */
export function createHttpClientExtension(): Extension[] {
    return [
        responseCacheField,
        httpRequestsField,
        httpRunButtonGutter,
        httpRunButtonTheme,
    ] as Extension[];
}


