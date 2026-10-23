# hanasand

Shared web UI and browser utilities used by Hanasand applications. The root exports common dashboard primitives, application header and sidebar components, and cookie helpers. Mail UI stays behind the `hanasand/mail` entry so applications that do not use Mail do not load its dependencies.

## Install

```sh
npm install hanasand
```

React applications using the Mail entry also need `next`, `lucide-react`, and `fflate` as peer dependencies.

## Common dashboard UI

```tsx
import { DashboardPage, DashboardPanel, DashboardTable } from 'hanasand'
```

Use `Header` for the Hanasand brand and service links, and `Sidebar` to provide a
shared semantic container around an application's own navigation. Load the header
styles from the app's local package bundle and pass its locally served logo path:

```tsx
import { Header, Sidebar } from 'hanasand'
import 'hanasand/chrome.css'

<Header logoSrc='/assets/hanasand-logo.png' />
<Sidebar aria-label='Dashboard sidebar' className='app-sidebar'>...</Sidebar>
```

The package includes a small monochrome-ready logo in `dist/assets`. Copy it into a
host's local static assets or serve it from the package. Header links and logo
requests stay local to each app.

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

For server-rendered templates that enhance the custom element, use
`renderHanasandLoginFormMarkup` from `hanasand/auth`. It returns a complete form with
credential, Google, and passkey controls already in the HTML; do not wrap it in another
form. Call `registerHanasandLoginForm` in the browser to attach passkey behavior. The
enhancer preserves the server-rendered controls.

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
