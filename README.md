# 👉 Actions Mini App w/ SIWF

A minimalist Farcaster Mini App that replicates basic Cast Action functionality, including seamless signin.

Also, a FOSS starter template, including SIWF + a blank notifications webhook endpoint.

## dependencies

- front-end: vanilla HTML + CSS + JavaScript
- backend: Hono 🔥 on Cloudflare Workers with Zod validation
- viem + farcaster fnames service for "forever" free SIWF

## usage

1. copy a link to a cast
2. open Mini App
3. click
    - a Big Button for unauthenticated redirects
    - Decent Bookmarks 🔖 for authenticated interaction
4. Buy me an onchain coffee ☕ (optional)

## batteries included

- SIWF with CORS CSRF and secure headers middleware
- Typescript backend with runtime validation, security middleware
- cached Neynar API calls
