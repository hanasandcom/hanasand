import type { IndexedWorkspaceFile, WorkspaceMatch } from './types'
import { escapeRegExp } from './escapeRegExp'

export function extractClickedToken(word: string | null) {
    return word?.match(/[A-Za-z_$][\w$-]*/)?.[0] || ''
}

export function findSymbolDefinitions(files: IndexedWorkspaceFile[], symbol: string) {
    if (!symbol.trim()) return []
    const escaped = escapeRegExp(symbol.trim())
    const expression = new RegExp(
        `\\b(function\\s+${escaped}|class\\s+${escaped}|interface\\s+${escaped}|type\\s+${escaped}|const\\s+${escaped}|let\\s+${escaped}|var\\s+${escaped}|${escaped}\\s*[:=]\\s*(async\\s*)?(function|\\(|[A-Za-z_$]))\\b`,
    )
    return files.flatMap(file => {
        const lines = file.content.split(/\r?\n/)
        return lines.flatMap((lineText, index) => expression.test(lineText)
            ? [createDefinitionMatch(file, lines, lineText, index, symbol)]
            : [])
    })
}

function createDefinitionMatch(file: IndexedWorkspaceFile, lines: string[], lineText: string, index: number, symbol: string): WorkspaceMatch {
    const column = Math.max(lineText.indexOf(symbol), 0) + 1
    return {
        id: `${file.id}:definition:${index + 1}`,
        file,
        line: index + 1,
        column,
        endColumn: column + symbol.length - 1,
        preview: lineText.trim(),
        functionName: findEnclosingSymbol(lines, index),
    }
}

export function findEnclosingSymbol(lines: string[], lineIndex: number) {
    for (let index = lineIndex; index >= 0; index -= 1) {
        const line = lines[index]
        const match = line.match(/\b(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/)
            || line.match(/\b(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\(|function\b)/)
            || line.match(/\b(?:export\s+)?(?:class|interface|type)\s+([A-Za-z_$][\w$]*)/)
        if (match?.[1]) return match[1]
    }
    return null
}
