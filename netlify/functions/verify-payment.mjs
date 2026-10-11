// POST /api/verify-payment
// Body: { "txHash": "0x..." } or { "txHash": "https://basescan.org/tx/0x..." }
// Verifies a Monad testnet USDC transfer of at least 0.01 USDC to the site wallet.
// On success, returns an accessToken for gated post/content access.

import { mintAccessToken, TOKEN_TTL_SECONDS } from "./token-lib.mjs"

// No hardcoded fallback on purpose: a previous address was exposed, this must be set explicitly.
function payTo() {
  const addr = process.env.PAY_TO_ADDRESS || "0xC90AC2b557088c50264de70969D71419311636c1"
  return addr.toLowerCase()
}
const PAY_TO = payTo()
const USDC = "0x534b2f3A21130d7a60830c2Df862319e593943A3".toLowerCase()
const MIN_AMOUNT_RAW = 10_000n // 0.01 USDC (6 decimals)
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
const EXPLORER = "https://testnet.monadvision.com"
const RPC_URLS = [
  process.env.MONAD_RPC_URL,
  "https://testnet-rpc.monad.xyz",
].filter(Boolean)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(body),
  }
}

function normalizeTxHash(input) {
  if (!input || typeof input !== "string") return null
  const trimmed = input.trim()
  const fromUrl = trimmed.match(/\/tx\/(0x[a-fA-F0-9]{64})/)
  const hash = fromUrl ? fromUrl[1] : trimmed
  if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) return null
  return hash.toLowerCase()
}

function topicAddress(topic) {
  if (!topic || topic.length < 42) return null
  return `0x${topic.slice(-40)}`.toLowerCase()
}

function formatUsdc(raw) {
  const whole = raw / 1_000_000n
  const frac = (raw % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "")
  return frac ? `${whole}.${frac}` : whole.toString()
}

async function rpc(method, params) {
  let lastError
  for (const url of RPC_URLS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method,
          params,
        }),
      })
      if (!res.ok) {
        lastError = new Error(`RPC HTTP ${res.status} from ${url}`)
        continue
      }
      const data = await res.json()
      if (data.error) {
        lastError = new Error(data.error.message || "RPC error")
        continue
      }
      return data.result
    } catch (err) {
      lastError = err
    }
  }
  throw lastError || new Error("Monad RPC failed")
}

function findQualifyingTransfer(receipt) {
  if (!receipt || !Array.isArray(receipt.logs)) return null

  for (const log of receipt.logs) {
    if ((log.address || "").toLowerCase() !== USDC) continue
    if (!log.topics || log.topics[0]?.toLowerCase() !== TRANSFER_TOPIC) continue

    const to = topicAddress(log.topics[2])
    if (to !== PAY_TO) continue

    const amount = BigInt(log.data || "0x0")
    if (amount < MIN_AMOUNT_RAW) continue

    return {
      from: topicAddress(log.topics[1]),
      to,
      amountRaw: amount.toString(),
      amountUsdc: formatUsdc(amount),
      logIndex: log.logIndex,
    }
  }
  return null
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" }
  }

  if (event.httpMethod !== "POST") {
    return json(405, {
      ok: false,
      error: "Method not allowed. Use POST with JSON body { \"txHash\": \"0x...\" }.",
    })
  }

  let body
  try {
    body = JSON.parse(event.body || "{}")
  } catch {
    return json(400, { ok: false, error: "Invalid JSON body." })
  }

  const txHash = normalizeTxHash(body.txHash || body.hash || body.tx)
  if (!txHash) {
    return json(400, {
      ok: false,
      error:
        "Provide a valid Monad transaction hash or MonadVision URL in txHash (0x + 64 hex chars).",
    })
  }

  try {
    const receipt = await rpc("eth_getTransactionReceipt", [txHash])
    if (!receipt) {
      return json(404, {
        ok: false,
        txHash,
        error: "Transaction not found on Monad yet. Wait for confirmation and retry.",
      })
    }

    if (receipt.status !== "0x1") {
      return json(400, {
        ok: false,
        txHash,
        error: "Transaction failed on-chain (status != success).",
        explorer: `${EXPLORER}/tx/${txHash}`,
      })
    }

    const transfer = findQualifyingTransfer(receipt)
    if (!transfer) {
      return json(400, {
        ok: false,
        txHash,
        error:
          "No successful USDC transfer of at least 0.01 USDC to the site wallet found in this transaction.",
        expected: {
          network: "Monad",
          token: "USDC",
          tokenContract: USDC,
          payTo: PAY_TO,
          minAmountUsdc: "0.01",
        },
        explorer: `${EXPLORER}/tx/${txHash}`,
      })
    }

    const { accessToken, expiresAt } = mintAccessToken({
      txHash,
      from: transfer.from,
    })

    try {
      const { recordPayment, useBlobs } = await import("./_analytics-store.mjs")
      useBlobs(event)
      await recordPayment({ txHash })
    } catch {
      // Payment still succeeds if analytics write fails.
    }

    return json(200, {
      ok: true,
      txHash,
      network: "Monad",
      token: "USDC",
      ...transfer,
      payTo: PAY_TO,
      minAmountUsdc: "0.01",
      explorer: `${EXPLORER}/tx/${txHash}`,
      accessToken,
      expiresAt,
      expiresInSeconds: TOKEN_TTL_SECONDS,
      usage: {
        header: "Authorization: Bearer <accessToken>",
        contentApi: "GET /api/content?path=/YYYY/MM/DD/post-slug.html",
        htmlQuery: "GET /YYYY/MM/DD/post.html?access_token=<accessToken>",
      },
      message:
        "Payment verified. Use accessToken to fetch posts/content. See /llms.txt.",
    })
  } catch (err) {
    return json(502, {
      ok: false,
      txHash,
      error: err.message || "Failed to query Monad RPC.",
    })
  }
}
