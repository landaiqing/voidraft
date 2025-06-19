importScripts("guesslang.min.js")

const LANGUAGES = ["json", "py", "html", "sql", "md", "java", "php", "css", "xml", "cpp", "rs", "cs", "rb", "sh", "yaml", "toml", "go", "clj", "ex", "erl", "js", "ts", "swift", "kt", "groovy", "ps1", "dart", "scala"]

const guessLang = new self.GuessLang()

function sendResult(language, confidence, idx) {
    postMessage({language, confidence, idx})
}

onmessage = (event) => {
    const {content, idx} = event.data

    // JSON 快速检测
    const trimmed = content.trim()
    if ((trimmed.startsWith("{") && trimmed.endsWith("}")) ||
        (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
        try {
            if (typeof JSON.parse(trimmed) === "object") {
                sendResult("json", 1.0, idx)
                return
            }
        } catch (e) {

        }
    }

    guessLang.runModel(content).then((result) => {
        if (result.length > 0) {
            const lang = result[0]
            if (LANGUAGES.includes(lang.languageId) && lang.confidence > 0.15) {
                sendResult(lang.languageId, lang.confidence, idx)
                return
            }
        }

        for (let lang of result) {
            if (LANGUAGES.includes(lang.languageId) && lang.confidence > 0.5) {
                sendResult(lang.languageId, lang.confidence, idx)
                return
            }
        }

        sendResult("text", 0.0, idx)
    }).catch(() => {
        sendResult("text", 0.0, idx)
    })
}
