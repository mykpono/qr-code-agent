# QR Code Generator

Custom styled QR code generator — star dots, circular finders, logo overlay.

## Deploy

1. Push this repo to GitHub
2. Import in Vercel → it auto-detects as static
3. Add `qrcode.mykpono.com` as a custom domain in Vercel
4. In Cloudflare: add CNAME `qrcode` → your Vercel URL

## Files

- `index.html` — the entire app (self-contained, no build step)
- `vercel.json` — Vercel routing config
