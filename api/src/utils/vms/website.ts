export type VmWebsiteImage = { url: string, alt: string, caption: string }
export type VmWebsitePlan = {
    title: string
    tagline: string
    sections: Array<{ heading: string, body: string }>
    gallery?: VmWebsiteImage[]
    contactEmail?: string
}

export function isVmWebsitePlan(value: unknown): value is VmWebsitePlan {
    if (!value || typeof value !== 'object') return false
    const plan = value as Record<string, unknown>
    if (typeof plan.title !== 'string' || !plan.title.trim() || plan.title.length > 120
        || typeof plan.tagline !== 'string' || plan.tagline.length > 120
        || !Array.isArray(plan.sections) || plan.sections.length > 5
        || !plan.sections.every(section => Boolean(section) && typeof section === 'object'
            && typeof (section as Record<string, unknown>).heading === 'string'
            && ((section as Record<string, unknown>).heading as string).length <= 100
            && typeof (section as Record<string, unknown>).body === 'string'
            && ((section as Record<string, unknown>).body as string).length <= 500)) return false

    if (plan.gallery !== undefined && (!Array.isArray(plan.gallery) || plan.gallery.length > 8
        || !plan.gallery.every(image => Boolean(image) && typeof image === 'object'
            && isHttpsUrl((image as Record<string, unknown>).url)
            && typeof (image as Record<string, unknown>).alt === 'string'
            && ((image as Record<string, unknown>).alt as string).trim().length > 0
            && ((image as Record<string, unknown>).alt as string).length <= 240
            && typeof (image as Record<string, unknown>).caption === 'string'
            && ((image as Record<string, unknown>).caption as string).length <= 240))) return false

    if (plan.contactEmail !== undefined && (typeof plan.contactEmail !== 'string'
        || (plan.contactEmail !== '' && (plan.contactEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(plan.contactEmail))))) return false
    return true
}

export function renderVmWebsite(plan: VmWebsitePlan) {
    const sections = plan.sections.map((section, index) => `<section id="section-${index + 1}" class="content-section"><h2>${escapeHtml(section.heading)}</h2><p>${escapeHtml(section.body)}</p></section>`).join('\n')
    const navigation = plan.sections.map((section, index) => `<a href="#section-${index + 1}">${escapeHtml(section.heading || `Section ${index + 1}`)}</a>`).join('\n')
    const gallery = plan.gallery?.length
        ? `<section id="gallery" class="gallery-section" aria-labelledby="gallery-heading"><div class="section-heading"><p class="eyebrow">Selected work</p><h2 id="gallery-heading">Gallery</h2></div><div class="gallery-grid">${plan.gallery.map(image => `<figure><img src="${escapeHtml(image.url)}" alt="${escapeHtml(image.alt)}" loading="lazy">${image.caption ? `<figcaption>${escapeHtml(image.caption)}</figcaption>` : ''}</figure>`).join('\n')}</div></section>`
        : ''
    const contact = plan.contactEmail
        ? `<section id="contact" class="contact-section"><p class="eyebrow">Get in touch</p><h2>Let’s make something good.</h2><a class="contact-link" href="mailto:${encodeURIComponent(plan.contactEmail)}">${escapeHtml(plan.contactEmail)}</a></section>`
        : ''

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeHtml(plan.tagline)}">
  <title>${escapeHtml(plan.title)}</title>
  <style>
    :root { color-scheme: light; --ink: #20241f; --muted: #62685f; --line: #d8d7cf; --canvas: #f7f5f0; --panel: #e9e6dc; --accent: #485b4a; }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body { margin: 0; background: var(--canvas); color: var(--ink); font: 16px/1.65 system-ui, sans-serif; }
    a { color: var(--accent); text-underline-offset: .2em; }
    a:focus-visible { outline: 3px solid var(--accent); outline-offset: 4px; }
    .skip-link { position: absolute; top: 8px; left: 8px; z-index: 2; transform: translateY(-160%); border-radius: 8px; background: #fff; padding: 10px 14px; }
    .skip-link:focus { transform: translateY(0); }
    .site-nav, main, footer { width: min(calc(100% - 40px), 1040px); margin-inline: auto; }
    .site-nav { display: flex; flex-wrap: wrap; gap: 12px 22px; padding-block: 24px; }
    .site-nav a { font-size: .9rem; font-weight: 600; }
    main { margin-block: clamp(24px, 8vh, 80px) 72px; }
    .hero { padding: clamp(28px, 7vw, 76px); border-radius: 28px; background: var(--panel); }
    .eyebrow { margin: 0 0 12px; color: var(--muted); font-size: .75rem; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
    h1 { max-width: 15ch; margin: 0; font-size: clamp(2.5rem, 9vw, 6rem); line-height: .98; letter-spacing: -.06em; }
    .hero p:last-child { max-width: 52ch; margin: 20px 0 0; color: var(--muted); font-size: clamp(1rem, 2vw, 1.2rem); }
    .content-section, .gallery-section { padding: 36px 8px; border-bottom: 1px solid var(--line); }
    h2 { margin: 0 0 8px; font-size: clamp(1.25rem, 3vw, 1.6rem); letter-spacing: -.02em; }
    .content-section p { max-width: 68ch; margin: 0; color: #555c56; white-space: pre-wrap; }
    .gallery-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap: 20px; }
    figure { margin: 0; overflow: hidden; border-radius: 16px; background: var(--panel); }
    figure img { display: block; width: 100%; aspect-ratio: 4 / 3; object-fit: cover; }
    figcaption { padding: 12px 16px; color: var(--muted); font-size: .9rem; }
    .contact-section { margin-top: 48px; padding: clamp(24px, 6vw, 48px); border-radius: 24px; background: var(--panel); }
    .contact-link { display: inline-block; margin-top: 8px; font-weight: 650; }
    footer { padding-bottom: 32px; color: var(--muted); font-size: .8rem; }
    @media (max-width: 560px) { .site-nav, main, footer { width: min(calc(100% - 32px), 1040px); } .site-nav { gap: 8px 16px; } }
    @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
  </style>
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<nav class="site-nav" aria-label="Main navigation"><a href="#main">${escapeHtml(plan.title)}</a>${navigation}${gallery ? '<a href="#gallery">Gallery</a>' : ''}${contact ? '<a href="#contact">Contact</a>' : ''}</nav>
<main id="main"><header class="hero"><p class="eyebrow">${escapeHtml(plan.title)}</p><h1>${escapeHtml(plan.title)}</h1><p>${escapeHtml(plan.tagline)}</p></header>
${sections}
${gallery}
${contact}
</main>
<footer><p>${escapeHtml(plan.title)}</p></footer>
</body></html>`
}

function isHttpsUrl(value: unknown): value is string {
    if (typeof value !== 'string' || value.length > 2000) return false
    try {
        const url = new URL(value)
        return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password
    } catch {
        return false
    }
}

function escapeHtml(value: string) {
    const entities: Record<string, string> = {
        '&': '&amp;', '<': '&lt;', '>': '&gt;',
        [String.fromCharCode(34)]: '&quot;', [String.fromCharCode(39)]: '&#39;',
    }
    return value.replace(/[&<>"']/g, character => entities[character])
}
