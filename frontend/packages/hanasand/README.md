# hanasand

Shared web UI and browser utilities used by Hanasand applications. The root exports common dashboard primitives and cookie helpers. Mail UI stays behind the `hanasand/mail` entry so applications that do not use Mail do not load its dependencies.

## Install

```sh
npm install hanasand
```

React applications using the Mail entry also need `next`, `lucide-react`, and `fflate` as peer dependencies.

## Common dashboard UI

```tsx
import { DashboardPage, DashboardPanel, DashboardTable } from 'hanasand'
```

## Identity login UI

Use the shared login form and pass each host's same-origin routes. Identity remains
the authentication service; the host app owns the routes and session cookies.

```tsx
import { IdentityLoginForm } from 'hanasand'

<IdentityLoginForm
  loginUrl='/api/auth/login'
  passkeyOptionsUrl='/api/auth/passkeys/authenticate/options'
  passkeyVerifyUrl='/api/auth/passkeys/authenticate/verify'
  ssoHref='/api/auth/sso/start'
  redirectPath='/dashboard'
/>
```

Browser-only hosts can register the same controls from `hanasand/auth` and load
`hanasand/auth.css`. The package entry has no remote script dependency; hosts provide
their own same-origin sign-in routes and session handling.

The dashboard components use the host app's Tailwind `ui-*` theme classes. Add this to the app's global stylesheet so Tailwind scans package classes:

```css
@import 'hanasand/styles.css';
```

## Browser cookies

```ts
import { getCookie, setCookie, removeCookie } from 'hanasand/cookies'
```

These helpers require a browser document when called. Hanasand subdomains share cookie cleanup behavior for legacy domain cookies.

## Mail UI

```tsx
import { MailUiApiProvider, MailWorkspace } from 'hanasand/mail'
```

Each host supplies its own `MailUiApi`; the package does not select an API host or own credentials. See [Mail-README.md](./Mail-README.md) for the API adapter and Tailwind integration contract.
