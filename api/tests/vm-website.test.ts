import { expect, test } from 'bun:test'
import { isVmWebsitePlan, renderVmWebsite } from '../src/utils/vms/website.ts'

test('generated website stays semantic, responsive, and keyboard accessible', () => {
    const html = renderVmWebsite({
        title: 'Studio & Co',
        tagline: 'Independent ceramic studio',
        sections: [{ heading: 'Visit us', body: 'Open every day.' }],
        gallery: [{ url: 'https://images.example/pot.jpg', alt: 'Blue ceramic vase on a wooden table', caption: 'Blue vessel' }],
        contactEmail: 'hello@example.com',
    })

    expect(html).toContain('<html lang="en">')
    expect(html).toContain('<a class="skip-link" href="#main">Skip to content</a>')
    expect(html).toContain('<nav class="site-nav" aria-label="Main navigation">')
    expect(html).toContain('<img src="https://images.example/pot.jpg" alt="Blue ceramic vase on a wooden table" loading="lazy">')
    expect(html).toContain('<figcaption>Blue vessel</figcaption>')
    expect(html).toContain('href="mailto:hello%40example.com"')
    expect(html).toContain('@media (prefers-reduced-motion: reduce)')
    expect(html).toContain('Studio &amp; Co')
})

test('website plans reject unsafe image URLs and malformed contact addresses', () => {
    const plan = { title: 'Gallery', tagline: '', sections: [] }
    expect(isVmWebsitePlan({ ...plan, gallery: [{ url: 'javascript:alert(1)', alt: 'Image', caption: '' }] })).toBe(false)
    expect(isVmWebsitePlan({ ...plan, gallery: [{ url: 'https://user:pass@images.example/pot.jpg', alt: 'Image', caption: '' }] })).toBe(false)
    expect(isVmWebsitePlan({ ...plan, contactEmail: 'not-an-email' })).toBe(false)
})
