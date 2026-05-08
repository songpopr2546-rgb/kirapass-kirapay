# KiraPass Demo Script

Target length: 4 minutes 30 seconds.

## 0:00 - 0:25 - Problem

"Solana communities want to sell workshops, drops, and event passes, but many buyers hold funds on another chain. Asking them to bridge or swap before checkout creates friction. KiraPass removes that step with KIRAPAY."

## 0:25 - 1:15 - Buyer Flow

1. Open the KiraPass app.
2. Select "Workshop Seat".
3. Show the checkout total in USDC.
4. Submit the form.
5. Point out that the server creates a KIRAPAY payment link.

If using a live API key, open the KIRAPAY URL and show the hosted checkout.

If recording without a key, open the demo checkout and complete the demo payment while explaining that live mode swaps this URL for KIRAPAY's hosted payment page.

## 1:15 - 2:10 - KIRAPAY Depth

Show `server.js` briefly:

- `POST /api/checkout`
- `callKiraPay("/link/generate")`
- API key in server environment only
- `POST /api/webhooks/kirapay`
- `GET /api/links`
- `GET /api/transactions`

Say: "KIRAPAY is the payment layer for every purchase. The app is not useful without the KIRAPAY checkout path."

## 2:10 - 3:05 - Merchant Console

1. Open the Merchant tab.
2. Show order count, settled volume, payment links, and transactions.
3. Open the generated payment link from the table.
4. Show the receipt page and status updates.

## 3:05 - 3:55 - Architecture And Scale

Open the Ops tab:

- Buyer creates order.
- Server creates KIRAPAY link.
- Customer pays cross-chain.
- Merchant reconciles settlement on Solana.

Mention the production path: Postgres, queues, idempotency, webhook retries, indexed KIRAPAY link IDs.

## 3:55 - 4:30 - Close

"KiraPass turns KIRAPAY into a practical adoption wedge for Solana commerce: any-token checkout for buyers, USDC settlement for merchants, and a clean operational console for teams running real communities."
