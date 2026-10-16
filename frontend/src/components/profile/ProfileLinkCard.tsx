import Link from 'next/link'

export default function ProfileLinkCard({ id }: { id: string }) {
    return (
        <div className='grid h-fit w-fit gap-2 rounded-lg border border-ui-border px-2 py-1'>
            <Link href={`/profile/${id}`} className='flex justify-between px-10 group cursor-pointer items-center'>
                <div className='user-icon' />
                <h1 className='font-semibold text-base self-center'>Profile</h1>
            </Link>
        </div>
    )
}
