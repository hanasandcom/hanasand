export type MetadataPanel = 'workspace' | 'info' | 'terminal' | 'symbols' | 'git' | 'phone' | 'box' | 'chat' | null

export type VisibleMetadataPanel = Exclude<MetadataPanel, null>
