/**
 * Gate blog posts for AI/agent scrapers.
 * - Humans: tiny JS proof-of-work sets an HttpOnly cookie, then the post loads
 * - Google/Bing and link-preview bots: allowed
 * - Paid agents: Authorization Bearer token or ?access_token=
 * - Header-only "browser-shaped" fetchers (Cursor WebFetch, curl -A Chrome): HTTP 402
 */
import type { Config, Context } from "https://edge.netlify.com"

const PAY_TO = "0x8873cD8D93D6FDee9d21F699723C90eeC783747e"
const DEFAULT_SECRET = "dheeraj-work-netlify-ai-access-hmac-v1"
const COOKIE = "dw_reader"
const POW_ZEROS = "000"
const CHALLENGE_TTL_MS = 5 * 60 * 1000
const COOKIE_TTL_SEC = 7 * 24 * 60 * 60

const OPEN_PREFIXES = [
  "/llms.txt",
  "/sitemap.xml",
  "/api/",
  "/about",
  "/talks",
  "/projects",
  "/assets/",
  "/css/",
  "/images/",
]

interface BotRule {
  id: string
  name: string
  category: string
  allowed: boolean
  patterns: string
  description?: string
  capabilities?: string
}

const DEFAULT_BOT_RULES: BotRule[] = [
  {
    id: "anthropic",
    name: "Anthropic (Claude)",
    category: "AI Assistant",
    allowed: false,
    patterns: "claudebot,anthropic-ai,claude-web,claude",
    description: "Claude web search, interactive chat browsing, and Anthropic LLM training scrapers.",
    capabilities: "Search, Web Browsing, Model Training",
  },
  {
    id: "openai",
    name: "OpenAI (ChatGPT & SearchGPT)",
    category: "AI Assistant",
    allowed: false,
    patterns: "gptbot,chatgpt-user,oai-searchbot,chatgpt,openai",
    description: "ChatGPT web browsing, SearchGPT indexing, and OpenAI model training.",
    capabilities: "Search, Web Browsing, Model Training",
  },
  {
    id: "google_search",
    name: "Google Search (Googlebot)",
    category: "Search Engine",
    allowed: true,
    patterns: "googlebot,google-inspectiontool",
    description: "Standard Google search engine crawler (also used by Gemini Search tool).",
    capabilities: "Search Indexing, Snippets",
  },
  {
    id: "google_ai",
    name: "Google AI / Gemini Training (Google-Extended)",
    category: "AI Training",
    allowed: false,
    patterns: "google-extended",
    description: "Google's dedicated crawler for training Gemini, Vertex AI, and Google AI products.",
    capabilities: "Model Training",
  },
  {
    id: "perplexity",
    name: "Perplexity AI",
    category: "AI Search",
    allowed: false,
    patterns: "perplexitybot,perplexity",
    description: "Perplexity conversational search crawler and citation generator.",
    capabilities: "Search, Answer Synthesis",
  },
  {
    id: "cohere",
    name: "Cohere AI",
    category: "AI Training",
    allowed: false,
    patterns: "cohere-ai,cohere",
    description: "Cohere foundation model training and enterprise search agents.",
    capabilities: "Enterprise Search, Model Training",
  },
  {
    id: "apple",
    name: "Apple (Applebot & Apple Intelligence)",
    category: "AI Assistant",
    allowed: false,
    patterns: "applebot-extended,applebot",
    description: "Applebot-Extended trains Apple Intelligence models; Applebot indexes Siri/Spotlight.",
    capabilities: "Search, Model Training",
  },
  {
    id: "meta",
    name: "Meta AI (LLaMA)",
    category: "AI Training",
    allowed: false,
    patterns: "meta-externalagent,facebookbot",
    description: "Meta's crawler for training LLaMA models and powering Meta AI search.",
    capabilities: "Model Training, Chat Search",
  },
  {
    id: "bytedance",
    name: "ByteDance (Bytespider)",
    category: "AI Training",
    allowed: false,
    patterns: "bytespider",
    description: "TikTok and ByteDance automated web scrapers for LLM data collection.",
    capabilities: "Model Training",
  },
  {
    id: "aggregators",
    name: "Aggregators (Common Crawl / Diffbot / CCBot)",
    category: "Data Aggregators",
    allowed: false,
    patterns: "ccbot,diffbot,amazonbot,youbot",
    description: "Bulk web crawlers supplying training datasets to dozens of commercial AI labs.",
    capabilities: "Bulk Web Crawling, Training Datasets",
  },
  {
    id: "bing",
    name: "Bing Search (Bingbot)",
    category: "Search Engine",
    allowed: true,
    patterns: "bingbot",
    description: "Microsoft Bing search crawler (also feeds Copilot search).",
    capabilities: "Search Indexing, Copilot Search",
  },
  {
    id: "feed_protection",
    name: "Feed Protection (/feed.xml)",
    category: "RSS Protection",
    allowed: true,
    patterns: "",
    description: "Gate /feed.xml so blocked AI crawlers cannot extract full post bodies from the RSS feed without paying.",
    capabilities: "Full Content Protection",
  },
]

