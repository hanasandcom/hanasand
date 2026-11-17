import { expect, test } from 'bun:test'
import { parseTimeline, timelineBlock } from '../src/components/markdown/timeline'

test('timeline blocks preserve image, title and subtext as portable Markdown', () => {
    const items = [{ image: '/api/markdown/images/00000000-0000-0000-0000-000000000000', title: 'First turn', text: 'Subtext' }]
    const block = timelineBlock(items)
    expect(block).toContain('```timeline')
    expect(parseTimeline(block.match(/```timeline\n([\s\S]*?)\n```/)![1])).toEqual(items)
    expect(parseTimeline('[{"title":"Missing image","text":"x"}]')).toBeNull()
})
