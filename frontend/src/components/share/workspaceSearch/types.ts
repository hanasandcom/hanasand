export type WorkspaceFile = {
    id: string
    name: string
    path: string
}

export type IndexedWorkspaceFile = WorkspaceFile & {
    content: string
}

export type WorkspaceSearchOptions = {
    caseSensitive: boolean
    wholeWord: boolean
    regex: boolean
    include: string
    exclude: string
}

export type WorkspaceMatch = {
    id: string
    file: WorkspaceFile
    line: number
    column: number
    endColumn: number
    preview: string
    functionName: string | null
}

export type WorkspaceFileMatches = {
    file: WorkspaceFile
    matches: WorkspaceMatch[]
}
