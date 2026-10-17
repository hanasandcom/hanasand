export function assertGeneratedOutputLineCap(content, filePath, limit = 200) {
    const lineCount = content ? content.split(/\r\n|\n|\r/).length - (/(\r\n|\n|\r)$/.test(content) ? 1 : 0) : 0
    if (lineCount > limit) throw new Error(`${lineCount} lines (limit ${limit}): ${filePath}`)
    return lineCount
}
