/**
 * Prettier Plugin for TOML file formatting
 * 
 * This plugin provides support for formatting TOML (Tom's Obvious, Minimal Language) files
 * using the @toml-tools/parser and custom beautifier.
 */

import type { Plugin, Parser, Printer, SupportLanguage, SupportOption } from 'prettier';
import { parse } from '@toml-tools/parser';
import { locStart, locEnd } from './loc';
import { print } from './printer';
import type { TomlDocument, TomlCstNode } from './types';

const parserName = 'toml';

// https://prettier.io/docs/en/plugins.html#languages
const languages: SupportLanguage[] = [
  {
    extensions: ['.toml'],
    name: 'Toml',
    parsers: [parserName],
    filenames: ['Cargo.lock', 'Gopkg.lock'],
    tmScope: 'source.toml',
    aceMode: 'toml',
    codemirrorMode: 'toml',
    codemirrorMimeType: 'text/x-toml',
    linguistLanguageId: 365,
    vscodeLanguageIds: ['toml'],
  },
];

// https://prettier.io/docs/en/plugins.html#parsers
const tomlParser: Parser<TomlDocument> = {
  astFormat: 'toml-cst',
  parse: (text: string): TomlDocument => {
    try {
      return parse(text) as TomlDocument;
    } catch (error) {
      console.error('TOML parsing error:', error);
      throw error;
    }
  },
  locStart,
  locEnd,
};

// https://prettier.io/docs/en/plugins.html#printers
const tomlPrinter: Printer<TomlCstNode> = {
  print,
};

// Plugin options
const options: Record<string, SupportOption> = {

};

// Plugin definition
const tomlPlugin: Plugin = {
  languages,
  parsers: {
    [parserName]: tomlParser,
  },
  printers: {
    'toml-cst': tomlPrinter,
  },
  options,
};

export default tomlPlugin;
export { languages };
export const parsers = tomlPlugin.parsers;
export const printers = tomlPlugin.printers;
