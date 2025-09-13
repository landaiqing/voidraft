import { Parser, Plugin } from "prettier";

export declare const languages: Plugin["languages"];
export declare const parsers: {
  go: Parser;
};
export declare const printers: Plugin["printers"];

declare const plugin: Plugin;
export default plugin;
