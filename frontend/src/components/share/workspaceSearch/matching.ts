import type { IndexedWorkspaceFile, WorkspaceFileMatches, WorkspaceMatch, WorkspaceSearchOptions } from './types'
import { findEnclosingSymbol } from './symbols'
import { escapeRegExp } from './escapeRegExp'

export function createSearchExpression(query: string, options: WorkspaceSearchOptions) {
    const source = options.regex ? query : escapeRegExp(query)
    const boundedSource = options.wholeWord ? `\\b${source}\\b` : source
    return new RegExp(boundedSource, options.caseSensitive ? 'g' : 'gi')
}

export function searchIndexedFiles(files: IndexedWorkspaceFile[], query: string, options: WorkspaceSearchOptions) {
    return searchIndexedFilesWithSymbolResolver(files, query, options, findEnclosingSymbol)
}

export function searchIndexedFilesWithSymbolResolver(
    files: IndexedWorkspaceFile[],
    query: string,
    options: WorkspaceSearchOptions,
    resolveSymbol: typeof findEnclosingSymbol,
) {
    const cleanQuery = query.trim()
    if (!cleanQuery) return []
    const expression = createSearchExpression(cleanQuery, options)
    const filtered = files.filter(file => matchesPathFilters(file.path, options.include, options.exclude))
    const groups: WorkspaceFileMatches[] = []

    for (const file of filtered) {
        const lines = file.content.split(/\r?\n/)
        const matches: WorkspaceMatch[] = []
        lines.forEach((lineText, lineIndex) => {
            expression.lastIndex = 0
            let match = expression.exec(lineText)
            let functionName: string | null = null
            let symbolResolved = false
            while (match) {
                if (!symbolResolved) {
                    functionName = resolveSymbol(lines, lineIndex)
                    symbolResolved = true
                }
                const value = match[0]
                const column = match.index + 1
                matches.push({
                    id: `${file.id}:${lineIndex + 1}:${column}:${matches.length}`,
                    file,
                    line: lineIndex + 1,
                    column,
                    endColumn: column + Math.max(value.length - 1, 0),
                    preview: lineText.trim() || lineText,
                    functionName,
                })
                if (value.length === 0) expression.lastIndex += 1
                match = expression.exec(lineText)
            }
        })
        if (matches.length) groups.push({ file, matches })
    }
    return groups
}

export function replaceInContent(content: string, query: string, replacement: string, options: WorkspaceSearchOptions) {
    return content.replace(createSearchExpression(query, options), replacement)
}

export function countMatches(groups: WorkspaceFileMatches[]) {
    return groups.reduce((count, group) => count + group.matches.length, 0)
}

function matchesPathFilters(path: string, include: string, exclude: string) {
    const includeFilters = splitFilters(include)
    const excludeFilters = splitFilters(exclude)
    const included = includeFilters.length === 0 || includeFilters.some(filter => globLikeMatch(path, filter))
    const excluded = excludeFilters.some(filter => globLikeMatch(path, filter))
    return included && !excluded
}

function splitFilters(value: string) {
    return value.split(',').map(part => part.trim()).filter(Boolean)
}

function globLikeMatch(path: string, filter: string) {
    if (!filter.includes('*')) return path.toLowerCase().includes(filter.toLowerCase())
    const escaped = filter.split('*').map(escapeRegExp).join('.*')
    return new RegExp(`^${escaped}$`, 'i').test(path)
}
