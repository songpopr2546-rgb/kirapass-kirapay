const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = process.env.VERCEL
  ? path.join(os.tmpdir(), "kirapass-data")
  : path.join(ROOT, "data");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");
const WEBHOOKS_FILE = path.join(DATA_DIR, "webhooks.json");

const KIRAPAY_API_BASE =
  process.env.KIRAPAY_API_BASE || "https://api.kira-pay.com/api";
const KIRAPAY_API_KEY = process.env.KIRAPAY_API_KEY || "";
const FORCE_MOCK = process.env.KIRAPAY_MOCK === "1";
const SETTLEMENT_CHAIN = process.env.KIRAPAY_SETTLEMENT_CHAIN || "Solana";
const SETTLEMENT_TOKEN = process.env.KIRAPAY_SETTLEMENT_TOKEN || "USDC";
const RECEIVER =
  process.env.KIRAPAY_RECEIVER ||
  "7n5FZ7yMS6tZ7DemoSolanaSettlementWallet111111";

const passes = [
  {
    id: "creator-drop",
    title: "Creator Drop",
    price: 12,
    capacity: 250,
    category: "Creator",
    accent: "coral",
    tagline: "Paid digital drops for artists, educators, and community builders.",
  },
  {
    id: "workshop-seat",
    title: "Workshop Seat",
    price: 29,
    capacity: 80,
    category: "Education",
    accent: "blue",
    tagline: "Token-friendly registration for Solana workshops and cohorts.",
  },
  {
    id: "sponsor-booth",
    title: "Sponsor Booth",
    price: 149,
    capacity: 24,
    category: "IRL",
    accent: "green",
    tagline: "Cross-chain booth payments that settle to the organizer on Solana.",
  },
];

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

async function ensureDataFiles() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await ensureJsonFile(ORDERS_FILE, []);
  await ensureJsonFile(WEBHOOKS_FILE, []);
}

async function ensureJsonFile(filePath, fallback) {
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, JSON.stringify(fallback, null, 2));
  }
}

async function readJson(filePath, fallback) {
  await ensureJsonFile(filePath, fallback);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(body);
}

function sendText(res, status, text) {
  res.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  res.end(text);
}

function getOrigin(req) {
  const proto = req.headers["x-forwarded-proto"] || "http";
  const host = req.headers.host || `localhost:${PORT}`;
  return `${proto}://${host}`;
}

function isLiveMode() {
  return Boolean(KIRAPAY_API_KEY) && !FORCE_MOCK;
}

function findPass(id) {
  return passes.find((pass) => pass.id === id) || passes[0];
}

function toMoney(value) {
  return Number(value.toFixed(2));
}

function makeOrderId() {
  return `kp_${Date.now().toString(36)}_${crypto
    .randomBytes(3)
    .toString("hex")}`;
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Request body must be valid JSON."));
      }
    });
    req.on("error", reject);
  });
}

