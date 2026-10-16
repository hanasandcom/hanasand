'use client'

import randomId from '@/utils/random/randomId'
import { buildNextjsDockerTemplate } from './nextjsDockerTemplate'
import { ensureWorkspaceRoot, syncTemplateFiles } from './scaffoldWorkspaceShare'

type ScaffoldNextjsDockerWorkspaceProps = {
    projectName?: string | null
    shareId?: string | null
    token: string
    userId: string
}

export type ScaffoldedWorkspace = {
    rootId: string
    rootName: string
    rootPath: string
    selectedFilePath: string
    fileCount: number
}

export async function scaffoldNextjsDockerWorkspace({
    projectName,
    shareId,
    token,
    userId,
}: ScaffoldNextjsDockerWorkspaceProps): Promise<ScaffoldedWorkspace> {
    const template = buildNextjsDockerTemplate(projectName)
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
    }
}
