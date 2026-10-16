import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import markdownSpacing from './markdownSpacing'
import { thesisMarkdownComponents } from './markdownComponents'

export default function RenderMarkdown({ text }: { text: string }) {
    return (
        <div className='thesis-markdown'>
            <Markdown components={thesisMarkdownComponents} remarkPlugins={[remarkGfm, markdownSpacing]}>
                {text}
            </Markdown>
        </div>
    )
}