let cachedRules: BotRule[] | null = null
let rulesFetchedAt = 0
const RULES_CACHE_TTL_MS = 15_000 // 15 seconds

async function getLiveRules(origin: string): Promise<BotRule[]> {
  const now = Date.now()
  if (cachedRules && now - rulesFetchedAt < RULES_CACHE_TTL_MS) {
    return cachedRules
  }
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 1500)
    const authPass = Deno.env.get("ANALYTICS_PASSWORD") || Deno.env.get("ADMIN_PASSWORD") || "1432"
    const secret = Deno.env.get("ACCESS_TOKEN_SECRET") || DEFAULT_SECRET
    const res = await fetch(`${origin}/api/bot-rules?auth=${encodeURIComponent(authPass)}`, {
      signal: controller.signal,
      headers: {
        "Cache-Control": "no-cache",
        "X-Admin-Key": authPass,
        "X-Internal-Secret": secret,
      },
    })
    clearTimeout(timer)
    if (res.ok) {
      const data = await res.json()
      if (data && Array.isArray(data.rules) && data.rules.length > 0) {
        cachedRules = data.rules
        rulesFetchedAt = now
        return cachedRules
      }
    }
  } catch (_e) {
    // Fallback on error/timeout
  }
  return cachedRules || DEFAULT_BOT_RULES
}

function matchBotRule(ua: string, rules: BotRule[]): BotRule | null {
  const lowerUa = ua.toLowerCase()
  for (const rule of rules) {
    if (!rule.patterns) continue
    const pats = rule.patterns
      .split(",")
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean)
    for (const pat of pats) {
      if (lowerUa.includes(pat)) {
        return rule
      }
    }
  }
  return null
}

function buildRobotsTxt(rules: BotRule[]): string {
  const allowedLines: string[] = []
  const blockedLines: string[] = []

  for (const r of rules) {
    if (!r.patterns) continue
    const pats = r.patterns.split(",").map((p) => p.trim()).filter(Boolean)
    for (const p of pats) {
      const uaName = p.charAt(0).toUpperCase() + p.slice(1)
      if (r.allowed) {
        allowedLines.push(`User-agent: ${uaName}\nAllow: /`)
      } else {
        blockedLines.push(`User-agent: ${uaName}\nDisallow: /`)
      }
    }
  }

  return `# https://dheeraj-work.netlify.app/robots.txt
# AgentGate Dynamic Access Rules (Configured in /analytics/)
# AI terms + pay-to-access for agents: https://dheeraj-work.netlify.app/llms.txt
# Note: automated scrapers receive HTTP 402 on post URLs without an access token.

User-agent: *
Allow: /

# Allowed Search & AI Crawlers (dynamically enabled):
${allowedLines.join("\n\n")}

# Gated / Blocked AI Crawlers (dynamically disabled):
${blockedLines.join("\n\n")}

Sitemap: https://dheeraj-work.netlify.app/sitemap.xml
`
}

function b64urlToBytes(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4)
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/")
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function bytesToB64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ""
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

async function hmacSign(body: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  return bytesToB64url(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body))
  )
}

async function hmacValid(body: string, sig: string, secret: string) {
  return (await hmacSign(body, secret)) === sig
}

async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text)
  )
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

async function tokenOk(token: string | null, secret: string) {
  if (!token || !token.includes(".")) return false
  const [body, sig] = token.split(".")
  if (!(await hmacValid(body, sig, secret))) return false
  try {
    const json = JSON.parse(new TextDecoder().decode(b64urlToBytes(body)))
    return typeof json.exp === "number" && json.exp >= Math.floor(Date.now() / 1000)
  } catch {
    return false
  }
}

function cookieValue(req: Request, name: string) {
  const raw = req.headers.get("cookie") || ""
  for (const part of raw.split(";")) {
    const [k, ...rest] = part.trim().split("=")
    if (k === name) return decodeURIComponent(rest.join("="))
  }
  return null
}

