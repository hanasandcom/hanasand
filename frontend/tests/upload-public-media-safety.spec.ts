import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import isPublicIp from '../src/utils/proxy/isPublicIp'

const root = process.cwd()

test('public IP validation allows global IPv4 and IPv6 but blocks non-routable ranges', () => {
    expect(isPublicIp('8.8.8.8')).toBe(true)
    expect(isPublicIp('192.0.2.20')).toBe(false)
    expect(isPublicIp('127.0.0.1')).toBe(false)
    expect(isPublicIp('169.254.169.254')).toBe(false)
    expect(isPublicIp('10.2.3.4')).toBe(false)
    expect(isPublicIp('172.31.20.1')).toBe(false)
    expect(isPublicIp('172.32.20.1')).toBe(true)
    expect(isPublicIp('2606:4700:4700::1111')).toBe(true)
    expect(isPublicIp('fd00::1')).toBe(false)
    expect(isPublicIp('fe80::1')).toBe(false)
    expect(isPublicIp('2001:db8::1')).toBe(false)
    expect(isPublicIp('::ffff:127.0.0.1')).toBe(false)
})

test('upload accepts files and the remote media proxy restricts network access', async () => {
    const uploadPage = await readFile(path.join(root, 'src/app/upload/pageClient.tsx'), 'utf8')
    const uploadForm = await readFile(path.join(root, 'src/components/upload/upload.tsx'), 'utf8')
    const uploadBehavior = await readFile(path.join(root, 'src/components/upload/usePublicMediaUpload.ts'), 'utf8')
    const preview = await readFile(path.join(root, 'src/components/upload/preview.tsx'), 'utf8')
    const imageRoute = await readFile(path.join(root, 'src/app/api/image/route.ts'), 'utf8')

    expect(uploadPage).toContain('data-upload-intro')
    expect(uploadPage).toContain('Upload images, videos or files.')
    expect(uploadPage).not.toContain('Do not upload private or confidential content.')
    expect(uploadForm).toContain('review-button')
    expect(uploadForm).toContain('Choose a file or paste a URL.')
    expect(uploadForm).toContain('hanasand-upload-picker')
    expect(uploadForm).toContain('/assets/upload-picker.js')
    expect(uploadBehavior).toContain('MAX_UPLOAD_BYTES')
    expect(uploadBehavior).toContain('validateUploadFile(file)')
    expect(uploadBehavior).toContain('validateRemoteMediaFile(file)')
    expect(uploadBehavior).toContain('Files must be 20 MB or smaller.')
    expect(uploadBehavior).toContain('payload.error || \'Remote media could not be fetched.\'')
    expect(preview).toContain('publish only if this can be shared outside your organization')

    expect(imageRoute).toContain('MAX_PROXY_BYTES')
    expect(imageRoute).toContain('tokenIsValid(token, id')
    expect(imageRoute).toContain('URL must point to a public media host.')
    expect(imageRoute).toContain('URL must return a supported image or video.')
    expect(imageRoute).toContain('lookup(hostname, { all: true })')
    expect(imageRoute).toContain('lookup: (_hostname, _options, callback) => callback(null, address, family)')
    expect(imageRoute).toContain('MAX_REDIRECTS')
    expect(imageRoute).toContain('MEDIA_TYPES')
    expect(imageRoute).toContain('Cache-Control')
    expect(imageRoute).not.toContain('console.log(await response.text())')
})

test('upload page renders the intro and file-picker action', async ({ page }) => {
    await page.route('**/assets/exifreader.js', route => route.fulfill({ status: 200, contentType: 'text/javascript', body: '' }))
    await page.route('**/assets/upload-picker.js', route => route.fulfill({
        status: 200,
        contentType: 'text/javascript',
        body: 'customElements.define(\'hanasand-upload-picker\', class extends HTMLElement { connectedCallback() { const button = document.createElement(\'button\'); button.textContent = \'Browse files\'; this.attachShadow({ mode: \'open\' }).append(button) } })',
    }))
    await page.goto('/upload')

    await expect(page.getByRole('heading', { name: 'Upload media' })).toBeVisible()
    const intro = page.locator('[data-upload-intro="true"]')
    await expect(intro).toHaveText('Upload images, videos or files.')
    await expect(page.getByText('Browse files')).toBeVisible()
})
