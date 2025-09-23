import type { Plugin, SupportLanguage, Parser, Printer, SupportOption } from 'prettier'
import dockerfileInit, { format } from './docker_fmt_vite.js'

// Language configuration for Dockerfile
const languages: SupportLanguage[] = [
    {
        name: 'dockerfile',
        parsers: ['dockerfile'],
        extensions: ['.docker', '.Dockerfile'],
        filenames: ['Dockerfile', 'dockerfile'],
        linguistLanguageId: 99,
        vscodeLanguageIds: ['dockerfile'],
    },
]

// Parser configuration
const parsers: Record<string, Parser<any>> = {
    dockerfile: {
        parse: (text: string) => {
            // For Dockerfile, we don't need complex parsing, just return the text
            // The formatting will be handled by the print function
            return { type: 'dockerfile', value: text }
        },
        astFormat: 'dockerfile',
        locStart: () => 0,
        locEnd: () => 0,
    },
}

// Printer configuration
const printers: Record<string, Printer<any>> = {
    dockerfile: {
        // @ts-expect-error -- Support async printer like shell plugin
        async print(path: any, options: any) {
            await ensureInitialized()
            const text = path.getValue().value || path.getValue()
            
            try {
                const formatted = format(text, {
                    indent: options.tabWidth || 2,
                    trailingNewline: true,
                    spaceRedirects: options.spaceRedirects !== false,
                })
                return formatted
            } catch (error) {
                console.warn('Dockerfile formatting error:', error)
                return text
            }
        },
    },
}

// WASM initialization
let isInitialized = false
let initPromise: Promise<void> | null = null

async function ensureInitialized(): Promise<void> {
    if (isInitialized) {
        return Promise.resolve()
    }
    
    if (!initPromise) {
        initPromise = (async () => {
            try {
                await dockerfileInit()
                isInitialized = true
            } catch (error) {
                console.warn('Failed to initialize Dockerfile WASM module:', error)
                initPromise = null
                throw error
            }
        })()
    }
    
    return initPromise
}

// Configuration mapping function
function mapOptionsToConfig(options: any) {
    return {
        indent: options.tabWidth || 2,
        trailingNewline: options.insertFinalNewline !== false,
        spaceRedirects: options.spaceRedirects !== false,
    }
}

// Plugin options
const options: Record<string, SupportOption> = {
    spaceRedirects: {
        type: 'boolean',
        category: 'Format',
        default: true,
        description: 'Add spaces around redirect operators',
    },
}

// Plugin definition
const plugin: Plugin = {
    languages,
    parsers,
    printers,
    options,
    defaultOptions: {
        tabWidth: 2,
        useTabs: false,
        spaceRedirects: true,
    },
}

export default plugin
export { languages, parsers, printers, options }