import {
  createPublicClient,
  http,
  fallback,
  defineChain,
  formatUnits,
  isAddress,
  getAddress,
} from "viem";

const GLDR = "0x46Bd9f1276234651D9Be3Ade250203C2094E1e18";
const HOOK = "0x4e3468951D49f2EEa976eD0D6e75fFCb44a9a544";
const POOL_ID = "0x06d26bdeea80f58caa7b07e017633500adbb57c197c2bc07f565a5315ccfdc14";
const BENEFICIARY = "0xBd6903FD50a9Fb6934087Fe1aDf5777422E2d654";
const WAD = 10n ** 18n;

const collectFeesAbi = [
  {
    type: "function",
    name: "collectFees",
    inputs: [{ name: "poolId", type: "bytes32" }],
    outputs: [
      { name: "fees0", type: "uint128" },
      { name: "fees1", type: "uint128" },
    ],
    stateMutability: "nonpayable",
  },
];

const feeViewAbi = [
  {
    type: "function",
    name: "getShares",
    inputs: [
      { name: "poolId", type: "bytes32" },
      { name: "user", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getLastCumulatedFees1",
    inputs: [
      { name: "poolId", type: "bytes32" },
      { name: "user", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
];

const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
];

const robinhood = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        "/robinhood-rpc",
        "https://rpc.mainnet.chain.robinhood.com",
      ],
    },
  },
});

const publicClient = createPublicClient({
  chain: robinhood,
  transport: fallback([
    http("/robinhood-rpc"),
    http("https://rpc.mainnet.chain.robinhood.com"),
  ]),
});

function formatUsd(amount) {
  if (!Number.isFinite(amount)) return "$—";
  if (amount === 0) return "$0";
  if (amount > 0 && amount < 0.01) return "<$0.01";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatToken(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: n >= 1000 ? 2 : 4,
  }).format(n);
}

function tokenUsd(raw, price) {
  return Number(formatUnits(raw, 18)) * price;
}

function formatChartUsd(amount) {
  if (!Number.isFinite(amount)) return "$—";
  if (amount === 0) return "$0";
  const digits = amount < 0.01 ? 8 : 4;
  const formatted = amount.toFixed(digits).replace(/0+$/, "").replace(/\.$/, "");
  return `$${formatted}`;
}

function smoothLine(points) {
  if (points.length < 2) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

async function fetchTwelveHourCloses() {
  const url =
    "https://api.geckoterminal.com/api/v2/networks/robinhood/pools/" +
    POOL_ID +
    "/ohlcv/minute?aggregate=15&limit=48&currency=usd&token=base&include_empty_intervals=true";
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("Chart feed unavailable");
  const data = await res.json();
  const rows = data?.data?.attributes?.ohlcv_list || [];
  const cutoff = Date.now() / 1000 - 12 * 60 * 60;
  return rows
    .map((row) => ({ t: Number(row[0]), close: Number(row[4]) }))
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.close) && p.t >= cutoff)
    .sort((a, b) => a.t - b.t);
}

function renderChart(series) {
  const line = document.getElementById("chart-line");
  const fill = document.getElementById("chart-fill");
  const price = document.getElementById("chart-price");
  if (!line || !fill || !price) return;

  if (!series.length) {
    line.setAttribute("d", "");
    fill.setAttribute("d", "");
    price.textContent = "$—";
    return;
  }

  const last = series[series.length - 1].close;
  price.textContent = formatChartUsd(last);

  const width = 400;
  const height = 140;
  const padX = 10;
  const padTop = 14;
  const padBottom = 12;
  const ys = series.map((p) => p.close);
  let min = Math.min(...ys);
  let max = Math.max(...ys);
  if (max === min) {
    min *= 0.98;
    max *= 1.02;
    if (min === 0 && max === 0) {
      min = 0;
      max = 1;
    }
  }
  const span = max - min;
  const innerW = width - padX * 2;
  const innerH = height - padTop - padBottom;
  const points = series.map((p, i) => ({
    x: padX + (innerW * i) / Math.max(series.length - 1, 1),
    y: padTop + innerH * (1 - (p.close - min) / span),
  }));

  const linePath = smoothLine(points);
  line.setAttribute("d", linePath);
  fill.setAttribute(
    "d",
    `${linePath} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`,
  );
}

