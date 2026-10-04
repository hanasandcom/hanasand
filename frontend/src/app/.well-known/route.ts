export function GET() {
    return new Response(null, {
        status: 308,
        headers: {
            Location: '/.well-known/security.txt',
            'Cache-Control': 'public, max-age=3600',
        },
    })
}
