import { StateEffect, StateField } from "@codemirror/state";

// Define an effect to update the visibility state
export const SearchVisibilityEffect = StateEffect.define<boolean>();

// Create a state field to store the visibility state
export const searchVisibilityField = StateField.define({
    create() {
        return false;
    },
    update(value, tr) {
        for (let e of tr.effects) {
          if (e.is(SearchVisibilityEffect)) {
            return e.value;
          }
        }
        return value;
    }
});