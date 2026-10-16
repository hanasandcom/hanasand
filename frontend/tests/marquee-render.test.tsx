import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'bun:test'
import Marquee, { marqueeAnimationClass } from '../src/components/shared/marquee'
import HeadingMarquee from '../src/components/marquee/marquee'

test('shared marquee consumers preserve their element, classes and empty-value behavior', () => {
    const plain = renderToStaticMarkup(createElement(Marquee, {
        text: 'A long organization name',
        className: 'truncate',
        innerClassName: 'font-semibold text-ui-text',
    }))
    const heading = renderToStaticMarkup(createElement(HeadingMarquee, {
        text: 'A long share link',
        className: 'truncate',
    }))

    expect(plain).toContain('class="relative overflow-hidden whitespace-nowrap truncate"')
    expect(plain).toContain('<div class=" font-semibold text-ui-text"')
    expect(plain).toContain('A long organization name')
    expect(heading).toContain('<h1 class=" "')
    expect(heading).toContain('A long share link')
    expect(plain).toContain('--scroll-distance:0px')
    expect(heading).toContain('--duration:6s')
    expect(marqueeAnimationClass('div')).toBe('inline-block align-top animate-[marquee_12s_linear_infinite]')
    expect(marqueeAnimationClass('h1')).toBe('marquee')
    expect(renderToStaticMarkup(createElement(Marquee, { text: 'Unknown' }))).toBe('')
    expect(renderToStaticMarkup(createElement(HeadingMarquee, { text: 'Unknown' }))).toBe('')
})
