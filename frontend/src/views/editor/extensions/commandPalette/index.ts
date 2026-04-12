import type { Command } from "@codemirror/view";
import { commandPaletteManager } from "./manager";

export const openCommandPaletteCommand: Command = () => {
    commandPaletteManager.show();
    return true;
};
