# SqueekStage

**A live stream companion for Squeekchain: one broadcast overlay fed by the hamster economy, plus on-chain SQK tipping.**

Squeekchain is a hamster-powered proof-of-work toychain: a real animal on a real wheel produces work,
work settles into blocks, blocks pay SQK. SqueekStage gives that loop a face for streamers — and a way for
viewers to take part with real transactions.

- **Overlay** (`/?obs=1#/stage`) — transparent 1920×1080 browser source for OBS: block height and progress,
  lifetime wheel distance, work units, settlements, active days, a settlement ticker, and animated tip alerts.
- **Tip page** (`#/tip`) — viewers connect a wallet and send SQK straight to the streamer. Plain ERC-20
  `transfer`, no approvals, no proxy contract, no custody.
- **Setup** (`#/setup`) — pick the streamer wallet, accent colour, alert threshold, demo feed; copy the OBS URL.

No backend. No database. No API keys. No build step.

## Why it exists

The wheel is the product, but viewers only see a hamster. SqueekStage turns the on-chain side of the stream
into something a chat can read at a glance — and lets that chat pay the streamer in the chain's own token,
without a payment processor in the middle.

Everything the overlay shows is either a public API read or an ERC-20 `Transfer` log, so the numbers can be
checked by anyone watching. Tips arrive from chain logs rather than a server, which means the overlay
survives refreshes, OBS restarts and machine changes — nothing to lose.

## Run it

Any static file server works. ES modules need HTTP, not `file://`.

```bash
cd squeekstage
python3 -m http.server 8080
# open http://localhost:8080
```

Or deploy the folder as-is to Vercel, Netlify, Cloudflare Pages, GitHub Pages or IPFS.

## Put it on stream

1. Open `#/setup`, paste the wallet that should receive tips, pick an accent, save.
2. Copy the overlay URL (it carries `?obs=1&streamer=0x…`).
   Query parameters go before the hash route, as in `http://localhost:8080/?obs=1#/stage`.
3. OBS → **Sources → + → Browser** → paste, size **1920×1080**, tick *Shutdown source when not visible*.
   Leave *Custom CSS* empty: the page is already transparent.
4. Share the tip URL in chat.

Open `http://localhost:8080/?demo=1#/stage` to replace real tips with a synthetic feed and preview the overlay without funds.

## What it reads

| Source | Used for |
|---|---|
| `GET /v1/core` | block height, block progress, round, difficulty |
| `GET /v1/economy/state` | token address/decimals, live supply, staking totals |
| `GET /v1/events?category=all` | settlement + claim ticker, new-block pulse |
| `GET /v1/measurement/stats?range=7d` | wheel distance, work units, settlements, active days |
| `GET /v1/status` | liveness dot (online / stale / offline) |
| ERC-20 `Transfer` logs | tips |

## What it sends

Exactly one transaction type: `transfer(address,uint256)` on the SQK token, signed in the viewer's wallet
on Sepolia (`11155111`). The app never asks for an approval, never deploys anything, never touches a private key.

## Architecture

```
index.html          shell + hash routes
assets/app.css      design system (Squeekchain palette: #0b0b0d bench, gold #f2c230, blue #5b7cfa)
assets/app.js       router, views, polling, alert queue, WebAudio blip
src/api.js          public API client, TTL cache, event → ticker lines
src/chain.js        EIP-1193 wallet, ERC-20 encode/decode, chunked eth_getLogs, multi-RPC fallback
src/tips.js         settings store, tip feed, leaderboard, demo feed, share URLs
src/format.js       BigInt units, distances, relative time
```

Design notes:

- **No dependencies.** The ERC-20 calls are ~40 lines of ABI encoding instead of a 300 KB SDK.
- **Fails soft.** Every API read keeps the last good snapshot; a dead endpoint shows `stale`, not a blank stage.
- **Cheap reads.** TTL caches (3–30 s) and a 6 000-block log window in 2 000-block chunks keep public RPCs happy.
- **Auditable.** Alert amounts come from chain logs; the same numbers appear on any Sepolia explorer.

## Limits

- Tips are public on chain — amounts and addresses are visible to everyone.
- The log window is bounded (≈20 h of Sepolia blocks). For a busy stream, point `SEPOLIA.rpc` at a dedicated endpoint
  and widen `maxChunks`.
- The overlay assumes the Squeekchain deployment the public API reports; if the chain is redeployed, the app follows
  the API automatically because token and staking addresses are read at runtime, never hardcoded.

## Roadmap

- Twitch/YouTube chat commands (`!tip`) that build the same transaction.
- Wheel-speed "cheer" tiers: auto-pick an alert sound from the tip size.
- Optional 24 h leaderboard persisted per stream.

## License

MIT.


## Deploy to Cloudflare Workers

The repository includes a Cloudflare Worker that serves the static site through the Workers Static Assets binding. Requests pass through the Worker, and `/health` returns JSON to confirm the Worker is running. No secrets or backend services are required.

Production deployment: <https://squeekstage.uncle0-dev.workers.dev/>. Health check: <https://squeekstage.uncle0-dev.workers.dev/health>.

1. Install Node.js, then sign in to Cloudflare from this project directory:

   ```bash
   npx wrangler@4.30.0 login
   ```

2. Deploy the Worker and site:

   ```bash
   npx wrangler@4.30.0 deploy
   ```

For a local preview, run `npx wrangler@4.30.0 dev`. The Worker is configured in `wrangler.jsonc`; `.assetsignore` keeps project and deployment files out of the public asset bundle. To connect `squeekstage.online`, add it as a Workers custom domain in Cloudflare after deployment. The current Hostinger DNS still points the custom domain to GitHub Pages until changed.
