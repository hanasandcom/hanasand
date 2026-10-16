type Certificate = {
    id: string
    public_key: string
    name: string
    owner: string
    created_at: string
    created_by: string
}

type BlocklistEntry = {
    id?: number
    type: 'ip' | 'user_agent'
    value: string
    is_vpn?: boolean
    is_proxy?: boolean
    is_tor?: boolean
    owner?: string
    country?: string
    region?: string
    city?: string
}

type IPMetrics = {
    ip: string
    top_paths: TopPath[]
    most_common_user_agent?: string | null
}

type UAMetrics = {
    user_agent: string
    top_paths: TopPath[]
    most_common_ip?: string | null
}

type DomainTPS = {
    name: string
    tps: number
}

type FetchRequest = {
    type: RequestType
    path: string
    created: string
}

type RequestType = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS' | 'CONNECT' | 'TRACE' | string

type Parameter = {
    parameter: string
    value: string
}

type SearchResult = {
    action: string
    text: string
    metadata?: {
        file?: string
        line?: number
    }
}

type OpenFile = {
    id: string
    name: string
}

type TopPath = {
    path: string
    hits: number
}
