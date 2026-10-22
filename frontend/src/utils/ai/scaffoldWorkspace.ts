'use client'

import randomId from '@/utils/random/randomId'
import { buildNextjsDockerTemplate } from './nextjsDockerTemplate'
import { ensureWorkspaceRoot, syncTemplateFiles } from './scaffoldWorkspaceShare'

type ScaffoldNextjsDockerWorkspaceProps = {
    projectName?: string | null
    shareId?: string | null
    token: string
    userId: string
    projectFiles?: Array<{ path: string, content: string }>
}

export type ScaffoldedWorkspace = {
    rootId: string
    rootName: string
    rootPath: string
    selectedFilePath: string
    fileCount: number
    files: Array<{ path: string, content: string }>
}

export async function scaffoldNextjsDockerWorkspace({
    projectName,
    shareId,
    token,
    userId,
    projectFiles,
}: ScaffoldNextjsDockerWorkspaceProps): Promise<ScaffoldedWorkspace> {
    const template = buildNextjsDockerTemplate(projectName)
    if (projectFiles?.length) {
        const overrides = new Map(projectFiles.map((file) => [file.path, file.content]))
        const files = template.files.map((file) => ({ ...file, content: overrides.get(file.path) ?? file.content }))
        const knownPaths = new Set(files.map((file) => file.path))
        for (const file of projectFiles) {
            if (!knownPaths.has(file.path)) {
                files.push(file)
                knownPaths.add(file.path)
            }
        }
        template.files = files
    }
    const rootId = shareId || randomId(12)

    await ensureWorkspaceRoot({
        rootId,
        existingShare: Boolean(shareId),
        template,
        token,
        userId,
    })
    await syncTemplateFiles({ rootId, files: template.files, token, userId })

    return {
        rootId,
        rootName: template.rootName,
        rootPath: template.rootPath,
        selectedFilePath: 'README.md',
        fileCount: template.files.length,
        files: template.files,
    }
}
