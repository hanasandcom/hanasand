'use client'

import { useEffect, useRef, useState } from 'react'

export type MarqueeProps = {
    text: string
    className?: string
    innerClassName?: string
    as?: 'div' | 'h1'
}

export function marqueeAnimationClass(as: 'div' | 'h1') {
    return as === 'h1' ? 'marquee' : 'inline-block align-top animate-[marquee_12s_linear_infinite]'
}

export default function Marquee({ text, className = '', innerClassName = '', as = 'div' }: MarqueeProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const textRef = useRef<HTMLDivElement>(null)
    const [scrollDistance, setScrollDistance] = useState(0)
    const [shouldScroll, setShouldScroll] = useState(false)

    useEffect(() => {
        const containerWidth = containerRef.current?.offsetWidth ?? 0
        const textWidth = textRef.current?.scrollWidth ?? 0
        setShouldScroll(textWidth > containerWidth)
        setScrollDistance(textWidth - containerWidth)
    }, [text])

    const duration = Math.max(6, scrollDistance / 30)

    if (text === 'Unknown') {
        return null
    }

    const innerClass = `${shouldScroll ? marqueeAnimationClass(as) : ''} ${innerClassName}`
    const style = {
        display: 'block',
        '--scroll-distance': `${scrollDistance}px`,
        '--duration': `${duration}s`,
    } as React.CSSProperties

    return (
        <div
            ref={containerRef}
            className={`relative overflow-hidden whitespace-nowrap ${className}`}
            style={{ width: '100%' }}
        >
            {as === 'h1' ? (
                <h1 ref={textRef} className={innerClass} style={style}>{text}</h1>
            ) : (
                <div ref={textRef} className={innerClass} style={style}>{text}</div>
            )}
        </div>
    )
}
