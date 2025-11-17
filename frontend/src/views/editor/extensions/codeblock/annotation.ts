import { Annotation, Transaction } from "@codemirror/state";

/**
 * 统一的 CodeBlock 注解，用于标记内部触发的事务。
 */
export const codeBlockEvent = Annotation.define<string>();

export const LANGUAGE_CHANGE = "codeblock-language-change";
export const ADD_NEW_BLOCK = "codeblock-add-new-block";
export const MOVE_BLOCK = "codeblock-move-block";
export const DELETE_BLOCK = "codeblock-delete-block";
export const CURRENCIES_LOADED = "codeblock-currencies-loaded";
export const CONTENT_EDIT = "codeblock-content-edit";

/**
 * 统一管理的 userEvent 常量。
 */
export const USER_EVENTS = {
  INPUT: "input",
  DELETE: "delete",
  MOVE: "move",
  SELECT: "select",
  DELETE_LINE: "delete.line",
  DELETE_CUT: "delete.cut",
  INPUT_PASTE: "input.paste",
  MOVE_LINE: "move.line",
  MOVE_CHARACTER: "move.character",
  SELECT_BLOCK_BOUNDARY: "select.block-boundary",
  INPUT_REPLACE: "input.replace",
  INPUT_REPLACE_ALL: "input.replace.all",
} as const;

/**
 * 判断事务列表中是否包含指定注解。
 */
export function transactionsHasAnnotation(
  transactions: readonly Transaction[],
  annotation: string
) {
  return transactions.some(
    tr => tr.annotation(codeBlockEvent) === annotation
  );
}

/**
 * 判断事务列表中是否包含任一注解。
 */
export function transactionsHasAnnotationsAny(
  transactions: readonly Transaction[],
  annotations: readonly string[]
) {
  return transactions.some(tr => {
    const value = tr.annotation(codeBlockEvent);
    return value ? annotations.includes(value) : false;
  });
}
