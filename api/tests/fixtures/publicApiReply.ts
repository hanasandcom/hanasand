export function createPublicApiReply() {
    return {
        statusCode: 200,
        headers: {} as Record<string, string>,
        status(code: number) { this.statusCode = code; return this },
        header(name: string, value: string) { this.headers[name.toLowerCase()] = value; return this },
        send(payload: unknown) { return { statusCode: this.statusCode, headers: this.headers, payload } },
    }
}
