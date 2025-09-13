import { printArrayInitializer, printList } from "./helpers.js";
export default {
    arrayInitializer(path, print, options) {
        return printArrayInitializer(path, print, options, "variableInitializerList");
    },
    variableInitializerList(path, print) {
        return printList(path, print, "variableInitializer");
    }
};
