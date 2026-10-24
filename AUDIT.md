# AI chat sidebar baseline

Audit date: 2026-10-24; frontend baseline: `798d19914a673834c14e0de7abfd048ef495977f` (`main`).

## Scope and journey

This is a focused baseline for the chat sidebar lifecycle change, not a claim that the whole AI service has been audited. The `/ai` page and `/ai/:id` workspace render `ChatSidebar` from `frontend/src/app/ai/pageClient.tsx`. Conversation state is managed by `useAiWorkbench` and `useConversationActions`; authenticated conversation changes use `PUT /ai/conversations/:id`. `toConversationPayload` sends `workspaceMeta`, and the AI API stores it as JSON, so sidebar-specific metadata can persist without a schema migration.

Repository context is attached to a conversation by `workspaceMeta.repositoryId` or the repo workspace ID. The loaded repository supplies `fullName` and `branch`. Before this fix, the list truncated the chat title but exposed Rename, Archive/Restore and Delete as hover buttons. Rows were single `role=button` containers with nested lifecycle controls, and there was no pin, unread marker, project/section grouping, hover detail card, or context menu.

## Baseline quality and release checks

- Preserve repository and conversation metadata when changing a chat’s sidebar state.
- Keep the row’s default controls limited to Pin and Archive/Restore; make other actions available by pointer context menu, keyboard context-menu key or Shift+F10, and touch long press.
- Verify the chat list render, metadata round-trip, grouping and the branch request path with focused tests; run typecheck, lint guardrails and production build before release.
- Repository policy requires publishing `main` to Forgejo and GitHub, staging first, then using the frontend-only production deploy script and checking live behavior, revision, logs and service state.

## Design evidence used for this fix

The task is a list of chat records with both quick actions and less-frequent lifecycle actions. The implementation keeps only Pin and Archive/Restore beside each row, while keeping the full set in an accessible context menu. A hover card restores hidden context (full title, repository, branch and organization labels). Assignment to a project or section uses persisted conversation metadata and groups rows under those labels.

- Hornbæk and Hertzum’s controlled study of menu use found conventional hierarchical menus quicker and more accurate for known-item tasks, while a fisheye menu offered no browsing advantage. That supports keeping stable, predictable action names instead of a novel adaptive menu. The small participant pool and study-specific menu task limit generalization.
- van Oostendorp, Madrid and Puerta Melguizo compared expandable and sequential navigation with 35 university students. Expanded context helped most on deeper, less semantically aligned search paths and reduced disorientation, while accuracy did not differ. That supports showing repository and branch context on hover while preserving a compact default row; it does not justify expanding every row permanently.
- Fennedy et al.’s four-study TOCHI paper on command selection found that visual cues with command names help novices discover actions, and familiar mappings transfer better. This supports clear labels in the context menu and keyboard access, while the controls stay visually limited in the row.

Sources: [Hornbæk & Hertzum (2007)](https://doi.org/10.1145/1275511.1275512), [van Oostendorp et al. (2009)](https://doi.org/10.2174/1875934300902010064), [Fennedy et al. (2022)](https://doi.org/10.1145/3476510).