async function readerCookieOk(req: Request, secret: string) {
  const token = cookieValue(req, COOKIE)
  if (!token || !token.includes(".")) return false
  const [body, sig] = token.split(".")
  if (!(await hmacValid(body, sig, secret))) return false
  const exp = Number(body)
  return Number.isFinite(exp) && exp >= Math.floor(Date.now() / 1000)
}

async function mintReaderCookie(secret: string) {
  const exp = Math.floor(Date.now() / 1000) + COOKIE_TTL_SEC
  const body = String(exp)
  const sig = await hmacSign(body, secret)
  return `${body}.${sig}`
}

function clientIp(req: Request, context: Context) {
  return (
    context.ip ||
    req.headers.get("x-nf-client-connection-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "0"
  )
}

async function issueChallenge(secret: string, ip: string) {
  const exp = Date.now() + CHALLENGE_TTL_MS
  const salt = bytesToB64url(crypto.getRandomValues(new Uint8Array(16)))
  const ipHash = (await sha256Hex(ip)).slice(0, 16)
  const body = `${exp}.${salt}.${ipHash}`
  const sig = await hmacSign(body, secret)
  return `${body}.${sig}`
}

async function challengeOk(
  challenge: string,
  nonce: number,
  secret: string,
  ip: string
) {
  const parts = challenge.split(".")
  if (parts.length !== 4) return false
  const [exp, salt, ipHash, sig] = parts
  const body = `${exp}.${salt}.${ipHash}`
  if (!(await hmacValid(body, sig, secret))) return false
  if (Number(exp) < Date.now()) return false
  const expectedIp = (await sha256Hex(ip)).slice(0, 16)
  if (ipHash !== expectedIp) return false
  if (!Number.isInteger(nonce) || nonce < 0 || nonce > 5_000_000) return false
  const digest = await sha256Hex(`${challenge}:${nonce}`)
  return digest.startsWith(POW_ZEROS)
}

function isPostPath(pathname: string) {
  return /^\/20\d{2}\/\d{2}\/\d{2}\//.test(pathname)
}

function isOpenPath(pathname: string) {
  if (pathname === "/" || pathname === "/index.html") return true
  return OPEN_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p) || pathname.startsWith(p + "/")
  )
}

function isSearchBot(ua: string) {
  return /googlebot|bingbot|google-inspectiontool|duckduckbot|applebot(?!-extended)/i.test(
    ua
  )
}

function isPreviewBot(ua: string) {
  return /twitterbot|slackbot|facebookexternalhit|linkedinbot|discordbot|whatsapp|telegrambot|pinterest|redditbot|iframely|embedly/i.test(
    ua
  )
}

