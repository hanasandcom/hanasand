import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('public workflow reliability contracts are not demo-only', async () => {
    const pwnedRoute = await readFile(path.join(root, 'src/app/api/pwned/route.ts'), 'utf8')
    const pwnedPage = await readFile(path.join(root, 'src/app/pwned/pageClient.tsx'), 'utf8')
    const registerPage = await readFile(path.join(root, 'src/app/register/page.tsx'), 'utf8')
    const contact = await readFile(path.join(root, 'src/components/contact/contact.tsx'), 'utf8')
    const contactClient = await readFile(path.join(root, 'src/utils/contact/submitContactRequest.ts'), 'utf8')
    const contactHandler = await readFile(path.join(root, '../api/src/handlers/commercialContactRequests.ts'), 'utf8')
    const apiPwnedHandler = await readFile(path.join(root, '../api/src/handlers/pwned/post.ts'), 'utf8')

    expect(pwnedRoute).toContain('A valid SHA-1 hash prefix is required.')
    expect(pwnedPage).toContain('pattern=\'[A-Fa-f0-9]{40}\'')
    expect(apiPwnedHandler).toContain('Do not send raw secrets to this endpoint.')

    expect(registerPage).toContain('mode: \'signup\'')
    expect(registerPage).toContain('redirect(`/login?${query}`)')

    expect(contact).toContain('submitContactRequest({')
    expect(contact).toContain('Ticket <span')
    expect(contact).toContain('<h1 className=\'text-4xl font-semibold tracking-normal md:text-5xl\'>Contact us</h1>')
    expect(contact).not.toContain('intent')
    expect(contact).not.toContain('securityReview')
    expect(contact).not.toContain('window.location.href = mailtoLink')
    expect(contactClient).not.toContain('intent')
    expect(contactClient).not.toContain('securityReview')
    expect(contactHandler).toContain('commercial_contact_requests')
    expect(contactHandler).not.toContain('intent')
    expect(contactHandler).not.toContain('securityReview')

})

test('legacy plaintext password lookup is retired', async () => {
    const apiSockets = await readFile(path.join(root, '../api/src/plugins/ws.ts'), 'utf8')
    const apiConfig = await readFile(path.join(root, '../api/src/constants.ts'), 'utf8')
    const rangeRoute = await readFile(path.join(root, 'src/app/api/pwned/route.ts'), 'utf8')
    expect(apiSockets).not.toContain('/api/ws/pwned/')
    expect(apiSockets).not.toContain('pwnedClients')
    expect(apiConfig).not.toContain('PWNED_API_URL')
    expect(apiConfig).not.toContain('PWNED_WS_URL')
    expect(rangeRoute).toContain('PWNED_RANGE_API')
    expect(rangeRoute).toContain('^[A-F0-9]{5}$')
})
