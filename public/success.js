const params = new URLSearchParams(window.location.search);
const orderId = params.get("order");
const receipt = document.querySelector("#receipt");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function line(label, value) {
  return `<div class="receipt-line"><span>${escapeHtml(label)}</span><strong>${escapeHtml(
    value,
  )}</strong></div>`;
}

async function loadReceipt() {
  const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}`);
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.message || "Order not found.");
  }
  const order = body.data.order;
  const events = order.events
    .slice(0, 4)
    .map(
      (event) =>
        `<li><strong>${escapeHtml(event.type)}</strong><span>${new Date(
          event.at,
        ).toLocaleString()}</span></li>`,
    )
    .join("");

  receipt.innerHTML = `
    <p class="overline">Receipt</p>
    <h1>${escapeHtml(order.passTitle)}</h1>
    <div class="receipt-lines">
      ${line("Order", order.id)}
      ${line("Status", order.status)}
      ${line("Buyer", order.buyer.name)}
      ${line("Amount", `$${order.amount} ${order.currency}`)}
      ${line("Settlement", `${order.settlementChain} ${order.currency}`)}
    </div>
    <ol class="receipt-events">${events}</ol>
  `;
}

loadReceipt().catch((error) => {
  receipt.innerHTML = `<h1>Receipt unavailable</h1><p>${escapeHtml(
    error.message,
  )}</p>`;
});
