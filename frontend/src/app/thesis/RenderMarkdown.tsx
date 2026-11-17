import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import markdownSpacing from './markdownSpacing'
import { thesisMarkdownComponents } from './markdownComponents'
import MarkdownDocument from '@/components/markdown/MarkdownDocument'

export default function RenderMarkdown({ text }: { text: string }) {
    if (text.includes('```timeline')) return <MarkdownDocument text={text} />
    return (
        <div className='thesis-markdown'>
            <Markdown components={thesisMarkdownComponents} remarkPlugins={[remarkGfm, markdownSpacing]}>
                {text}
            </Markdown>
        </div>
    )
}
