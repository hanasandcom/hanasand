import { backendJsonRequest } from '@/utils/auth/backendJsonRequest'

type ThoughtUpdateResponse = { message: string }

export default function putThought(id: string, title: string): Promise<ThoughtUpdateResponse> {
    return backendJsonRequest<ThoughtUpdateResponse>(`/thought/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify({ title }),
        errorMessage: 'Could not update thought.',
    })
}
