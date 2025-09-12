import type { JavaNodePrinter, JavaNodePrinters } from "./helpers.js";
export declare function printerForNodeType<T extends keyof JavaNodePrinters>(type: T): JavaNodePrinter<T>;
