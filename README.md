# SqueekStage

A live stream companion for the Squeekchain hamster wheel: live block and wheel readings, a transparent OBS overlay, and direct SQK tips on Sepolia.

## Install, preview and rebuild

Use Node.js 22.12 or newer and npm. Run these commands from the repository root. Frontend dependencies and their lockfile belong under `web/`; there is no root npm manifest or lockfile.

```sh
npm --prefix web ci
npm --prefix web run dev
```

Open the local URL Vite prints. For the production export:

```sh
npm --prefix web run typecheck
npm --prefix web run build
npm --prefix web run preview -- --host 127.0.0.1
```

`dist/index.html` and all runtime assets are included in the submission. Serve **dist/** with any static HTTP server; the publisher does not need to install dependencies or rebuild it. For example, `python3 -m http.server 8080 --directory dist`. Vite uses `base: './'`, and navigation uses hash routes, so a gateway subpath works without server rewrites. Do not open the HTML using `file://`.

## Use it

- **Overview:** read live wheel/block metrics and expand the latest ten on-chain events. Explorer links open the actual Sepolia transactions.
- **Stage:** preview the overlay, test a clearly labeled simulated alert, toggle sound, open fullscreen, and copy its OBS URL.
- **Tip:** enter the recipient, choose or enter an exact SQK amount, connect, switch to Sepolia if necessary, review the complete recipient and token address, then confirm the ERC-20 transfer in your wallet.
- **Setup:** save the streamer wallet, overlay accent, minimum alert amount, sound and optional demo tips. Copy the generated overlay and chat links. Settings are local to this browser; links carry them to another machine. A missing recipient leaves tips unconfigured rather than selecting a default recipient.
- **About & data:** inspect the public API, current API-reported SQK contract and RPC sources.

For OBS, add a **Browser** source, paste the overlay URL and set **1920 × 1080**. The background is transparent. Enable source audio in OBS if desired; browser audio can require a user gesture. The demo flag simulates tips only; it does not invent wheel data or submit transactions. Manual test alerts are always labeled as previews.

## Data and wallets

The existing Squeekchain endpoints remain at `https://api.squeekchain.com`: `/v1/core`, `/v1/economy/state`, `/v1/measurement/stats?range=7d`, `/v1/events?category=all&limit=10`, and `/v1/status`. Reads refresh every seven seconds. Failed sources retain their last successful readings and show a stale/offline state with retry. Initial unavailable values display a dash, not fabricated statistics.

The SQK address and decimals come from the economy API, validated for chain **11155111**, symbol SQK and a valid address. Tipping pauses when that metadata is unavailable or its refresh fails. Public chain reads stay on Sepolia using `https://ethereum-sepolia-rpc.publicnode.com`, then `https://1rpc.io/sepolia`. Writes go through the connected wallet, using `transfer(address,uint256)` with exact integer amounts. There are no approvals, deployments, private keys or backend credentials.

The single header wallet control uses wagmi EIP-6963 discovery for named browser extensions, a fallback Browser wallet option, Coinbase Wallet/Smart Wallet, and mobile links that open this page inside MetaMask, Coinbase Wallet, Rabby or Phantom. No WalletConnect project ID or relay is configured. Disconnect is in the connected-wallet dialog. Wallet requests, gas fees and confirmation remain under the visitor’s control.

## Source map

| Path                                           | Purpose                                                      |
| ---------------------------------------------- | ------------------------------------------------------------ |
| `index.html`                                   | Vite entry, metadata, favicon and share-card references      |
| `web/src/App.tsx`                              | Hash navigation, page shell, settings and notices            |
| `web/src/Dashboard.tsx`                        | Actual wheel/block readings, activity and statistics         |
| `web/src/Stage.tsx`                            | OBS export, alert queue, audio and demo controls             |
| `web/src/Tip.tsx`                              | Recipient/amount validation, review and transaction states   |
| `web/src/Setup.tsx`                            | Local settings and encoded share links                       |
| `web/src/api.ts`, `chain.ts`, `settings.ts`    | API schema, wallet/RPC configuration and exact amounts       |
| `web/src/Wallet.tsx`, `ui.tsx`, `graphics.tsx` | Wallet sheet, UI patterns and original SVG artwork           |
| `web/src/styles.css`                           | Tokens, six-step type scale and responsive styles            |
| `web/public/`                                  | Local fonts, licenses, wallet marks, favicon and share image |
| `web/package.json`, `web/package-lock.json`    | Reproducible frontend dependency graph                       |
| `web/vite.config.ts`, `web/tsconfig.json`      | Frontend build/typecheck configuration                       |
| `web/tests/interaction.mjs`                    | Browser checks against the production export                 |

The earlier vanilla JavaScript files under `assets/` and `src/`, and the original Worker configuration, remain in the repository. The active frontend entry is `index.html` → `web/src/main.tsx`; the deliverable is `dist/`.

## Validation

Actual commands, browser results, six-domain Better Interface coverage, fixes and limitations are recorded in [VALIDATION.md](VALIDATION.md). The implemented tokens and components are documented in [DESIGN.md](DESIGN.md).

Final worker checks on 2026-10-31: production build and typecheck both exited 0; **26/26 interaction groups** passed across Chromium and WebKit, and the pinned design probe passed **16/16 checks**. All five pages passed seven normal viewport widths and a separate 200% text-size reflow check at 390px. Real signatures, wallet-app handoffs and physical OBS use remain untested.

The browser checks use a separate temporary tool installation, not an application dependency or vendored registry:

```sh
npm --prefix /tmp/squeekstage-checks install playwright@1 @axe-core/playwright
/tmp/squeekstage-checks/node_modules/.bin/playwright install chromium webkit
node web/tests/interaction.mjs /tmp/squeekstage-checks/node_modules/playwright/index.mjs
```

On a minimal Linux system, Playwright also needs its documented browser system libraries. Tests serve `dist/` at `/preview/`, close their own server and browsers, and write disposable evidence to `test/scratch/interactions/`. API/RPC responses and injected wallets are controlled test doubles. These checks never sign or broadcast a real transaction and do not prove that an installed wallet or external service will always be available.

While the pinned review inputs are present, the design probe is:

```sh
IMD_PLAYWRIGHT=/tmp/squeekstage-checks/node_modules/playwright/index.mjs \
  node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste
```

The share image is a local 1200 × 630 PNG. Its editable source is `web/share-card.html`; optionally regenerate it with `node web/scripts/render-share.mjs /absolute/path/to/playwright/index.mjs` before rebuilding. Normal builds use the included PNG.

## Limits

SQK is a Sepolia test token, and sending requires Sepolia ETH for gas. Transfers and addresses are public and irreversible. Feed rankings cover up to 100 incoming transfers in the most recent 6,000 Sepolia blocks, not all-time totals. Stage reads tips every 12 seconds; Tip reads every 15 seconds. Historical transfers from the first scan do not replay alerts. An RPC or API outage is visible and recoverable but cannot be repaired by a static frontend.

Keep the transaction explorer link while waiting for a receipt. If confirmation times out, the page blocks another send and offers a read-only confirmation check. Transaction status is held for the current Tip page session; leaving or reloading the page does not cancel a submitted transaction, and its final status should be checked on the explorer. Physical wallet apps, real signatures, native screen readers and OBS itself require checks in those environments.

## Attribution

The site retains the Squeekchain dark/gold/blue identity. Quicksand, Barlow Condensed and IBM Plex Mono are bundled locally with their licenses. Wallet marks are from RainbowKit 2.2.11 under MIT, with the license in `web/public/wallets/`.

Design guidance: Jakub Krehel’s Better Interface, commit `267330e1adfc66a718fb65fa6918c1f06d0a689e` (MIT). Design documentation method: Paul Bakaus’s Impeccable, commit `9d715cc4f5564a990ca8345abfdd5df6dc9b41c8` (Apache-2.0). Both license texts are preserved in `web/design-guidance-LICENSE.txt`.

Project license: MIT, see [LICENSE](LICENSE).
