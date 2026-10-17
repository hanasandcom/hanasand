export function evaluateLoginDashboard(title, bodyText) {
    const text = `${title}\n${bodyText}`.toLowerCase()
    if (!text.includes('operations workbench')) {
        return { ok: false, detail: `Dashboard did not show Operations Workbench. Title: ${title || 'untitled'}` }
    }
    if (/unauthorized|forbidden|sign in|log in|missing system_admin/i.test(bodyText)) {
        return { ok: false, detail: 'Dashboard rendered an authentication or authorization failure after login.' }
    }
    return { ok: true, detail: 'Login reached Operations Workbench.' }
}
