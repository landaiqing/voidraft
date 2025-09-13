import { AST, Option } from 'node-sql-parser';
import { Options, ParserOptions, Plugin } from 'prettier';
import {
  FormatOptions,
  FormatOptionsWithLanguage,
} from 'sql-formatter';

export type SqlBaseOptions = Option &
  Partial<
    | (FormatOptions & { dialect: string })
    | (FormatOptionsWithLanguage & { dialect?: never })
  > & {
    formatter?: 'sql-formatter' | 'node-sql-parser' | 'sql-cst';
    params?: string;
    paramTypes?: string;
    autoDetectDialect?: boolean;
  };

export type SqlOptions = ParserOptions<AST> & SqlBaseOptions;
export type SqlFormatOptions = Options & SqlBaseOptions;
export declare const languages: Plugin["languages"];

export declare const parsers: {
  sql: {
    parse(text: string, options?: SqlOptions): AST | string;
    astFormat: 'sql';
    locStart(): number;
    locEnd(): number;
  };
};

export declare const printers: Plugin["printers"];

export declare const options: Plugin["options"];

export declare function detectDialect(sql: string): string;

declare const SqlPlugin: Plugin<AST | string>;

export default SqlPlugin;
