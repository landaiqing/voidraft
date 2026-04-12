export function createBlockCreatedAt(): string {
    return new Date().toISOString();
}

export function formatBlockCreatedAt(
    value?: string,
    options: Intl.DateTimeFormatOptions = {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    },
    locale?: string,
): string {
    if (!value) {
        return "";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return new Intl.DateTimeFormat(locale, options).format(date);
}
