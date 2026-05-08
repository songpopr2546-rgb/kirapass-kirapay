# KiraPass Write-Up

## Concept

KiraPass is a cross-chain checkout layer for Solana communities. It lets creators, educators, and event organizers sell access passes while settling revenue in USDC on Solana. Buyers do not need to bridge, switch networks, or already hold Solana assets. They choose a pass, receive a KIRAPAY hosted checkout link, and pay with their preferred supported token.

## Problem

Solana community commerce still has a wallet mismatch problem. Organizers want simple USDC settlement on Solana, but buyers may hold liquidity on Ethereum, Base, Polygon, BNB Chain, Arbitrum, or another supported ecosystem. Asking those buyers to bridge before checkout kills conversion.

KIRAPAY solves the missing middle: the buyer pays from where they already have funds, and the merchant receives on the configured settlement rail.

## Target Users

- Solana event organizers selling workshop seats or IRL passes.
- Creators selling paid drops to a multi-chain audience.
- Sponsors buying booths or packages from Solana communities.
- Merchant teams that need a clean reconciliation dashboard.

## KIRAPAY Integration

KIRAPAY is the core payment layer.

1. The buyer selects a pass in KiraPass.
2. KiraPass creates an internal order.
3. The server calls KIRAPAY `POST /link/generate` with:

```json
{
  "price": 29,
  "currency": "USDC",
  "receiver": "merchant settlement address",
  "name": "KiraPass Workshop Seat - 1 pass",
  "redirectUrl": "https://your-app.com/success.html?order=..."
}
```

4. The buyer opens the KIRAPAY payment URL.
5. KIRAPAY handles wallet connection, token selection, cross-chain routing, and settlement.
6. KiraPass receives webhook updates at `POST /api/webhooks/kirapay`.
7. The merchant console also polls KIRAPAY link and transaction APIs for reconciliation.

The browser never receives the KIRAPAY API key.

## Technical Architecture

KiraPass is intentionally small and easy to audit:

- Node.js standard library server.
- Static HTML, CSS, and JavaScript frontend.
- JSON file storage for prototype orders and webhook events.
- Server-side KIRAPAY client with configurable `KIRAPAY_API_BASE`.
- Demo mode fallback when no API key is present.

The production architecture would swap JSON storage for Postgres, add signed webhook verification once available, and push order status updates through WebSockets or server-sent events.

## Scalability

The payment path is horizontally scalable because order creation and KIRAPAY link creation are stateless apart from persistence. A production deployment would use:

- Postgres for orders and payment link records.
- A queue for webhook processing and retries.
- Idempotency keys for checkout creation.
- Indexed order status and KIRAPAY link IDs for reconciliation.
- Background transaction sync for delayed settlement updates.

High-volume events can separate reads from writes: checkout requests create orders and KIRAPAY links, webhook workers update status, and the merchant console reads cached summaries.

## Why It Can Win

- KIRAPAY is central to the app's value proposition.
- The use case is simple, real, and easy to demonstrate.
- The buyer experience directly highlights cross-chain checkout.
- The merchant console shows operational seriousness: links, orders, transactions, and webhook logs.
- The prototype can run instantly in demo mode and can switch to live KIRAPAY mode with one API key.

## Future Roadmap

- Issue compressed Solana receipt NFTs after settled payment.
- Add discount gates for Solana communities and creator memberships.
- Add QR check-in for IRL events.
- Add refunds from the merchant console using KIRAPAY refund APIs when available.
- Add project-level analytics for conversion by source chain and token.
