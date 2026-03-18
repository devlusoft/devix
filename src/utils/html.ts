export function safeJsonStringify(value: unknown): string {
    return JSON.stringify(value).replace(/<\/script>/gi, '<\\/script>')
}

export function escapeAttr(value: string): string {
    return value.replace(/"/g, '&quot;')
}