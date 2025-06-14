// Cynhyrchwyd y ffeil hon yn awtomatig. PEIDIWCH Â MODIWL
// This file is automatically generated. DO NOT EDIT

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: Unused imports
import {Create as $Create} from "@wailsio/runtime";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: Unused imports
import * as slog$0 from "../../../../../../log/slog/models.js";

export class App {
    /**
     * The main application menu
     */
    "ApplicationMenu": Menu | null;
    "Logger": slog$0.Logger | null;

    /** Creates a new App instance. */
    constructor($$source: Partial<App> = {}) {
        if (!("ApplicationMenu" in $$source)) {
            this["ApplicationMenu"] = null;
        }
        if (!("Logger" in $$source)) {
            this["Logger"] = null;
        }

        Object.assign(this, $$source);
    }

    /**
     * Creates a new App instance from a string or object.
     */
    static createFrom($$source: any = {}): App {
        const $$createField0_0 = $$createType1;
        const $$createField1_0 = $$createType3;
        let $$parsedSource = typeof $$source === 'string' ? JSON.parse($$source) : $$source;
        if ("ApplicationMenu" in $$parsedSource) {
            $$parsedSource["ApplicationMenu"] = $$createField0_0($$parsedSource["ApplicationMenu"]);
        }
        if ("Logger" in $$parsedSource) {
            $$parsedSource["Logger"] = $$createField1_0($$parsedSource["Logger"]);
        }
        return new App($$parsedSource as Partial<App>);
    }
}

export class Menu {

    /** Creates a new Menu instance. */
    constructor($$source: Partial<Menu> = {}) {

        Object.assign(this, $$source);
    }

    /**
     * Creates a new Menu instance from a string or object.
     */
    static createFrom($$source: any = {}): Menu {
        let $$parsedSource = typeof $$source === 'string' ? JSON.parse($$source) : $$source;
        return new Menu($$parsedSource as Partial<Menu>);
    }
}

export class WebviewWindow {

    /** Creates a new WebviewWindow instance. */
    constructor($$source: Partial<WebviewWindow> = {}) {

        Object.assign(this, $$source);
    }

    /**
     * Creates a new WebviewWindow instance from a string or object.
     */
    static createFrom($$source: any = {}): WebviewWindow {
        let $$parsedSource = typeof $$source === 'string' ? JSON.parse($$source) : $$source;
        return new WebviewWindow($$parsedSource as Partial<WebviewWindow>);
    }
}

// Private type creation functions
const $$createType0 = Menu.createFrom;
const $$createType1 = $Create.Nullable($$createType0);
const $$createType2 = slog$0.Logger.createFrom;
const $$createType3 = $Create.Nullable($$createType2);
