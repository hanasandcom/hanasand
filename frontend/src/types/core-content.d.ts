type Theme = 'light' | 'dark' | undefined

type Cookie = {
    name: string
    value: string
}

type Commit = {
    sha: string
    node_id: string
    commit: InnerCommit
}

type InnerCommit = {
    author: Author
    committer: Committer
    message: string
    tree: CommitTree
    url: string
    comment_count: number
    verification: Verification
}

type Author = {
    name: string
    email: string
    date: string
}

type Committer = {
    name: string
    email: string
    date: string
}

type CommitTree = {
    sha: string
    url: string
}

type Verification = {
    verified: boolean
    reason: string
    signature: null
    payload: null
    verified_at: null
}

type Article = {
    id: string
    size: number
    created: string
    modified: string
    metadata: {
        image: string
        description: string
        wordCount: number
        estimatedMinutes: number
    }
    title: string
    content: string
}

type GithubContent = {
    name: string
    path: string
    sha: string
    size: number
    url: string
    html_url: string
    git_url: string
    download_url: string
    type: string
    _links: ContentLinks
}

type ContentLinks = {
    self: string
    git: string
    html: string
}

type GitHubContentFile = {
    name: string
    path: string
    sha: string
    size: number
    url: string
    html_url: string
    git_url: string
    download_url: string
    type: string
    content: string
    encoding: string
    _links: ContentLinks
}

type GitHubFile = {
    name: string
    text: string
    commits: Commit[]
}

type Share = {
    id: string
    path: string
    content: string
    wordCount: number
    estimatedMinutes: number
    timestamp: string
    git: string | null
    locked: boolean
    owner: string
    parent: string
    alias: string
}

type ShareWithTree = Share & { tree: Tree }

type Link = {
    id: string
    path: string
}

type FullLink = {
    id: string
    path: string
    visits: number
    timestamp: string
}

type File = {
    id: string
    path: string
    content: string
    timestamp: string
}

type PostFileResponse = {
    id: string
}

type Breach = {
    ok: boolean
    count: number
    message: string
    source?: string
    checkedPrefix?: string
    files?: BreachFile[]
}

type BreachFile = {
    file: string
    count: number
    lineRanges: [number, number][]
}

type Articles = {
    recent: Article[]
    articles: Article[]
}

type User = {
    email?: string | null
    created_at?: string | null
    last_login_at?: string | null
    username?: string
    id: string
    name: string
    avatar: string
    active?: boolean
    deactivated_at?: string | null
    deactivated_by?: string | null
    organization_memberships?: { id: string, name: string, slug: string | null, status: string }[]
}

type Thought = {
    id: string
    title: string
    created_at: string
    created_by: string
    updated_at: string
}

type Note = {
    id: string
    title: string
    content: string
    source: string
    created_at: string
    updated_at: string
}

type Updates = {
    path?: string
    content?: string
    name?: string
}
