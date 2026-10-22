'use client'

import MailWorkspace from './components/mailWorkspace.js'
import { MailUiApiProvider, useMailUiApi } from './api.js'
import { MailSelect } from './components/mailSelect.js'

export { MailWorkspace, MailUiApiProvider, useMailUiApi }
export { MailSelect }
export type { MailSelectOption } from './components/mailSelect.js'
export type { MailUiApi, MailDraftAttachment, MailRemoteContent } from './api.js'
export type * from './types.js'
