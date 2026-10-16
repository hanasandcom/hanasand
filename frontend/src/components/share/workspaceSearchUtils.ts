export type { IndexedWorkspaceFile, WorkspaceFile, WorkspaceFileMatches, WorkspaceMatch, WorkspaceSearchOptions } from './workspaceSearch/types'
export { flattenWorkspaceTree, isLikelySearchableFile, loadWorkspaceFiles } from './workspaceSearch/workspaceFiles'
export { countMatches, createSearchExpression, replaceInContent, searchIndexedFiles } from './workspaceSearch/matching'
export { extractClickedToken, findEnclosingSymbol, findSymbolDefinitions } from './workspaceSearch/symbols'
