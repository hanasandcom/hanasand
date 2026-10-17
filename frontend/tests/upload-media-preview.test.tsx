// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import MediaPreview from '../src/components/upload/mediaPreview'

test('image preview preserves caller alt text, loading policy, and classes', () => {
    const html = renderToStaticMarkup(createElement(MediaPreview, {
        kind: 'image',
        src: '/files/photo',
        alt: 'Photo name',
        loading: 'lazy',
        className: 'gallery image classes',
    }))

    expect(html).toContain('<img')
    expect(html).toContain('src="/files/photo"')
    expect(html).toContain('alt="Photo name"')
    expect(html).toContain('loading="lazy"')
    expect(html).toContain('class="gallery image classes"')
    expect(html).not.toContain('<video')
})

test('video preview keeps controls and the caller preload and classes', () => {
    const html = renderToStaticMarkup(createElement(MediaPreview, {
        kind: 'video',
        src: '/files/clip',
        preload: 'metadata',
        className: 'gallery video classes',
    }))

    expect(html).toContain('<video')
    expect(html).toContain('src="/files/clip"')
    expect(html).toContain('controls=""')
    expect(html).toContain('preload="metadata"')
    expect(html).toContain('class="gallery video classes"')
    expect(html).not.toContain('<img')
})
