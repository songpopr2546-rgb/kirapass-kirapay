const params = new URLSearchParams(window.location.search);
const orderId = params.get("order");
const receipt = document.querySelector("#mockReceipt");
const button = document.querySelector("#completeDemo");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderLine(label, value) {
  return `<div class="receipt-line"><span>${escapeHtml(label)}</span><strong>${escapeHtml(
    value,
  )}</strong></div>`;
}

async function loadOrder() {
  const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}`);
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.message || "Order not found.");
  }
  const order = body.data.order;
  receipt.innerHTML = [
    renderLine("Order", order.id),
    renderLine("Pass", `${order.passTitle} x ${order.quantity}`),
    renderLine("Amount", `$${order.amount} ${order.currency}`),
    renderLine("Settles to", `${order.settlementChain} ${order.currency}`),
  ].join("");
}

button.addEventListener("click", async () => {
  button.disabled = true;
  button.textContent = "Confirming...";
  const response = await fetch(
    `/api/orders/${encodeURIComponent(orderId)}/complete-demo`,
    { method: "POST" },
  );
  const body = await response.json();
  if (!response.ok) {
    button.disabled = false;
    button.textContent = body.message || "Try again";
    return;
  }
  window.location.href = `/success.html?order=${encodeURIComponent(orderId)}`;
});

loadOrder().catch((error) => {
  receipt.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
  button.disabled = true;
});
