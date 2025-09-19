importScripts("guesslang.min.js")

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
            // 返回置信度最高的结果
            const bestResult = result[0]
            if (bestResult.confidence > 0.15) {
                sendResult(bestResult.languageId, bestResult.confidence, idx)
                return
            }
        }
        sendResult("text", 0.0, idx)
    }).catch(() => {
        sendResult("text", 0.0, idx)
    })
}
