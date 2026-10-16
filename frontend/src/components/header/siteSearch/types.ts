export type SearchItem = {
    id: string
    title: string
    detail: string
    href: string
}

export type SearchGroup = {
    title: string
    items: SearchItem[]
    icon: 'route' | 'case' | 'actor'
}
