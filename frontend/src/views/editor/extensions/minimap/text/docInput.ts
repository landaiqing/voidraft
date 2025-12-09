import { Text } from "@codemirror/state";
import { Input } from "@lezer/common";

const INPUT_CHUNK_SIZE = 2048;

export function createDocInput(doc: Text): Input {
  return {
    length: doc.length,
    lineChunks: false,
    chunk(from: number) {
      if (from >= doc.length) {
        return "";
      }

      const to = Math.min(doc.length, from + INPUT_CHUNK_SIZE);
      return doc.sliceString(from, to);
    },
    read(from: number, to: number) {
      return doc.sliceString(from, to);
    },
  };
}
