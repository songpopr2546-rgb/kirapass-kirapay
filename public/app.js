const state = {
  config: null,
  selectedPassId: null,
  orders: [],
  links: [],
  transactions: [],
  webhooks: [],
};

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getSelectedPass() {
  return state.config.passes.find((pass) => pass.id === state.selectedPassId);
}

function setActiveTab(tabName) {
  $$(".tab").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tab === tabName);
  });
  $$(".panel").forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.panel === tabName);
  });
  if (tabName !== "checkout") {
    loadDashboard();
  }
}

function renderConfig() {
  const { mode, settlementChain, settlementToken, apiKeyConfigured } =
    state.config;
  $("#modeLabel").textContent =
    mode === "live"
      ? "Live API"
      : apiKeyConfigured
        ? "Demo forced"
        : "Demo mode";
  $("#settlementLabel").textContent = `${settlementChain} ${settlementToken}`;
}

function renderPasses() {
  const grid = $("#passGrid");
  const select = $("#passSelect");

  grid.innerHTML = state.config.passes
    .map(
      (pass) => `
        <article class="pass-card ${
          pass.id === state.selectedPassId ? "is-selected" : ""
        }" data-pass-id="${escapeHtml(pass.id)}" data-accent="${escapeHtml(
          pass.accent,
        )}">
          <div class="pass-art" aria-hidden="true"></div>
          <div class="pass-body">
            <div class="pass-meta">
              <span>${escapeHtml(pass.category)}</span>
              <span>${pass.capacity} seats</span>
            </div>
            <h3>${escapeHtml(pass.title)}</h3>
            <p>${escapeHtml(pass.tagline)}</p>
            <div class="pass-footer">
              <span class="price">${currency.format(pass.price)}</span>
              <button class="select-pass" type="button" data-select-pass="${
                pass.id
              }">Select</button>
            </div>
          </div>
        </article>
      `,
    )
    .join("");

  select.innerHTML = state.config.passes
    .map(
      (pass) =>
        `<option value="${escapeHtml(pass.id)}">${escapeHtml(
          pass.title,
        )} - ${currency.format(pass.price)}</option>`,
    )
    .join("");
  select.value = state.selectedPassId;

  $$("[data-select-pass]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedPassId = button.dataset.selectPass;
      $("#passSelect").value = state.selectedPassId;
      renderPasses();
      updateTotal();
    });
  });
}

function updateTotal() {
  const pass = getSelectedPass();
  const quantity = Math.max(1, Number($("#quantityInput").value || 1));
  $("#totalLabel").textContent = `${currency.format(
    pass.price * quantity,
  )} USDC`;
}

async function createCheckout(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = $("#checkoutButton");
  const result = $("#checkoutResult");
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  button.disabled = true;
  button.textContent = "Creating...";
  result.hidden = true;

  try {
    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json();

    if (!response.ok) {
      throw new Error(body.message || "Checkout failed.");
    }

    const { order, paymentUrl, mode } = body.data;
    result.hidden = false;
    result.innerHTML = `
      <strong>${mode === "live" ? "Live KIRAPAY link" : "Demo checkout link"}</strong>
      <span class="muted">Order ${escapeHtml(order.id)}</span>
      <a href="${escapeHtml(paymentUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(
        paymentUrl,
      )}</a>
      <button class="secondary-action" type="button" id="copyLink">Copy link</button>
    `;

    $("#copyLink").addEventListener("click", async () => {
      await navigator.clipboard.writeText(paymentUrl);
      $("#copyLink").textContent = "Copied";
    });

    await loadDashboard();
  } catch (error) {
    result.hidden = false;
    result.innerHTML = `<strong>Checkout error</strong><span>${escapeHtml(
      error.message,
    )}</span>`;
  } finally {
    button.disabled = false;
    button.textContent = "Generate checkout";
  }
}

