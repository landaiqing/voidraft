/**
 * Prettier Plugin for Groovy/Jenkins file formatting
 * 
 * This plugin provides support for formatting Groovy and Jenkins files using the groovy-beautify library.
 * It supports .groovy files and Jenkins-related files like Jenkinsfile.
 */
import type { Plugin, Parser, Printer } from 'prettier';
import groovyBeautify from 'groovy-beautify';

const parserName = 'groovy';

// 语言配置
const languages = [
    {
        name: 'Groovy',
        aliases: ['groovy'],
        parsers: [parserName],
        filenames: ['jenkinsfile', 'Jenkinsfile'],
        extensions: ['.jenkinsfile', '.Jenkinsfile', '.groovy'],
        aceMode: 'groovy',
        tmScope: 'source.groovy',
        linguistLanguageId: 142,
        vscodeLanguageIds: ['groovy']
    },
];

// 解析器配置
const groovyParser: Parser<string> = {
    astFormat: parserName,
    parse: (text: string) => text,
    locStart: () => 0,
    locEnd: (node: string) => node.length,
};

// 打印器配置
const groovyPrinter: Printer<string> = {
    print: (path, options) => {
        try {
            return groovyBeautify(path.node, {
                width: options.printWidth || 80,
            }).trim();
        } catch (_error) {
            return path.node;
        }
    },
};

const options = {

};

// 插件对象
const groovyPlugin: Plugin = {
    languages,
    parsers: {
        [parserName]: groovyParser,
    },
    printers: {
        [parserName]: groovyPrinter,
    },
    options,
};

export default groovyPlugin;
export { languages };
export const parsers = groovyPlugin.parsers;
export const printers = groovyPlugin.printers;