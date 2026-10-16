import deleteAuthenticatedResource from '../deleteAuthenticatedResource'

export default async function deleteProject(projectId: string): Promise<{ status: number, message: string }> {
    return deleteAuthenticatedResource({ id: projectId, path: 'project', label: 'project', plural: 'projects' })
}
