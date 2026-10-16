import { Clock } from 'lucide-react'
import { reviewStatus, type CodeItem, type ReviewEvent } from '@/utils/codeReviewTypes'

type Props = {
    item: CodeItem
    detail: { item: CodeItem, history: ReviewEvent[] } | null
    canReview: boolean
    busy: boolean
    more: boolean
    onApprove: (approved: boolean) => void
    onLoadMore: () => void
}

export function ReviewHistory({
    item,
    detail,
    canReview,
    busy,
    more,
    onApprove,
    onLoadMore,
}: Props) {
    return (
        <section aria-label='Review history' className='code-review-history'>
            <h4><Clock size={15} /> Review history</h4>
            <p>
                {item.review
                    ? `Last review: ${new Date(item.review.reviewed_at).toLocaleString()} by ${item.review.reviewer}.`
                    : 'This item has not been reviewed.'}
            </p>
            {reviewStatus(item) === 'changed' && (
                <p>The source or one of its dependencies changed since the last review.</p>
            )}
            {canReview && (
                <button
                    disabled={busy || !detail || reviewStatus(item) === 'approved'}
                    onClick={() => onApprove(true)}
                >
                    Approve this version
                </button>
            )}
            {canReview && reviewStatus(item) === 'approved' && (
                <button disabled={busy} onClick={() => onApprove(false)}>
                    Mark as needing review
                </button>
            )}
            <ul>
                {detail?.history.map(event => (
                    <li key={event.event_id}>
                        {event.approved ? 'Approved' : 'Marked for review'} · {new Date(event.reviewed_at).toLocaleString()} · {event.reviewer}
                        <details>
                            <summary>Version hashes</summary>
                            <code>Source: {event.content_hash}<br />With dependencies: {event.review_hash}</code>
                        </details>
                    </li>
                ))}
            </ul>
            {detail?.history.length === 0 && <p>No earlier reviews.</p>}
            {more && <button disabled={busy} onClick={onLoadMore}>Older reviews</button>}
        </section>
    )
}
