import type { ReactNode } from 'react'

export type HanasandServiceLink = {
    href: string
    label: string
}

export type HeaderProps = {
    brandHref?: string
    brandLabel?: string
    logoSrc?: string
    links?: HanasandServiceLink[]
    actions?: ReactNode
    className?: string
}

const defaultLinks: HanasandServiceLink[] = [
    { href: 'https://hanasand.com', label: 'Website' },
    { href: 'https://mail.hanasand.com', label: 'Mail' },
    { href: 'https://cdn.hanasand.com', label: 'CDN' },
]

function safeHref(href: string): string | null {
    if (href.startsWith('/') && !href.startsWith('//')) return href
    try {
        const url = new URL(href)
        return url.protocol === 'https:' || url.protocol === 'http:' ? href : null
    } catch {
        return null
    }
}

export function Header({
    brandHref = 'https://hanasand.com',
    brandLabel = 'Hanasand',
    logoSrc = '/assets/hanasand-logo.png',
    links = defaultLinks,
    actions,
    className = '',
}: HeaderProps) {
    const safeBrandHref = safeHref(brandHref) || 'https://hanasand.com'
    const safeLinks = links.flatMap(link => {
        const href = safeHref(link.href)
        return href && link.label.trim() ? [{ ...link, href }] : []
    })

    return <header className={`hanasand-header ${className}`.trim()}>
        <a className='hanasand-header__brand' href={safeBrandHref}>
            <img src={logoSrc} alt='' aria-hidden='true' />
            <span>{brandLabel}</span>
        </a>
        <nav className='hanasand-header__links' aria-label='Hanasand services'>
            {safeLinks.map(link => <a key={link.href} href={link.href}>{link.label}</a>)}
        </nav>
        {actions ? <div className='hanasand-header__actions'>{actions}</div> : null}
    </header>
}
