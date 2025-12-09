import { Lines } from "./linesState";

const DEFAULT_LINE_NUMBER = 0;

function lineBoundary(spans: Lines[number]) {
  if (!spans || spans.length === 0) {
    return { start: 0, end: 0 };
  }
  const start = spans[0].from;
  const end = spans[spans.length - 1].to;
  return { start, end };
}

export function lineNumberAt(lines: Lines, position: number): number {
  if (!lines.length) {
    return DEFAULT_LINE_NUMBER;
  }

  const first = lineBoundary(lines[0]);
  const last = lineBoundary(lines[lines.length - 1]);

  let target = position;
  if (target < first.start) {
    target = first.start;
  } else if (target > last.end) {
    target = last.end;
  }

  let low = 0;
  let high = lines.length - 1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    const spans = lines[mid];
    const { start, end } = lineBoundary(spans);

    if (target < start) {
      high = mid - 1;
      continue;
    }

    if (target > end) {
      low = mid + 1;
      continue;
    }

    return mid + 1;
  }

  return Math.max(1, Math.min(lines.length, low + 1));
}

export function lineLength(spans: Lines[number]) {
  if (!spans) {
    return 1;
  }

  let length = 0;
  for (const span of spans) {
    length += span.folded ? 1 : Math.max(0, span.to - span.from);
  }

  return Math.max(1, length);
}

export function offsetWithinLine(pos: number, spans: Lines[number]) {
  if (!spans) {
    return 0;
  }

  let offset = 0;

  for (const span of spans) {
    const spanLength = span.folded ? 1 : Math.max(0, span.to - span.from);
    if (!span.folded && pos < span.to) {
      return offset + Math.max(0, pos - span.from);
    }
    if (span.folded && pos <= span.to) {
      return offset;
    }
    offset += spanLength;
  }

  return offset;
}
