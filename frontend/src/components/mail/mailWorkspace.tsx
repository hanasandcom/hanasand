'use client'

import { MailUiApiProvider, MailWorkspace as SharedMailWorkspace } from '@hanasand/mail-ui'
import { mailUiApi } from './mailUiApi'

export default function MailWorkspace({ mailboxUser }: { mailboxUser?: string | null }) {
    return (
        <MailUiApiProvider api={mailUiApi}>
            <SharedMailWorkspace mailboxUser={mailboxUser} />
        </MailUiApiProvider>
    )
}
