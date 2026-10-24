'use client'

import randomId from '@/utils/random/randomId'
import { buildNextjsDockerTemplate, mergeNextjsDockerProjectFiles } from './nextjsDockerTemplate'
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
    if (projectFiles?.length) template.files = mergeNextjsDockerProjectFiles(template.files, projectFiles)
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
