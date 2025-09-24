import {foldService} from '@codemirror/language';

export const foldingOnIndent = foldService.of((state, from, to) => {
    const line = state.doc.lineAt(from); // First line
    const lines = state.doc.lines; // Number of lines in the document
    const indent = line.text.search(/\S|$/); // Indent level of the first line
    let foldStart = from; // Start of the fold
    let foldEnd = to; // End of the fold

    // Check the next line if it is on a deeper indent level
    // If it is, check the next line and so on
    // If it is not, go on with the foldEnd
    let nextLine = line;
    while (nextLine.number < lines) {
        nextLine = state.doc.line(nextLine.number + 1); // Next line
        const nextIndent = nextLine.text.search(/\S|$/); // Indent level of the next line

        // If the next line is on a deeper indent level, add it to the fold
        if (nextIndent > indent) {
            foldEnd = nextLine.to; // Set the fold end to the end of the next line
        } else {
            break; // If the next line is not on a deeper indent level, stop
        }
    }

    // If the fold is only one line, don't fold it
    if (state.doc.lineAt(foldStart).number === state.doc.lineAt(foldEnd).number) {
        return null;
    }

    // Set the fold start to the end of the first line
    // With this, the fold will not include the first line
    foldStart = line.to;

    // Return a fold that covers the entire indent level
    return {from: foldStart, to: foldEnd};
});
