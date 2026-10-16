import deleteAuthenticatedResource from '../deleteAuthenticatedResource'

export default async function deleteThought(id: string): Promise<{ status: number, message: string }> {
    return deleteAuthenticatedResource({ id, path: 'thought', label: 'thought', plural: 'thoughts' })
}
