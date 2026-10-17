export type GeneratedFile = {
    path: string
    content: string
}

export type GeneratedProject = {
    label: string
    files: GeneratedFile[]
}

export type GeneratedBuilderResponse = {
    status: 'completed'
    provider: 'hanasand-ai'
    model: 'share-builder'
    message: string
    cache?: {
        hit: boolean
        key: string
        category: 'scaffold' | 'diagnostic' | 'package_metadata' | 'deployment_fix'
    }
}
