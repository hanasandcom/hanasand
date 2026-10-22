import { NextResponse } from 'next/server'

/** Finish cookie-session setup before requesting a page that requires its device proof. */
export function browserSessionRedirect(target: URL) {
    const allowedOrigin = new URL(process.env.SOCIAL_AUTH_ORIGIN || 'https://hanasand.com').origin
    if (target.protocol !== 'https:' || target.origin !== allowedOrigin || target.username || target.password) {
        throw new Error('Invalid sign-in destination')
    }
    const destination = JSON.stringify(target.toString()).replaceAll('<', '\\u003c')
    return new NextResponse(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Signing in</title></head>
<body><p id="status" role="status">Completing sign-in…</p>
<script src="/device-proof-client.js"></script>
<script>void (async () => {
    try {
        if ('serviceWorker' in navigator) {
            const device = await window.hanasandDeviceProofReady;
            if (!device) throw new Error('Device proof unavailable');
            await device.sync();
        }
        window.location.replace(${destination});
    } catch {
        document.getElementById('status').textContent = 'Sign-in could not be completed. Return to the login page and try again.';
    }
})();</script></body></html>`, {
        status: 200,
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
            'Referrer-Policy': 'no-referrer',
        },
    })
}
