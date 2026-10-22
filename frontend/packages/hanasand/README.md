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
