import type { GeneratedProject } from './aiProjectBuilderTypes.ts'
import { sharedProjectFiles, nextPackage, nextConfig } from './aiProjectBuilderRuntimeFiles.ts'
import { readme } from './aiProjectBuilderDocumentation.ts'
import { detailForSection, productTypeFor } from './aiProjectBuilderSections.ts'

export function websiteFiles(title: string, slug: string, sections: string[], lower: string): GeneratedProject {
    for (const [term, section] of [['dns', 'DNS checklist'], ['ssl', 'SSL checklist']]) {
        if (lower.includes(term) && !sections.includes(section)) sections.push(section)
    }
    const cards = sections.map((section, index) => ({
        id: `section-${index + 1}`,
        title: section,
        description: detailForSection(section),
    }))
    return {
        label: `${productTypeFor(lower)} website`,
        files: [
            ...sharedProjectFiles(title, slug, {
                packageFile: nextPackage(slug),
                environment: ['CONTACT_EMAIL='],
                dockerKind: 'next',
                beforeDocker: [nextConfig()],
            }),
            {
                path: 'src/app/layout.tsx',
                content: `import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = { title: ${JSON.stringify(title)}, description: ${JSON.stringify(sections.slice(0, 3).join(', ') + '.')} }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>
}
`,
            },
            {
                path: 'src/app/page.tsx',
                content: `export const dynamic = 'force-dynamic'

const title = ${JSON.stringify(title)}
const sections = ${JSON.stringify(cards, null, 2)}
const email = process.env.CONTACT_EMAIL?.trim()
const contact = email && /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email) ? 'mailto:' + encodeURIComponent(email) : null

export default function Page() {
  return <>
    <a className="skip-link" href="#content">Skip to content</a>
    <header className="site-header">
      <a className="brand" href="#content">{title}</a>
      <nav aria-label="Primary">
        <a href="#sections">Explore</a>
        {contact && <a href={contact}>Contact</a>}
      </nav>
    </header>
    <main id="content" tabIndex={-1}>
      <section className="intro" aria-labelledby="page-title">
        <p className="eyebrow">Overview</p>
        <h1 id="page-title">{title}</h1>
        <p className="summary">{sections.slice(0, 3).map(item => item.title).join(' · ')}</p>
        <a className="button" href="#sections">Explore the details <span aria-hidden="true">↗</span></a>
      </section>
      <section id="sections" className="sections" aria-label="Details">
        {sections.map((item, index) => <article key={item.id} aria-labelledby={item.id}>
          <span className="section-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
          <h2 id={item.id}>{item.title}</h2>
          {item.description && <p>{item.description}</p>}
        </article>)}
      </section>
    </main>
    <footer><span>{title}</span>{contact && <a href={contact}>Get in touch</a>}</footer>
  </>
}
`,
            },
            {
                path: 'src/app/globals.css',
                content: `:root { color-scheme: light; --ink: #182b29; --muted: #52615b; --paper: #f7f6f0; --line: #c9d0c6; --accent: #235749; }
* { box-sizing: border-box; }
html { scroll-padding-top: 1.5rem; }
body { margin: 0; background: var(--paper); color: var(--ink); font-family: system-ui, sans-serif; line-height: 1.6; }
a { color: inherit; text-underline-offset: .25em; }
a:hover { color: var(--accent); }
:focus-visible { outline: 3px solid var(--accent); outline-offset: 5px; }
.skip-link { position: fixed; top: 1rem; left: 1rem; z-index: 10; padding: .75rem 1rem; background: var(--ink); color: white; transform: translateY(-200%); }
.skip-link:focus { transform: translateY(0); color: white; }
.site-header, main, footer { width: min(100% - 3rem, 72rem); margin-inline: auto; }
.site-header, footer { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1.5rem; padding-block: 1.5rem; }
.site-header { border-bottom: 1px solid var(--line); }
.brand { font-weight: 650; max-width: 32rem; overflow-wrap: anywhere; text-decoration: none; }
nav { display: flex; flex-wrap: wrap; gap: 1.25rem; }
nav a { display: inline-block; padding-block: .6rem; }
.intro { padding-block: clamp(3rem, 8vw, 7rem); max-width: 58rem; }
.eyebrow, .section-number { color: var(--accent); font-size: .85rem; letter-spacing: .1em; }
h1 { font-size: clamp(2.5rem, 6vw, 5.5rem); line-height: 1.08; letter-spacing: -.045em; margin: 1rem 0 1.5rem; overflow-wrap: anywhere; }
.summary { color: var(--muted); max-width: 42rem; font-size: 1.15rem; }
.button { display: inline-flex; gap: 1.5rem; align-items: center; min-height: 44px; margin-top: 1.5rem; padding: .8rem 1.1rem; background: var(--ink); color: white; text-decoration: none; border-radius: .3rem; }
.button:hover { background: var(--accent); color: white; }
.sections { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr)); gap: 2rem; padding-bottom: 4rem; }
article { min-width: 0; border-top: 1px solid var(--line); padding-top: 1.25rem; overflow-wrap: anywhere; }
h2 { font-size: 1.3rem; line-height: 1.3; margin: .8rem 0; }
article p, footer { color: var(--muted); }
footer { border-top: 1px solid var(--line); font-size: .9rem; }
@media (max-width: 480px) { .site-header, main, footer { width: calc(100% - 2rem); } }
`,
            },
            { path: 'public/.gitkeep', content: '' },
            readme(title, [
                'Next.js website. Edit src/app/page.tsx for content, layout.tsx for metadata, and globals.css for styles.',
                'Set CONTACT_EMAIL to enable the email link. The site does not collect form submissions or store user data.',
                'The generated sections are a starting point, not verified business information. Add approved content before publishing.',
                'Keyboard navigation includes a skip link and visible focus. Check the finished content at mobile widths and 200% zoom.',
                'Backend contract: authentication, payments, and persistent data require a separate implementation. This website does not provide them.',
            ]),
        ],
    }
}
