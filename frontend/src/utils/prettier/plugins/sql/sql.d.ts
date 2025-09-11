import { Parser, Plugin } from "prettier";

export declare const languages: Plugin["languages"];
export declare const parsers: {
  sql: Parser;
};
export declare const printers: Plugin["printers"];
export declare const options: Plugin["options"];

declare const plugin: Plugin;
export default plugin;
