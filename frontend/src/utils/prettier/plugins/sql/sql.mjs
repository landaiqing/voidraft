import { format } from 'sql-formatter';
import { detectDialect } from './detect.mjs';

// Languages
export const languages = [{
    name: "SQL",
    parsers: ["sql"],
    extensions: [".sql"]
}];

// Parsers
export const parsers = {
    sql: {
        parse: (text) => text,
        astFormat: "sql-format",
        locStart: (node) => 0,
        locEnd: (node) => node.length
    }
};

// Printers
export const printers = {
    "sql-format": {
        print: (path) => {
            const text = path.getValue();
            
            if (!text || typeof text !== 'string') {
                return text;
            }

            try {
                // 自动检测SQL方言
                const dialect = detectDialect(text);
                
                // 格式化配置 - 使用固定的最佳实践配置
                const formatOptions = {
                    language: dialect,
                    tabWidth: 2,
                    useTabs: true,
                    keywordCase: 'upper',
                    dataTypeCase: 'upper', 
                    functionCase: 'upper',
                    identifierCase: 'preserve'
                };

                return format(text, formatOptions);
            } catch (error) {
                return text;
            }
        }
    }
};


// Default export
export default {
    languages,
    parsers,
    printers
};