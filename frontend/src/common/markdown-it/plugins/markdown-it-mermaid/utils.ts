import { v4 as uuidv4 } from "uuid";

/**
 * uuid 生成函数
 * @param split 分隔符
 */
export const genUid = (split = "") => {
    return uuidv4().split("-").join(split);
};

/**
 * 一个简易的sleep函数
 */
export const sleep = async (ms: number) => {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
};

/**
 * 计算字符串的hash值
 * 返回一个数字
 * @param str
 */
export const hashCode = (str: string) => {
    let hash = 0;
    if (str.length === 0) return hash;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
};

/**
 * 一个简易的阻塞函数
 */
export const awaitFor = async (cb: () => boolean, timeout = 0, errText = "超时暂停阻塞") => {
    const start = Date.now();
    while (true) {
        if (cb()) return true;
        if (timeout && Date.now() - start > timeout) {
            console.error("阻塞超时: " + errText);
            return false;
        }
        await sleep(100);
    }
};
