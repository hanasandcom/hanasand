import { redirect } from 'next/navigation'

export default async function Page(props: { searchParams: Promise<{ mailboxUser?: string }> }) {
    const searchParams = await props.searchParams
    const destination = new URL('https://mail.hanasand.com/')
    if (searchParams.mailboxUser) destination.searchParams.set('mailboxUser', searchParams.mailboxUser)
    return redirect(destination.toString())
}
