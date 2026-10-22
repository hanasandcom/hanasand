# Mail UI entry

`hanasand/mail` exports the shared Mail workspace, selection controls, API provider, hooks, and Mail-domain types. Hosts implement `MailUiApi` and pass it through `MailUiApiProvider`; endpoints and credentials remain host-owned.

The entry uses React 19, React DOM, and `lucide-react`. The package installs `fflate` for DMARC archive parsing. The host app should include `hanasand/styles.css` in its global stylesheet. Host theme variables supply the `ui-*` color palette. Attachment previews use standard browser image elements so the entry does not depend on a specific web framework.
