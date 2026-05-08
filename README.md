# KiraPass - KIRAPAY Solana Checkout

KiraPass is a working prototype for the Superteam Frontier "Build with KIRAPAY" track. It is a pass marketplace for Solana creators, workshops, and IRL community teams. Buyers can pay from their preferred chain or token through KIRAPAY, while the merchant settles in USDC on Solana.

The goal is to make KIRAPAY the core enabler, not a bolt-on checkout button:

- Server-side `POST /api/checkout` creates KIRAPAY payment links with `x-api-key`.
- KIRAPAY hosted checkout is the payment path for every pass.
- `POST /api/webhooks/kirapay` accepts realtime lifecycle updates.
- `GET /api/links` and `GET /api/transactions` reconcile KIRAPAY links and settlement activity.
- Demo mode lets judges run the full UX without an API key, while live mode uses the real KIRAPAY API.

## Why This Fits The Track

KIRAPAY's challenge asks for a Solana app with real-world utility, cross-chain checkout, live API usage, a public repo, a clear README, a short demo video, and a concise write-up.

KiraPass targets a concrete adoption wedge: event organizers, educators, and creators in the Solana ecosystem often want to collect USDC on Solana, but their buyers may hold funds on another supported chain. KIRAPAY removes the chain-switching and bridging work from the buyer while keeping merchant reconciliation simple.

## Run Locally

```bash
npm run dev
```

Open `http://localhost:3000`.

This project has no package dependencies. It uses the Node.js standard library and browser APIs.

## Live KIRAPAY Mode

1. Create or access a merchant account at `https://dashboard.kira-pay.com`.
2. Configure your settlement address and token in KIRAPAY.
3. Create `.env` from `.env.example`.
4. Add your KIRAPAY API key:

```bash
KIRAPAY_API_KEY=your_key_here
KIRAPAY_API_BASE=https://api.kira-pay.com/api
KIRAPAY_RECEIVER=your_configured_settlement_address
KIRAPAY_SETTLEMENT_CHAIN=Solana
KIRAPAY_SETTLEMENT_TOKEN=USDC
```

5. Run:

```bash
npm run dev
```

When the API key is configured and `KIRAPAY_MOCK` is not `1`, checkout calls `POST /link/generate` and returns the live KIRAPAY payment URL.

## Demo Mode

If `KIRAPAY_API_KEY` is empty, KiraPass switches to demo mode. Demo mode keeps the same app flow, order creation, receipt, merchant console, and webhook-ready architecture, but uses `/mock-checkout.html` instead of the hosted KIRAPAY URL.

## Project Structure

- `server.js` - static server plus KIRAPAY integration routes.
- `public/index.html` - app UI for checkout, merchant console, and ops.
- `public/app.js` - frontend state and API calls.
- `public/mock-checkout.html` - demo fallback for no-key judging.
- `public/success.html` - buyer receipt page.
- `docs/WRITEUP.md` - concise project write-up for submission.
- `docs/DEMO_SCRIPT.md` - under-5-minute video plan.
- `docs/SUBMISSION.md` - Superteam form answers and links checklist.

## KIRAPAY API Touchpoints

- `POST /link/generate` - creates payment links.
- `GET /link?page=1&limit=20` - reconciles generated links.
- `GET /wallet/transactions?page=1&limit=20` - reads transaction history.
- `POST /api/webhooks/kirapay` - receives status events from KIRAPAY.

The API key is never exposed to the browser.

## Sources

- Superteam listing: https://superteam.fun/earn/listing/build-with-kirapay
- KIRAPAY docs overview: https://docs.kira-pay.com/
- KIRAPAY developer API overview: https://docs.kira-pay.com/developer/apis/overview
- KIRAPAY payment flow: https://docs.kira-pay.com/payments/payment-flow
- KIRAPAY supported chains: https://docs.kira-pay.com/payments/supported-chains-and-tokens
