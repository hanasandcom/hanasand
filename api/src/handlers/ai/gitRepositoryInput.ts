export type ParsedGitRepo = {
    host: string
    owner: string
    repo: string
    fullName: string
    repositoryUrl: string
    branch?: string
    sourcePath: string
    webBaseUrl?: string
    isGitHub: boolean
}

export function parseGitInput(input: string): ParsedGitRepo {
    const trimmed = input.trim()
    const urlMatch = trimmed.match(/^https?:\/\/github\.com\/([^/]+)\/([^/#?]+)(?:\/tree\/([^/?#]+)(?:\/(.*))?)?/i)
    if (urlMatch) {
        return buildGitHubRepo(urlMatch[1], urlMatch[2], urlMatch[3], urlMatch[4])
    }

    const genericUrl = parseGenericGitUrl(trimmed)
    if (genericUrl) {
        return genericUrl
    }

    const hostPathMatch = trimmed.match(/^([^/\s]+\.[^/\s]+)\/(.+?)(?:#([^\s:]+))?(?::(.+))?$/)
    if (hostPathMatch) {
        const parsed = buildGenericGitRepo({
            host: hostPathMatch[1],
            repoPath: hostPathMatch[2],
            repositoryUrl: `https://${hostPathMatch[1]}/${hostPathMatch[2]}`,
            branch: hostPathMatch[3],
            sourcePath: hostPathMatch[4] || '',
            webBaseUrl: `https://${hostPathMatch[1]}/${hostPathMatch[2].replace(/\.git$/i, '')}`,
        })
        if (parsed) {
            return parsed
        }
    }

    const shortMatch = trimmed.match(/^([^/\s]+)\/([^#\s]+)(?:#([^\s:]+))?(?::(.+))?$/)
    if (!shortMatch) {
        throw new Error('Use a Git URL, GitHub URL, or owner/repo format.')
    }

    return buildGitHubRepo(shortMatch[1], shortMatch[2], shortMatch[3], shortMatch[4])
}

function buildGitHubRepo(owner: string, repo: string, branch?: string, sourcePath?: string): ParsedGitRepo {
    const parsed = buildGenericGitRepo({
        host: 'github.com',
        repoPath: `${owner}/${repo}`,
        branch,
        sourcePath,
    })
    if (!parsed) {
        throw new Error('Invalid GitHub repository path.')
    }

    return parsed
}

function parseGenericGitUrl(input: string): ParsedGitRepo | null {
    const scpLikeMatch = input.match(/^git@([^:]+):(.+?)(?:#([^\s:]+))?(?::(.+))?$/i)
    if (scpLikeMatch) {
        const repoPath = scpLikeMatch[2].replace(/^\/+|\/+$/g, '')
        return buildGenericGitRepo({
            host: scpLikeMatch[1],
            repoPath,
            repositoryUrl: `https://${scpLikeMatch[1]}/${repoPath}`,
            branch: scpLikeMatch[3],
            sourcePath: scpLikeMatch[4] || '',
            webBaseUrl: `https://${scpLikeMatch[1]}/${repoPath.replace(/\.git$/i, '')}`,
        })
    }

    const sshSlashMatch = input.match(/^git@([^/\s]+)\/(.+?)(?:#([^\s:]+))?(?::(.+))?$/i)
    if (sshSlashMatch) {
        const repoPath = sshSlashMatch[2].replace(/^\/+|\/+$/g, '')
        return buildGenericGitRepo({
            host: sshSlashMatch[1],
            repoPath,
            repositoryUrl: `https://${sshSlashMatch[1]}/${repoPath}`,
            branch: sshSlashMatch[3],
            sourcePath: sshSlashMatch[4] || '',
            webBaseUrl: `https://${sshSlashMatch[1]}/${repoPath.replace(/\.git$/i, '')}`,
        })
    }

    let url: URL
    try {
        url = new URL(input)
    } catch {
        return null
    }

    if (!['http:', 'https:', 'git:', 'ssh:', 'git+ssh:'].includes(url.protocol)) {
        return null
    }

    const pathParts = url.pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean)
    const treeIndex = pathParts.findIndex((part) => ['tree', 'src', 'branch'].includes(part.toLowerCase()))
    const repoParts = treeIndex >= 0 ? pathParts.slice(0, treeIndex) : pathParts
    const hashTarget = url.hash ? url.hash.slice(1) : ''
    const [hashBranch, ...hashSourceParts] = hashTarget.split(':')
    const branch = treeIndex >= 0 ? pathParts[treeIndex + 1] : hashBranch || undefined
    const sourcePath = treeIndex >= 0 ? pathParts.slice(treeIndex + 2).join('/') : hashSourceParts.join(':')
    if (!repoParts.length) {
        return null
    }

    return buildGenericGitRepo({
        host: url.host,
        repoPath: repoParts.join('/'),
        repositoryUrl: buildCloneUrl(url, repoParts),
        branch,
        sourcePath,
        webBaseUrl: `${url.protocol}//${url.host}/${repoParts.join('/').replace(/\.git$/i, '')}`,
    })
}

function buildGenericGitRepo({
    host,
    repoPath,
    repositoryUrl = '',
    branch,
    sourcePath = '',
    webBaseUrl,
}: {
    host: string
    repoPath: string
    repositoryUrl?: string
    branch?: string
    sourcePath?: string
    webBaseUrl?: string
}): ParsedGitRepo | null {
    const parts = repoPath.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean)
    if (!parts.length || (host.toLowerCase() !== 'github.com' && !repositoryUrl)) {
        return null
    }

    const lastPart = parts.at(-1)
    if (!lastPart) {
        return null
    }

    const repo = lastPart.replace(/\.git$/i, '')
    const owner = parts.at(-2) || host
    const cleanRepoPath = [...parts.slice(0, -1), repo].join('/')
    const normalizedHost = host.toLowerCase()
    return {
        host: normalizedHost,
        owner,
        repo,
        fullName: normalizedHost === 'github.com' && parts.length >= 2 ? `${owner}/${repo}` : `${normalizedHost}/${cleanRepoPath}`,
        repositoryUrl: normalizedHost === 'github.com'
            ? `https://github.com/${cleanRepoPath}.git`
            : repositoryUrl.endsWith('.git')
                ? repositoryUrl
                : `${repositoryUrl}.git`,
        branch,
        sourcePath: sourcePath.replace(/^\/+|\/+$/g, ''),
        webBaseUrl: webBaseUrl || (normalizedHost === 'github.com' ? `https://github.com/${cleanRepoPath}` : undefined),
        isGitHub: normalizedHost === 'github.com',
    }
}

function buildCloneUrl(url: URL, repoParts: string[]) {
    const cleanPath = repoParts.join('/')
    if ((url.protocol === 'ssh:' || url.protocol === 'git+ssh:') && url.username === 'git') {
        return `https://${url.host}/${cleanPath}${cleanPath.endsWith('.git') ? '' : '.git'}`
    }

    if ((url.protocol === 'ssh:' || url.protocol === 'git+ssh:') && url.username) {
        return `${url.username}@${url.host}:${cleanPath}${cleanPath.endsWith('.git') ? '' : '.git'}`
    }

    return `${url.protocol}//${url.host}/${cleanPath}${cleanPath.endsWith('.git') ? '' : '.git'}`
}
