import type { OrganizationMember } from '../types/organization'
import { sanitizeOrganizationDisplayCopy } from '../model/textSafety'

export function MemberIdentity({ member, mobile = false }: { member: OrganizationMember, mobile?: boolean }) {
    return (
        <>
            <p className='truncate font-semibold text-ui-text dark:text-ui-text'>{sanitizeOrganizationDisplayCopy(member.name || member.email || member.userId)}</p>
            <p className={`${mobile ? 'mt-1 ' : ''}truncate text-xs text-ui-muted dark:text-ui-muted`}>{sanitizeOrganizationDisplayCopy(member.email && member.email !== member.userId ? member.email : member.userId)}</p>
        </>
    )
}
