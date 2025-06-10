export function simulateBackspace(input: HTMLInputElement, direction: "backward" | "forward" = "backward") {
    let start = input.selectionStart ?? 0;
    let end = input.selectionEnd ?? 0;

    // Do nothing if at boundaries
    if (direction === "backward" && start === 0 && end === 0) return;
    if (direction === "forward" && start === input.value.length && end === input.value.length) return;

    if (start === end) {
        // No selection - simulate Backspace or Delete
        if (direction === "backward") {
            input.value = input.value.slice(0, start - 1) + input.value.slice(end);
            start -= 1;
        } else {
            input.value = input.value.slice(0, start) + input.value.slice(end + 1);
        }
        input.selectionStart = input.selectionEnd = start;
    } else {
        // Text is selected, remove selection regardless of direction
        input.value = input.value.slice(0, start) + input.value.slice(end);
        input.selectionStart = input.selectionEnd = start;
    }

    // Dispatch input event to notify listeners
    input.dispatchEvent(new Event("input", { bubbles: true }));
}