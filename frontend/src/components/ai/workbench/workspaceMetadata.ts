export function readWorkspaceMetadata(conversation: AIConversation | null) {
    const metadata = conversation?.workspaceMeta
    return {
        repositoryId: typeof metadata?.repositoryId === 'string' ? metadata.repositoryId : null,
        selectedFilePath: typeof metadata?.selectedFilePath === 'string' ? metadata.selectedFilePath : null,
        recentPaths: Array.isArray(metadata?.recentPaths)
            ? metadata.recentPaths.filter((entry): entry is string => typeof entry === 'string')
            : [],
        lastWorkspaceAction: stringValue(metadata?.lastWorkspaceAction),
        lastWorkspaceActionAt: stringValue(metadata?.lastWorkspaceActionAt),
        lastChangedPath: stringValue(metadata?.lastChangedPath),
        workspaceSource: stringValue(metadata?.workspaceSource),
    }
}

export function workspaceRepositoryId(conversation: AIConversation) {
    const metadata = readWorkspaceMetadata(conversation)
    return metadata.repositoryId !== null
        ? metadata.repositoryId
        : conversation.workspaceKind === 'repo' ? conversation.workspaceId : null
}

function stringValue(value: unknown) {
    return typeof value === 'string' ? value : null
}