const AI_AGENTS: [RegExp, string][] = [
  [/gptbot/i, "GPTBot"],
  [/chatgpt-user/i, "ChatGPT-User"],
  [/google-extended/i, "Google-Extended"],
  [/anthropic-ai/i, "Anthropic-AI"],
  [/claude-web/i, "Claude-Web"],
  [/claude-user/i, "Claude-Web"],
  [/claudebot/i, "ClaudeBot"],
  [/claude/i, "ClaudeBot"],
  [/ccbot/i, "CCBot"],
  [/perplexitybot/i, "PerplexityBot"],
  [/cohere-ai/i, "Cohere-ai"],
  [/applebot-extended/i, "Applebot-Extended"],
  [/oai-searchbot/i, "OAI-SearchBot"],
  [/chatgpt/i, "ChatGPT"],
  [/openai/i, "OpenAI"],
  [/cursor\//i, "Cursor"],
  [/headlesschrome/i, "HeadlessChrome"],
  [/anthropic/i, "Anthropic-AI"],
  [/perplexity/i, "PerplexityBot"],
  [/bytespider/i, "Bytespider"],
  [/amazonbot/i, "Amazonbot"],
  [/meta-externalagent/i, "Meta-ExternalAgent"],
  [/cohere/i, "Cohere"],
  [/youbot/i, "YouBot"],
  [/diffbot/i, "Diffbot"],
]

function namedClient(ua: string): string | null {
  for (const [re, name] of AI_AGENTS) {
    if (re.test(ua)) return name
  }
  if (/googlebot/i.test(ua)) return "Googlebot"
  if (/bingbot/i.test(ua)) return "Bingbot"
  if (/duckduckbot/i.test(ua)) return "DuckDuckBot"
  if (/applebot/i.test(ua)) return "Applebot"
  if (/twitterbot/i.test(ua)) return "Twitterbot"
  if (/slackbot/i.test(ua)) return "Slackbot"
  if (/facebookexternalhit/i.test(ua)) return "Facebook"
  if (/linkedinbot/i.test(ua)) return "LinkedInBot"
  if (/discordbot/i.test(ua)) return "Discordbot"
  if (/curl\//i.test(ua)) return "curl"
  if (/wget\//i.test(ua)) return "wget"
  if (/python-requests|httpx|aiohttp/i.test(ua)) return "python"
  if (/go-http-client/i.test(ua)) return "go"
  if (/axios|node-fetch|undici/i.test(ua)) return "node"
  return null
}

function looksBrowser(ua: string) {
  return (
    /mozilla/i.test(ua) &&
    /chrome|safari|firefox|edg|crios|fxios|opr\//i.test(ua)
  )
}

function shouldTrack(pathname: string) {
  if (
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/css/") ||
    pathname.startsWith("/images/")
  ) {
    return false
  }
  if (
    pathname === "/api/track" ||
    pathname === "/api/analytics" ||
    pathname === "/api/reader-unlock" ||
    pathname === "/api/bot-rules" ||
    pathname === "/analytics" ||
    pathname === "/analytics/"
  ) {
    return false
  }
  if (/\.(png|jpe?g|gif|svg|webp|ico|woff2?|css|js|map)$/i.test(pathname)) {
    return false
  }
  return true
}

function aiAgentName(ua: string): string | null {
  for (const [re, name] of AI_AGENTS) {
    if (re.test(ua)) return name
  }
  return null
}

function classifyVisit(opts: {
  ua: string
  paid: boolean
  humanCookie: boolean
  secFetchMode: string
  secFetchDest: string
}): { kind: string; agent: string } {
  const { ua, paid, humanCookie: _humanCookie, secFetchMode, secFetchDest } = opts
  void _humanCookie
  const named = namedClient(ua)
  const ai = aiAgentName(ua)
  if (paid) return { kind: "paid_agent", agent: ai || named || "paid" }
  if (ai) return { kind: "ai_agent", agent: ai }
  if (isSearchBot(ua)) return { kind: "search_bot", agent: named || "search" }
  if (isPreviewBot(ua)) return { kind: "preview_bot", agent: named || "preview" }
  const realBrowser =
    looksBrowser(ua) &&
    (secFetchMode === "navigate" || secFetchDest === "document")
  if (realBrowser) return { kind: "human", agent: "browser" }
  if (looksBrowser(ua)) {
    return { kind: "ai_agent", agent: named || "automated-browser" }
  }
  if (named) return { kind: "ai_agent", agent: named }
  return { kind: "unknown", agent: "unknown" }
}

function requestGeo(context: Context) {
  const geo = (
    context as Context & {
      geo?: {
        city?: string
        country?: { code?: string; name?: string }
        latitude?: number
        longitude?: number
      }
    }
  ).geo
  if (!geo) return {}
  const lat = Number(geo.latitude)
  const lon = Number(geo.longitude)
  const ok =
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  return {
    country: geo.country?.name || "",
    countryCode: geo.country?.code || "",
    city: geo.city || "",
    lat: ok ? Math.round(lat * 10) / 10 : null,
    lon: ok ? Math.round(lon * 10) / 10 : null,
  }
}

function scheduleTrack(
  req: Request,
  context: Context,
  secret: string,
  meta: { kind: string; agent: string; status: number; path: string }
) {
  if (!shouldTrack(meta.path)) return
  const trackUrl = new URL("/api/track", req.url).toString()
  const job = (async () => {
    const visitorId = (await sha256Hex(clientIp(req, context))).slice(0, 16)
    await fetch(trackUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Track-Key": secret,
      },
      body: JSON.stringify({
        ts: new Date().toISOString(),
        path: meta.path,
        kind: meta.kind,
        agent: meta.agent,
        status: meta.status,
        visitorId,
        ...requestGeo(context),
      }),
    })
  })().catch(() => {})
  const waitUntil = (
    context as Context & { waitUntil?: (p: Promise<unknown>) => void }
  ).waitUntil
  const edgeWait = (
    globalThis as typeof globalThis & {
      EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void }
    }
  ).EdgeRuntime?.waitUntil
  const wait = typeof waitUntil === "function" ? waitUntil : edgeWait
  if (typeof wait === "function") wait(job)
}