function statusClass(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized.includes("settled") || normalized.includes("completed")) {
    return "status settled";
  }
  if (normalized.includes("demo")) {
    return "status demo";
  }
  return "status";
}

function shortId(value) {
  const text = String(value || "");
  if (text.length <= 14) return text;
  return `${text.slice(0, 7)}...${text.slice(-5)}`;
}

function renderOrders() {
  $("#ordersMetric").textContent = state.orders.length;
  $("#volumeMetric").textContent = currency.format(
    state.orders
      .filter((order) => order.status === "settled")
      .reduce((sum, order) => sum + Number(order.amount || 0), 0),
  );
  $("#linksMetric").textContent = state.links.length;
  $("#txMetric").textContent = state.transactions.length;

  const rows = state.orders
    .map(
      (order) => `
        <tr>
          <td>
            <strong>${escapeHtml(shortId(order.id))}</strong><br />
            <span class="muted">${new Date(order.createdAt).toLocaleString()}</span>
          </td>
          <td>${escapeHtml(order.passTitle)} x ${order.quantity}</td>
          <td>
            ${escapeHtml(order.buyer.name)}<br />
            <span class="muted">${escapeHtml(order.buyer.email)}</span>
          </td>
          <td><span class="${statusClass(order.status)}">${escapeHtml(
            order.status,
          )}</span></td>
          <td>${currency.format(order.amount)} ${escapeHtml(order.currency)}</td>
          <td><a href="${escapeHtml(
            order.kirapay.paymentUrl,
          )}" target="_blank" rel="noopener noreferrer">Open</a></td>
        </tr>
      `,
    )
    .join("");

  $("#ordersTable").innerHTML =
    rows ||
    `<tr><td colspan="6" class="muted">No orders yet.</td></tr>`;
}

function renderWebhooks() {
  const list = $("#webhookList");
  const entries = state.webhooks.slice(0, 6);
  list.innerHTML =
    entries
      .map(
        (event) => `
        <div class="event">
          <strong>${new Date(event.receivedAt).toLocaleString()}</strong>
          <code>${escapeHtml(JSON.stringify(event.payload, null, 2))}</code>
        </div>
      `,
      )
      .join("") || `<div class="event muted">No webhook events yet.</div>`;
}

async function loadDashboard() {
  const [ordersRes, linksRes, txRes, webhooksRes] = await Promise.all([
    fetch("/api/orders"),
    fetch("/api/links"),
    fetch("/api/transactions"),
    fetch("/api/webhooks"),
  ]);
  const [ordersBody, linksBody, txBody, webhooksBody] = await Promise.all([
    ordersRes.json(),
    linksRes.json(),
    txRes.json(),
    webhooksRes.json(),
  ]);

  state.orders = ordersBody.data?.orders || [];
  state.links = linksBody.data?.links || [];
  state.transactions = txBody.data?.transactions || [];
  state.webhooks = webhooksBody.data?.webhooks || [];

  renderOrders();
  renderWebhooks();
}

async function init() {
  const configRes = await fetch("/api/config");
  const configBody = await configRes.json();
  state.config = configBody.data;
  state.selectedPassId = state.config.passes[0].id;

  renderConfig();
  renderPasses();
  updateTotal();
  await loadDashboard();

  $$(".tab").forEach((button) => {
    button.addEventListener("click", () => setActiveTab(button.dataset.tab));
  });

  $("#passSelect").addEventListener("change", (event) => {
    state.selectedPassId = event.target.value;
    renderPasses();
    updateTotal();
  });

  $("#quantityInput").addEventListener("input", updateTotal);
  $("#checkoutForm").addEventListener("submit", createCheckout);
  $("#refreshDashboard").addEventListener("click", loadDashboard);
}

init().catch((error) => {
  console.error(error);
  document.body.innerHTML = `<main class="centered-page"><div class="checkout-card"><h1>Unable to load KiraPass</h1><p>${escapeHtml(
    error.message,
  )}</p></div></main>`;
});