async function callKiraPay(endpoint, options = {}) {
  const response = await fetch(`${KIRAPAY_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      "x-api-key": KIRAPAY_API_KEY,
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { message: text };
  }

  if (!response.ok) {
    const message =
      payload.message ||
      payload.error ||
      `KIRAPAY request failed with ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

function extractPaymentUrl(payload) {
  return (
    payload?.data?.url ||
    payload?.data?.paymentUrl ||
    payload?.url ||
    payload?.paymentUrl ||
    ""
  );
}

function validateCheckoutInput(input) {
  const pass = findPass(String(input.passId || ""));
  const quantity = Math.max(1, Math.min(10, Number(input.quantity || 1)));
  const buyerName = String(input.buyerName || "").trim();
  const buyerEmail = String(input.buyerEmail || "").trim();
  const buyerHandle = String(input.buyerHandle || "").trim();

  if (buyerName.length < 2) {
    throw new Error("Buyer name is required.");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail)) {
    throw new Error("A valid email is required.");
  }

  return {
    pass,
    quantity,
    buyerName,
    buyerEmail,
    buyerHandle,
  };
}

async function createCheckout(req, res) {
  const input = await readRequestBody(req);
  const { pass, quantity, buyerName, buyerEmail, buyerHandle } =
    validateCheckoutInput(input);
  const origin = getOrigin(req);
  const orderId = makeOrderId();
  const total = toMoney(pass.price * quantity);
  const redirectUrl = `${origin}/success.html?order=${encodeURIComponent(
    orderId,
  )}`;

  const kirapayRequest = {
    price: total,
    currency: SETTLEMENT_TOKEN,
    receiver: RECEIVER,
    name: `KiraPass ${pass.title} - ${quantity} pass`,
    redirectUrl,
  };

  let paymentUrl = `${origin}/mock-checkout.html?order=${encodeURIComponent(
    orderId,
  )}`;
  let kirapayResponse = {
    message: "demo",
    data: { url: paymentUrl },
  };
  let mode = "demo";
  let status = "demo_checkout_created";

  if (isLiveMode()) {
    kirapayResponse = await callKiraPay("/link/generate", {
      method: "POST",
      body: JSON.stringify(kirapayRequest),
    });
    paymentUrl = extractPaymentUrl(kirapayResponse);
    if (!paymentUrl) {
      throw new Error("KIRAPAY did not return a payment URL.");
    }
    mode = "live";
    status = "checkout_created";
  }

  const order = {
    id: orderId,
    status,
    mode,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    passId: pass.id,
    passTitle: pass.title,
    quantity,
    amount: total,
    currency: SETTLEMENT_TOKEN,
    settlementChain: SETTLEMENT_CHAIN,
    receiver: RECEIVER,
    buyer: {
      name: buyerName,
      email: buyerEmail,
      handle: buyerHandle,
    },
    kirapay: {
      apiBase: KIRAPAY_API_BASE,
      request: kirapayRequest,
      response: kirapayResponse,
      paymentUrl,
    },
    events: [
      {
        type: status,
        at: new Date().toISOString(),
        source: mode === "live" ? "kirapay" : "demo",
      },
    ],
  };

  const orders = await readJson(ORDERS_FILE, []);
  orders.unshift(order);
  await writeJson(ORDERS_FILE, orders);

  sendJson(res, 201, {
    message: "checkout_created",
    data: {
      order,
      paymentUrl,
      mode,
    },
  });
}

async function updateDemoOrder(req, res, orderId) {
  const orders = await readJson(ORDERS_FILE, []);
  const order = orders.find((item) => item.id === orderId);

  if (!order) {
    sendJson(res, 404, { message: "Order not found." });
    return;
  }

  order.status = "settled";
  order.updatedAt = new Date().toISOString();
  order.events.unshift({
    type: "settled",
    at: new Date().toISOString(),
    source: "demo-checkout",
    transactionHash: `0x${crypto.randomBytes(32).toString("hex")}`,
  });

  await writeJson(ORDERS_FILE, orders);
  sendJson(res, 200, { message: "demo_order_settled", data: { order } });
}

async function receiveWebhook(req, res) {
  const payload = await readRequestBody(req);
  const receivedAt = new Date().toISOString();
  const event = { receivedAt, payload };
  const webhooks = await readJson(WEBHOOKS_FILE, []);
  webhooks.unshift(event);
  await writeJson(WEBHOOKS_FILE, webhooks.slice(0, 200));

  const orderId =
    payload.orderId ||
    payload.customOrderId ||
    payload?.data?.orderId ||
    payload?.data?.customOrderId ||
    payload?.data?.metadata?.orderId;

  if (orderId) {
    const orders = await readJson(ORDERS_FILE, []);
    const order = orders.find((item) => item.id === orderId);
    if (order) {
      const status =
        payload.status ||
        payload?.data?.status ||
        payload?.event ||
        "webhook_received";
      order.status = String(status).toLowerCase();
      order.updatedAt = receivedAt;
      order.events.unshift({
        type: order.status,
        at: receivedAt,
        source: "kirapay-webhook",
        payload,
      });
      await writeJson(ORDERS_FILE, orders);
    }
  }

  sendJson(res, 200, { message: "webhook_received" });
}

async function getOrders(res) {
  const orders = await readJson(ORDERS_FILE, []);
  sendJson(res, 200, { data: { orders } });
}

async function getOrder(res, orderId) {
  const orders = await readJson(ORDERS_FILE, []);
  const order = orders.find((item) => item.id === orderId);
  if (!order) {
    sendJson(res, 404, { message: "Order not found." });
    return;
  }
  sendJson(res, 200, { data: { order } });
}

async function getLinks(res) {
  if (isLiveMode()) {
    const payload = await callKiraPay("/link?page=1&limit=20", {
      method: "GET",
    });
    sendJson(res, 200, payload);
    return;
  }

  const orders = await readJson(ORDERS_FILE, []);
  sendJson(res, 200, {
    message: "demo",
    data: {
      links: orders.map((order) => ({
        _id: order.id,
        code: order.id,
        price: order.amount,
        name: order.kirapay.request.name,
        url: order.kirapay.paymentUrl,
        receiver: order.receiver,
        createdAt: order.createdAt,
      })),
      total: orders.length,
      page: 1,
      totalPages: 1,
    },
  });
}

async function getTransactions(res) {
  if (isLiveMode()) {
    const payload = await callKiraPay("/wallet/transactions?page=1&limit=20", {
      method: "GET",
    });
    sendJson(res, 200, payload);
    return;
  }

  const orders = await readJson(ORDERS_FILE, []);
  const transactions = orders
    .filter((order) => order.status === "settled")
    .map((order) => {
      const settledEvent = order.events.find((event) => event.type === "settled");
      return {
        _id: order.id,
        transaction_hash: settledEvent?.transactionHash || "",
        status: "COMPLETED",
        amount: order.amount,
        currency: order.currency,
        createdAt: settledEvent?.at || order.updatedAt,
      };
    });

  sendJson(res, 200, {
    message: "demo",
    data: {
      transactions,
      total: transactions.length,
    },
  });
}

async function getWebhooks(res) {
  const webhooks = await readJson(WEBHOOKS_FILE, []);
  sendJson(res, 200, { data: { webhooks } });
}

function getConfig(res) {
  sendJson(res, 200, {
    data: {
      appName: "KiraPass",
      mode: isLiveMode() ? "live" : "demo",
      kirapayApiBase: KIRAPAY_API_BASE,
      apiKeyConfigured: Boolean(KIRAPAY_API_KEY),
      settlementChain: SETTLEMENT_CHAIN,
      settlementToken: SETTLEMENT_TOKEN,
      receiver: RECEIVER,
      passes,
    },
  });
}

async function serveStatic(req, res, pathname) {
  let filePath = pathname === "/" ? "/index.html" : pathname;
  filePath = decodeURIComponent(filePath);

  const absolutePath = path.normalize(path.join(PUBLIC_DIR, filePath));
  if (!absolutePath.startsWith(PUBLIC_DIR)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  try {
    const stats = await fs.stat(absolutePath);
    const finalPath = stats.isDirectory()
      ? path.join(absolutePath, "index.html")
      : absolutePath;
    const ext = path.extname(finalPath);
    const content = await fs.readFile(finalPath);
    res.writeHead(200, {
      "content-type": mimeTypes[ext] || "application/octet-stream",
    });
    res.end(content);
  } catch {
    const fallback = path.join(PUBLIC_DIR, "index.html");
    const content = await fs.readFile(fallback);
    res.writeHead(200, { "content-type": mimeTypes[".html"] });
    res.end(content);
  }
}

async function handleApi(req, res, url) {
  const { pathname } = url;

  if (req.method === "GET" && pathname === "/api/config") {
    getConfig(res);
    return;
  }

  if (req.method === "POST" && pathname === "/api/checkout") {
    await createCheckout(req, res);
    return;
  }

  if (req.method === "GET" && pathname === "/api/orders") {
    await getOrders(res);
    return;
  }

  if (req.method === "GET" && pathname.startsWith("/api/orders/")) {
    await getOrder(res, pathname.split("/").pop());
    return;
  }

  if (req.method === "POST" && pathname.startsWith("/api/orders/")) {
    const parts = pathname.split("/");
    const orderId = parts[3];
    const action = parts[4];
    if (action === "complete-demo") {
      await updateDemoOrder(req, res, orderId);
      return;
    }
  }

  if (req.method === "POST" && pathname === "/api/webhooks/kirapay") {
    await receiveWebhook(req, res);
    return;
  }

  if (req.method === "GET" && pathname === "/api/webhooks") {
    await getWebhooks(res);
    return;
  }

  if (req.method === "GET" && pathname === "/api/links") {
    await getLinks(res);
    return;
  }

  if (req.method === "GET" && pathname === "/api/transactions") {
    await getTransactions(res);
    return;
  }

  sendJson(res, 404, { message: "API route not found." });
}

async function requestHandler(req, res) {
  try {
    await ensureDataFiles();
    const url = new URL(req.url, getOrigin(req));

    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }

    await serveStatic(req, res, url.pathname);
  } catch (error) {
    console.error(error);
    sendJson(res, error.status || 500, {
      message: error.message || "Unexpected server error.",
      details: error.payload,
    });
  }
}

module.exports = requestHandler;

if (require.main === module) {
  const server = http.createServer(requestHandler);
  server.listen(PORT, () => {
    console.log(`KiraPass running at http://localhost:${PORT}`);
    console.log(
      `KIRAPAY mode: ${isLiveMode() ? "live" : "demo"} (${KIRAPAY_API_BASE})`,
    );
  });
}
