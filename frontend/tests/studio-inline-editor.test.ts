import { expect, test } from 'bun:test'
import { documentSections } from '../src/components/markdown/InlineMarkdownDocumentEditor'
import { parseTimeline, timelineBlock } from '../src/components/markdown/timeline'

test('existing Studio timeline remains a structured turn rather than raw JSON text', () => {
    const items = [
        { image: '', title: 'Start', text: 'Game begins.' },
        { image: '', title: 'First enemy', text: 'Fight.' },
    ]
    const source = timelineBlock(items)
    const sections = documentSections(source)
    expect(sections.filter(section => section.kind === 'timeline')).toHaveLength(1)
    expect(sections.find(section => section.kind === 'timeline')).toMatchObject({ items })
    expect(parseTimeline(source.match(/```timeline\n([\s\S]*?)\n```/)?.[1] || '')).toEqual(items)
})

test('Markdown and timeline sections keep their original positions for inline replacement', () => {
    const source = `Introduction\n${timelineBlock([{ image: '', title: 'Turn', text: '' }])}\nConclusion`
    const sections = documentSections(source)
    expect(sections.map(section => section.kind)).toEqual(['text', 'timeline', 'text'])
    expect(source.slice(sections[1].start, sections[1].end)).toContain('```timeline')
    expect(source.slice(sections[2].start, sections[2].end)).toContain('Conclusion')
})