async function fetchPrices() {
  const res = await fetch(
    "https://api.dexscreener.com/latest/dex/tokens/" + GLDR.toLowerCase(),
  );
  if (!res.ok) throw new Error("Price feed unavailable");
  const data = await res.json();
  const pair = (data.pairs || []).find(
    (p) =>
      p.chainId === "robinhood" &&
      p.quoteToken?.symbol === "GLD" &&
      p.baseToken?.address?.toLowerCase() === GLDR.toLowerCase(),
  ) || data.pairs?.[0];
  if (!pair) throw new Error("No GLDR market found");
  const gldrUsd = Number(pair.priceUsd);
  const gldrPerGld = Number(pair.priceNative);
  const gldUsd = gldrPerGld > 0 ? gldrUsd / gldrPerGld : 0;
  return { gldrUsd, gldUsd };
}

async function fetchGoldRetrieved({ gldUsd }) {
  const [{ result }, shares, lastGld] = await Promise.all([
    publicClient.simulateContract({
      address: HOOK,
      abi: collectFeesAbi,
      functionName: "collectFees",
      args: [POOL_ID],
      account: BENEFICIARY,
    }),
    publicClient.readContract({
      address: HOOK,
      abi: feeViewAbi,
      functionName: "getShares",
      args: [POOL_ID, BENEFICIARY],
    }),
    publicClient.readContract({
      address: HOOK,
      abi: feeViewAbi,
      functionName: "getLastCumulatedFees1",
      args: [POOL_ID, BENEFICIARY],
    }),
  ]);

  const poolFeesGld = result[1];
  const unclaimedGld = (poolFeesGld * shares) / WAD;
  const claimedGld = (lastGld * shares) / WAD;

  return {
    totalUsd: tokenUsd(claimedGld, gldUsd) + tokenUsd(unclaimedGld, gldUsd),
  };
}

async function fetchBalance(wallet) {
  const raw = await publicClient.readContract({
    address: GLDR,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [wallet],
  });
  return Number(formatUnits(raw, 18));
}

const els = {
  total: document.getElementById("total-gold"),
  form: document.getElementById("wallet-form"),
  wallet: document.getElementById("wallet"),
  error: document.getElementById("wallet-error"),
  balance: document.getElementById("personal-balance"),
  worth: document.getElementById("personal-worth"),
};

let prices = { gldrUsd: 0, gldUsd: 0 };

async function refreshTotals() {
  try {
    prices = await fetchPrices();
    const fees = await fetchGoldRetrieved(prices);
    els.total.textContent = formatUsd(fees.totalUsd);
  } catch {
    els.total.textContent = "$—";
  }
}

async function refreshChart() {
  try {
    const series = await fetchTwelveHourCloses();
    renderChart(series);
  } catch {
    renderChart([]);
  }
}

function showError(message) {
  if (!message) {
    els.error.hidden = true;
    els.error.textContent = "";
    return;
  }
  els.error.hidden = false;
  els.error.textContent = message;
}

async function lookupWallet(raw) {
  const trimmed = raw.trim();
  if (!isAddress(trimmed, { strict: false })) {
    showError("Enter a valid 0x wallet address.");
    els.balance.textContent = "—";
    els.worth.textContent = "$—";
    return;
  }
  showError("");
  const wallet = getAddress(trimmed);
  els.wallet.value = wallet;
  localStorage.setItem("gldr-wallet", wallet);
  try {
    if (!prices.gldrUsd) prices = await fetchPrices();
    const balance = await fetchBalance(wallet);
    els.balance.textContent = formatToken(balance);
    els.worth.textContent = formatUsd(balance * prices.gldrUsd);
  } catch (err) {
    showError(err.message || "Could not read that wallet.");
  }
}

els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  lookupWallet(els.wallet.value);
});

const saved = localStorage.getItem("gldr-wallet");
if (saved) {
  els.wallet.value = saved;
}

refreshTotals().then(() => {
  if (saved) lookupWallet(saved);
});
refreshChart();

setInterval(refreshTotals, 60_000);
setInterval(refreshChart, 60_000);

function nextShimmerDelay() {
  return 4000 + Math.random() * 3000;
}

function startSiteShimmer() {
  const overlay = document.querySelector(".site-shimmer");
  const beam = overlay?.querySelector(".site-shimmer-beam");
  if (!overlay || !beam) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const sweep = () => {
    overlay.classList.remove("is-shining");
    void overlay.offsetWidth;
    overlay.classList.add("is-shining");
  };

  beam.addEventListener("animationend", () => {
    overlay.classList.remove("is-shining");
    setTimeout(sweep, nextShimmerDelay());
  });

  setTimeout(sweep, nextShimmerDelay());
}

startSiteShimmer();
