import { createHash } from 'node:crypto'
import type { GeneratedBuilderResponse } from './aiProjectBuilderTypes.ts'
import { chooseProject } from './aiProjectBuilderSelection.ts'
import { toolTag } from './aiProjectBuilderText.ts'

type CommonCacheCategory = NonNullable<GeneratedBuilderResponse['cache']>['category']

const commonResponseCache = new Map<string, {
    response: GeneratedBuilderResponse
    updatedAt: number
}>()
const MAX_COMMON_RESPONSE_CACHE_ITEMS = 80

export function buildShareProjectResponse(prompt: string): GeneratedBuilderResponse | null {
    if (!/\b(build|create|make|generate|scaffold|website|site|app|bot|api|backend|worker|queue|dashboard|portal|tool|starter|page|fix|repair|rebuild|self-hostable|runnable project)\b/i.test(prompt)) {
        return null
    }

    const category = cacheCategoryForPrompt(prompt)
    const promptHash = createHash('sha256').update(prompt).digest('hex')
    const cacheKey = `${category}:${promptHash}`
    const cached = commonResponseCache.get(cacheKey)
    if (cached) {
        cached.updatedAt = Date.now()
        return {
            ...cached.response,
            cache: {
                key: cached.response.cache?.key || cacheKey,
                category: cached.response.cache?.category || category,
                hit: true,
            },
        }
    }

    const project = chooseProject(prompt)
    const response: GeneratedBuilderResponse = {
        status: 'completed',
        provider: 'hanasand-ai',
        model: 'share-builder',
        message: [
            `Prepared a runnable ${project.label} with the files needed to start it.`,
            toolTag('.gitignore', 'node_modules/\n.next/\ndist/\n.env\n.env.*\n!.env.example\n'),
            toolTag('.dockerignore', 'node_modules\n.next\ndist\n.git\n.env\n.env.*\n!.env.example\n'),
            ...project.files.map((file) => toolTag(file.path, file.content)),
        ].join('\n\n'),
        cache: {
            hit: false,
            key: cacheKey,
            category,
        },
    }
    rememberCommonResponse(cacheKey, response)
    return response
}

function rememberCommonResponse(key: string, response: GeneratedBuilderResponse) {
    commonResponseCache.set(key, {
        response: {
            ...response,
            ...(response.cache ? { cache: { ...response.cache } } : {}),
        },
        updatedAt: Date.now(),
    })
    if (commonResponseCache.size <= MAX_COMMON_RESPONSE_CACHE_ITEMS) {
        return
    }
    const oldest = [...commonResponseCache.entries()]
        .sort((left, right) => left[1].updatedAt - right[1].updatedAt)[0]?.[0]
    if (oldest) {
        commonResponseCache.delete(oldest)
    }
}

function cacheCategoryForPrompt(prompt: string): CommonCacheCategory {
    const lower = prompt.toLowerCase()
    if (/\b(package|dependency|dependencies|npm|bun|pnpm|version|metadata)\b/.test(lower)) {
        return 'package_metadata'
    }
    if (/\b(deploy|deployment|vercel|netlify|docker|compose|ssl|domain|env|build failed|runtime)\b/.test(lower)) {
        return 'deployment_fix'
    }
    if (/\b(diagnostic|debug|why failed|error|logs|fix|repair)\b/.test(lower)) {
        return 'diagnostic'
    }
    return 'scaffold'
}
