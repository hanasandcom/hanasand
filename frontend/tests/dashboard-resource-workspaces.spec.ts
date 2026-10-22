import { expect, test } from '@playwright/test'
import { apiBase, password } from './dashboard-resource-data'
import { authenticateContext, authHeaders, createShare, createUser, deleteUser, uniqueSuffix } from './dashboard-resource-auth'

test('repositories exposes workspace open and delete actions', async ({ browser, request, baseURL }) => {
    const userId = `pdrp${uniqueSuffix()}`
    const auth = await createUser(request, userId, 'Dashboard Projects')
    const projectId = `project-${userId}`
    const fileId = `file-${userId}`
    await createShare(request, auth, {
        id: projectId,
        name: projectId,
        path: projectId,
        content: '',
        type: 'folder',
        includeTree: true,
    })
    await createShare(request, auth, {
        id: fileId,
        name: fileId,
        path: fileId,
        content: 'Repository file inventory smoke.',
        type: 'file',
    })
    const context = await browser.newContext({ baseURL })

    try {
        await authenticateContext(context, auth, baseURL || 'http://127.0.0.1:3000')
        const page = await context.newPage()

        await page.goto('/repositories', { waitUntil: 'networkidle' })
        await expect(page).toHaveURL(/\/repositories$/)
        await expect(page.getByRole('heading', { name: 'Repositories' })).toBeVisible()
        await expect(page.getByRole('heading', { name: 'Files' })).toBeVisible()
        await expect(page.locator(`a[href="/p/${projectId}"]`)).toBeVisible()
        await expect(page.getByText(projectId).first()).toBeVisible()
        await expect(page.getByText(fileId).first()).toBeVisible()

        await Promise.all([
            page.waitForResponse((response) =>
                response.url().includes(`/api/project/${projectId}`) &&
                response.request().method() === 'DELETE' &&
                response.ok()
            ),
            page.getByRole('button', { name: `Delete project ${projectId}` }).click(),
        ])

        await expect(page.getByText('No projects yet.')).toBeVisible()
        await expect(page.getByText(projectId)).toHaveCount(0)
    } finally {
        await context.close()
        await request.delete(`${apiBase}/project/${projectId}`, {
            headers: authHeaders(auth),
        }).catch(() => undefined)
        await request.delete(`${apiBase}/share/${fileId}`, {
            headers: authHeaders(auth),
        }).catch(() => undefined)
        await deleteUser(request, userId, password)
    }
})

test('repositories exposes shared file open and delete actions', async ({ browser, request, baseURL }) => {
    const userId = `pdrs${uniqueSuffix()}`
    const auth = await createUser(request, userId, 'Dashboard Shares')
    const shareId = `share-${userId}`
    await createShare(request, auth, {
        id: shareId,
        name: shareId,
        path: shareId,
        content: 'Dashboard share smoke.',
        type: 'file',
    })
    const context = await browser.newContext({ baseURL })

    try {
        await authenticateContext(context, auth, baseURL || 'http://127.0.0.1:3000')
        const page = await context.newPage()

        await page.goto('/repositories', { waitUntil: 'networkidle' })
        await expect(page).toHaveURL(/\/repositories$/)
        await expect(page.getByRole('heading', { name: 'Repositories' })).toBeVisible()
        await expect(page.getByRole('heading', { name: 'Files' }).first()).toBeVisible()
        await expect(page.getByRole('link', { name: 'Open' })).toHaveAttribute('href', `/s/${shareId}`)
        await expect(page.getByText(shareId).first()).toBeVisible()

        await Promise.all([
            page.waitForResponse((response) =>
                response.url().includes(`/api/share/${shareId}`) &&
                response.request().method() === 'DELETE' &&
                response.ok()
            ),
            page.getByRole('button', { name: `Delete share ${shareId}` }).click(),
        ])

        await expect(page.getByText('No shares yet.')).toBeVisible()
        await expect(page.getByText(shareId)).toHaveCount(0)
    } finally {
        await context.close()
        await request.delete(`${apiBase}/share/${shareId}`, {
            headers: authHeaders(auth),
        }).catch(() => undefined)
        await deleteUser(request, userId, password)
    }
})
