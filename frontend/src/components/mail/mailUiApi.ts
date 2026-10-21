'use client'

import type { MailUiApi } from '@hanasand/mail-ui'
import * as client from '@/utils/mail/client'

export const mailUiApi = {
    fetchMailOverview: client.fetchMailOverview,
    searchMail: client.searchMail,
    fetchMailRemoteContent: client.fetchMailRemoteContent,
    sendMail: client.sendMail,
    messageAction: client.messageAction,
    createMailbox: client.createMailbox,
    createFilter: client.createFilter,
    deleteFilter: client.deleteFilter,
    fetchMailBlob: client.fetchMailBlobResponse,
} satisfies MailUiApi
