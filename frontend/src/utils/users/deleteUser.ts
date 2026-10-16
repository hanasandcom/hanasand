import deleteAuthenticatedResource from '../deleteAuthenticatedResource'

export default async function deleteUser(id: string): Promise<{ status: number, message: string }> {
    return deleteAuthenticatedResource({ id, path: 'user', label: 'user', plural: 'users' })
}
