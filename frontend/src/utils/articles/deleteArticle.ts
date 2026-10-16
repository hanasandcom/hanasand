import deleteAuthenticatedResource from '../deleteAuthenticatedResource'

export default async function deleteArticle(id: string): Promise<{ status: number, message: string }> {
    return deleteAuthenticatedResource({ id, path: 'article', label: 'article', plural: 'articles' })
}
