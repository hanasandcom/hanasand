'use client'

import Marquee, { type MarqueeProps } from '../shared/marquee'

export default function HeadingMarquee(props: Omit<MarqueeProps, 'as'>) {
    return <Marquee {...props} as='h1' />
}
