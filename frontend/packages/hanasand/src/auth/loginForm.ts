type LoginElement = HTMLElement & {
    signInWithPasskey(button: HTMLButtonElement, optionsUrl: string, verifyUrl: string): Promise<void>
    setBusy(busy: boolean): void
    setError(message: string): void
}

export function registerHanasandLoginForm() {
    if (typeof customElements === 'undefined' || customElements.get('hanasand-login-form')) return

    class HanasandLoginForm extends HTMLElement implements LoginElement {
        connectedCallback() {
            if (this.dataset.ready) return
            this.dataset.ready = 'true'
            const identifierLabel = this.getAttribute('identifier-label') || 'Email or username'
            const identifierPlaceholder = this.getAttribute('identifier-placeholder') || 'name@hanasand.com'
            const submitLabel = this.getAttribute('submit-label') || 'Sign in'
            const ssoHref = this.getAttribute('sso-href')
            const ssoLabel = this.getAttribute('sso-label') || 'Continue with Google'
            const passkeyOptionsUrl = this.getAttribute('passkey-options-url')
            const passkeyVerifyUrl = this.getAttribute('passkey-verify-url')
            this.innerHTML = `<div class="hanasand-login-form__fields">
                <label class="hanasand-login-form__label"><span class="identifier-label"></span><input name="username" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" required></label>
                <label class="hanasand-login-form__label">Password<input name="password" type="password" autocomplete="current-password" placeholder="Enter your password" required></label>
                <p class="hanasand-login-form__error" role="alert" aria-live="polite" hidden></p>
                <button class="hanasand-login-form__submit" type="submit"><span class="hanasand-login-form__spinner" aria-hidden="true" hidden></span><span class="button-label"></span></button>
                <div class="hanasand-login-form__providers"></div>
            </div>`
            this.querySelector('.identifier-label')!.textContent = identifierLabel
            this.querySelector<HTMLInputElement>('input[name="username"]')!.placeholder = identifierPlaceholder
            this.querySelector('.button-label')!.textContent = submitLabel
            this.querySelector<HTMLInputElement>('input[name="username"]')!.value = this.getAttribute('identifier-value') || ''
            this.dataset.submitLabel = submitLabel

            const providers = this.querySelector('.hanasand-login-form__providers')!
            if (ssoHref && isSameOriginPath(ssoHref)) {
                const link = document.createElement('a')
                link.className = 'hanasand-login-form__provider'
                link.href = ssoHref
                link.textContent = ssoLabel
                providers.append(link)
            }
            if (passkeyOptionsUrl && passkeyVerifyUrl && isSameOriginPath(passkeyOptionsUrl) && isSameOriginPath(passkeyVerifyUrl)) {
                const passkeyButton = document.createElement('button')
                passkeyButton.className = 'hanasand-login-form__provider'
                passkeyButton.type = 'button'
                passkeyButton.textContent = 'Sign in with passkey'
                passkeyButton.addEventListener('click', () => void this.signInWithPasskey(passkeyButton, passkeyOptionsUrl, passkeyVerifyUrl))
                providers.append(passkeyButton)
            }
        }

        async signInWithPasskey(button: HTMLButtonElement, optionsUrl: string, verifyUrl: string) {
            const username = this.querySelector<HTMLInputElement>('input[name="username"]')?.value.trim() || ''
            const originalText = button.textContent || 'Sign in with passkey'
            button.disabled = true
            button.textContent = 'Waiting for passkey…'
            this.setError('')
            try {
                if (!navigator.credentials?.get || !window.PublicKeyCredential) throw new Error('Passkeys are not available in this browser.')
                const optionsTarget = new URL(optionsUrl, window.location.href)
                if (username) optionsTarget.searchParams.set('username', username)
                const optionsResponse = await fetch(optionsTarget, { credentials: 'same-origin', cache: 'no-store' })
                const options = await optionsResponse.json()
                if (!optionsResponse.ok || !options?.publicKey || !options?.challengeId) throw new Error(options?.error || 'Passkey sign-in could not be started.')
                const publicKey = { ...options.publicKey, challenge: decodeBase64Url(options.publicKey.challenge) }
                if (Array.isArray(publicKey.allowCredentials)) {
                    publicKey.allowCredentials = publicKey.allowCredentials.map((item: { id: string }) => ({ ...item, id: decodeBase64Url(item.id) }))
                }
                const credential = await navigator.credentials.get({ publicKey }) as PublicKeyCredential | null
                if (!credential) throw new Error('Passkey sign-in was cancelled.')
                const verifyResponse = await fetch(verifyUrl, {
                    method: 'POST', credentials: 'same-origin', cache: 'no-store',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ challengeId: options.challengeId, credential: serializeCredential(credential) }),
                })
                const result = await verifyResponse.json().catch(() => null)
                if (!verifyResponse.ok) throw new Error(result?.error || 'Passkey sign-in failed.')
                if (result?.token && result?.id) {
                    const accepted = this.dispatchEvent(new CustomEvent('hanasand-authenticated', { bubbles: true, cancelable: true, detail: result }))
                    if (!accepted) return
                    throw new Error('This app could not finish the passkey sign-in.')
                }
                const redirectPath = this.getAttribute('redirect-path') || '/'
                window.location.assign(isSameOriginPath(redirectPath) ? redirectPath : '/')
            } catch (error) {
                this.setError(error instanceof Error && error.name === 'NotAllowedError' ? 'Passkey sign-in was cancelled.' : error instanceof Error ? error.message : 'Passkey sign-in failed.')
                button.disabled = false
                button.textContent = originalText
            }
        }

        setBusy(busy: boolean) {
            const button = this.querySelector<HTMLButtonElement>('.hanasand-login-form__submit')
            if (!button) return
            button.disabled = busy
            const spinner = this.querySelector<HTMLElement>('.hanasand-login-form__spinner')
            if (spinner) spinner.hidden = !busy
            const label = this.querySelector('.button-label')
            if (label) label.textContent = busy ? 'Signing in…' : this.dataset.submitLabel || 'Sign in'
        }

        setError(message: string) {
            const error = this.querySelector<HTMLElement>('.hanasand-login-form__error')
            if (!error) return
            error.textContent = message || ''
            error.hidden = !message
        }
    }

    customElements.define('hanasand-login-form', HanasandLoginForm)
}

function isSameOriginPath(value: string) {
    try {
        const url = new URL(value, window.location.href)
        return url.origin === window.location.origin && url.pathname.startsWith('/') && !url.pathname.startsWith('//')
    } catch {
        return false
    }
}

function decodeBase64Url(value: string) {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(base64 + '='.repeat((4 - base64.length % 4) % 4))
    return Uint8Array.from(binary, character => character.charCodeAt(0))
}

function encodeBase64Url(value: ArrayBuffer) {
    const bytes = new Uint8Array(value)
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function serializeCredential(credential: PublicKeyCredential) {
    const response = credential.response as AuthenticatorAssertionResponse
    return {
        id: credential.id,
        rawId: encodeBase64Url(credential.rawId),
        type: credential.type,
        response: {
            clientDataJSON: encodeBase64Url(response.clientDataJSON),
            authenticatorData: encodeBase64Url(response.authenticatorData),
            signature: encodeBase64Url(response.signature),
            userHandle: response.userHandle ? encodeBase64Url(response.userHandle) : null,
        },
    }
}