function paymentBody() {
  return {
    ok: false,
    paymentRequired: true,
    status: 402,
    message:
      "AI/agent access to post HTML requires a verified 0.01 USDC payment on Base.",
    terms: "https://dheeraj-work.netlify.app/llms.txt",
    pay: {
      amount: "0.01 USDC",
      network: "Base",
      payTo: PAY_TO,
      token: "USDC",
    },
    next: [
      "1. Send 0.01 USDC on Base to the payTo address",
      "2. POST /api/verify-payment with { \"txHash\": \"0x...\" }",
      "3. Retry this URL with Authorization: Bearer <accessToken>",
      "   or ?access_token=<accessToken>",
      "4. Or GET /api/content?path=<this-path> with the Bearer token",
    ],
  }
}

function json402() {
  return new Response(JSON.stringify(paymentBody(), null, 2), {
    status: 402,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  })
}

function challengePage(challenge: string) {
  const bodyObj = paymentBody()
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>402 Payment Required</title>
  <meta name="robots" content="noindex"/>
  <style>
    body{font-family:system-ui,sans-serif;max-width:42rem;margin:3rem auto;padding:0 1rem;line-height:1.5}
    code,pre{background:#f4f4f4;padding:.15rem .35rem;border-radius:4px}
    pre{padding:1rem;overflow:auto}
  </style>
</head>
<body>
  <p id="human-status">Loading…</p>
  <noscript>
    <h1>402 — Payment required for agent access</h1>
    <p>This browser did not run JavaScript, so it is treated as an automated client.</p>
    <p>Humans: enable JavaScript and reload. Agents: pay <strong>0.01 USDC on Base</strong> first.</p>
    <ol>
      <li>Read <a href="/llms.txt">/llms.txt</a></li>
      <li>Pay <code>0.01 USDC</code> on Base to <code>${PAY_TO}</code></li>
      <li><code>POST /api/verify-payment</code> with your tx hash</li>
      <li>Retry with <code>Authorization: Bearer &lt;accessToken&gt;</code></li>
    </ol>
    <pre>${JSON.stringify(bodyObj, null, 2)}</pre>
  </noscript>
  <script>
    (async () => {
      const challenge = ${JSON.stringify(challenge)};
      const zeros = ${JSON.stringify(POW_ZEROS)};
      const enc = new TextEncoder();
      const sha256hex = async (s) => {
        const buf = await crypto.subtle.digest("SHA-256", enc.encode(s));
        return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
      };
      let nonce = 0;
      while (true) {
        const digest = await sha256hex(challenge + ":" + nonce);
        if (digest.startsWith(zeros)) break;
        nonce++;
        if (nonce > 5000000) throw new Error("proof of work failed");
      }
      const res = await fetch("/api/reader-unlock", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge, nonce }),
      });
      if (!res.ok) throw new Error("unlock failed");
      location.reload();
    })().catch((err) => {
      const el = document.getElementById("human-status");
      el.innerHTML = "<h1>402 — Payment required for agent access</h1>"
        + "<p>Could not verify this browser. Agents should pay via <a href=\\"/llms.txt\\">/llms.txt</a>.</p>"
        + "<pre>" + String(err).replace(/</g, "") + "</pre>";
    });
  </script>
