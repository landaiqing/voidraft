import arrays from "./arrays.js";
import blocksAndStatements from "./blocks-and-statements.js";
import classes from "./classes.js";
import expressions from "./expressions.js";
import interfaces from "./interfaces.js";
import lexicalStructure from "./lexical-structure.js";
import names from "./names.js";
import packagesAndModules from "./packages-and-modules.js";
import typesValuesAndVariables from "./types-values-and-variables.js";
const printersByNodeType = Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, arrays), blocksAndStatements), classes), expressions), interfaces), lexicalStructure), names), packagesAndModules), typesValuesAndVariables);
export function printerForNodeType(type) {
    return printersByNodeType[type];
}