</body>
</html>`
  return new Response(html, {
    status: 402,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  })
}

async function handleUnlock(req: Request, context: Context, secret: string) {
  if (req.method === "OPTIONS") {
    return new Response("", {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": new URL(req.url).origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Credentials": "true",
      },
    })
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "POST required" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    })
  }

  const origin = req.headers.get("origin") || ""
  const expectedOrigin = new URL(req.url).origin
  if (origin && origin !== expectedOrigin) {
    return new Response(JSON.stringify({ ok: false, error: "Bad origin" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    })
  }

  let body: { challenge?: string; nonce?: number }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const ip = clientIp(req, context)
  const nonce = Number(body.nonce)
  if (
    !body.challenge ||
    !(await challengeOk(body.challenge, nonce, secret, ip))
  ) {
    return new Response(
      JSON.stringify({ ok: false, error: "Invalid or expired challenge" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    )
  }

  const cookie = await mintReaderCookie(secret)
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Set-Cookie": `${COOKIE}=${cookie}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${COOKIE_TTL_SEC}`,
    },
  })
}

export default async (req: Request, context: Context) => {
  const url = new URL(req.url)
  const pathname = url.pathname
  const secret = Deno.env.get("ACCESS_TOKEN_SECRET") || DEFAULT_SECRET

  if (pathname === "/api/reader-unlock") {
    return handleUnlock(req, context, secret)
  }

  const bypass = req.headers.get("x-ai-access-bypass")
  if (bypass && bypass === secret) {
    return context.next()
  }

  const ua = req.headers.get("user-agent") || ""
  const auth = req.headers.get("authorization") || ""
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || null
  const queryToken = url.searchParams.get("access_token") || url.searchParams.get("token")
  const token = bearer || queryToken
  const paid = await tokenOk(token, secret)
  const humanCookie = await readerCookieOk(req, secret)

  const secFetchMode = req.headers.get("sec-fetch-mode") || ""
  const secFetchDest = req.headers.get("sec-fetch-dest") || ""

  const allow = () => {
    const { kind, agent } = classifyVisit({
      ua,
      paid,
      humanCookie,
      secFetchMode,
      secFetchDest,
    })
    scheduleTrack(req, context, secret, {
      kind,
      agent,
      status: 200,
      path: pathname,
    })
    return context.next()
  }

  // 1. Dynamic robots.txt based on live dashboard rules
  if (pathname === "/robots.txt") {
    const rules = await getLiveRules(url.origin)
    return new Response(buildRobotsTxt(rules), {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=UTF-8",
        "Cache-Control": "public, max-age=15, must-revalidate",
      },
    })
  }

  // 2. Feed protection (/feed.xml)
  if (pathname === "/feed.xml") {
    const rules = await getLiveRules(url.origin)
    const feedRule = rules.find((r) => r.id === "feed_protection")
    const feedProtected = feedRule ? feedRule.allowed : true

    if (feedProtected) {
      const matched = matchBotRule(ua, rules)
      if (matched && !matched.allowed && !paid && !humanCookie) {
        scheduleTrack(req, context, secret, {
          kind: "ai_agent",
          agent: matched.name,
          status: 402,
          path: pathname,
        })
        return json402()
      }
    }
    return allow()
  }

  // 3. Open static paths and API endpoints
  if (isOpenPath(pathname)) {
    return allow()
  }

  // 4. Non-post paths
  if (!isPostPath(pathname)) {
    return allow()
  }

  // 5. Post path (/20xx/...) - Dynamic Rule Evaluation
  const rules = await getLiveRules(url.origin)
  const matchedRule = matchBotRule(ua, rules)

  if (matchedRule) {
    if (matchedRule.allowed) {
      // Allowed via dashboard switch
      scheduleTrack(req, context, secret, {
        kind: matchedRule.category === "Search Engine" ? "search_bot" : "ai_agent",
        agent: matchedRule.name,
        status: 200,
        path: pathname,
      })
      return context.next()
    } else {
      // Gated via dashboard switch
      if (paid || humanCookie) {
        return allow()
      }
      const wantsHtml = (req.headers.get("accept") || "").includes("text/html")
      scheduleTrack(req, context, secret, {
        kind: "ai_agent",
        agent: matchedRule.name,
        status: 402,
        path: pathname,
      })
      if (wantsHtml && looksBrowser(ua)) {
        const challenge = await issueChallenge(secret, clientIp(req, context))
        return challengePage(challenge)
      }
      return json402()
    }
  }

  // 6. If no specific bot rule matched:
  if (paid || isPreviewBot(ua) || humanCookie) {
    return allow()
  }

  if (isSearchBot(ua)) {
    return allow()
  }

  const wantsHtml = (req.headers.get("accept") || "").includes("text/html")
  if (wantsHtml && looksBrowser(ua)) {
    const ai = aiAgentName(ua)
    const classified = classifyVisit({
      ua,
      paid: false,
      humanCookie: false,
      secFetchMode,
      secFetchDest,
    })
    scheduleTrack(req, context, secret, {
      kind: ai ? "ai_agent" : "unknown",
      agent: ai || classified.agent || "payment-required",
      status: 402,
      path: pathname,
    })
    const challenge = await issueChallenge(secret, clientIp(req, context))
    return challengePage(challenge)
  }

  const { kind, agent } = classifyVisit({
    ua,
    paid: false,
    humanCookie: false,
    secFetchMode,
    secFetchDest,
  })
  scheduleTrack(req, context, secret, {
    kind: kind === "human" ? "unknown" : kind,
    status: 402,
    agent,
    path: pathname,
  })
  return json402()
}

export const config: Config = {
  path: "/*",
}
