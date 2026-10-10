// Shared AgentGate analytics store.
// Uses Netlify Blobs in production; a temp JSON file when Blobs is unavailable.

import { connectLambda, getStore } from "@netlify/blobs"
import { readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DEFAULT_BOT_RULES } from "./_bot-defaults.mjs"

const STORE_NAME = "agent-analytics"
const LOCAL_FILE = join(tmpdir(), "dheeraj-agent-analytics.json")
const PRICE_USDC = 0.01
const MAX_UNIQUES = 20_000

function preferLocalFile() {
  return process.env.NETLIFY_DEV === "true"
}

export function useSqlitePrimary() {
  if (process.env.TURSO_DATABASE_URL) return true
  if (process.env.NETLIFY_DEV === "true") return true
  if (process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT) return false
  if (process.env.NETLIFY === "true") return false
  return true
}

async function sqlite() {
  return import("./_db.mjs")
}

export function useBlobs(event) {
  if (preferLocalFile() || !event?.blobs) return
  connectLambda(event)
}

export function isBlogPath(path) {
  return /^\/20\d{2}\/\d{2}\/\d{2}\//.test(path) || path.startsWith("/api/content")
}

export function emptySummary() {
  return {
    totals: {
      requests: 0,
      uniqueVisitors: 0,
      human: 0,
      ai_agent: 0,
      search_bot: 0,
      preview_bot: 0,
      paid_agent: 0,
      unknown: 0,
      blog: 0,
      payments: 0,
      revenueUsdc: 0,
    },
    visitorHashes: {},
    paidTx: {},
    agents: {},
    paths: {},
    blogPaths: {},
    status: {},
    days: {},
    agentProfiles: {},
    updatedAt: null,
  }
}

function bump(map, key, n = 1) {
  if (!key) return
  map[key] = (map[key] || 0) + n
}

function isPaywalledKind(kind) {
  return kind === "ai_agent" || kind === "unknown"
}

export function reputationFromProfiles(profiles, recent = []) {
  const summary = { agentProfiles: { ...(profiles || {}) } }
  for (const event of recent || []) {
    updateAgentProfile(summary, event)
  }
  profiles = summary.agentProfiles
  const good = {}
  const bad = {}
  const paid = {}
  let goodVisitors = 0
  let badVisitors = 0
  let paidVisitors = 0

  for (const p of Object.values(profiles || {})) {
    const name = p.agent || "unknown"
    if (p.paid) {
      paidVisitors += 1
      bump(paid, name)
    } else if (p.saw402 && p.gotContent) {
      badVisitors += 1
      bump(bad, name)
    } else if (p.saw402) {
      goodVisitors += 1
      bump(good, name)
    }
  }

  const toRows = (map) =>
    Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }))

  return {
    goodVisitors,
    badVisitors,
    paidVisitors,
    goodAgents: toRows(good),
    badAgents: toRows(bad),
    paidAgents: toRows(paid),
  }
}

function updateAgentProfile(summary, event) {
  const kind = event.kind || "unknown"
  if (kind === "human" || kind === "search_bot" || kind === "preview_bot") return

  if (!summary.agentProfiles) summary.agentProfiles = {}
  const visitorId = typeof event.visitorId === "string" ? event.visitorId.slice(0, 16) : ""
  const agent = event.agent || "unknown"
  const key = visitorId || `agent:${agent}`
  const path = event.path || "/"
  const status = Number(event.status) || 0
  const gatedPath = isBlogPath(path) || path.startsWith("/feed.xml") || path.startsWith("/api/content")

  const prev = summary.agentProfiles[key] || {
    agent,
    saw402: false,
    gotContent: false,
    paid: false,
    lastTs: event.ts || null,
  }
  prev.agent = agent
  prev.lastTs = event.ts || prev.lastTs
  if (status === 402) prev.saw402 = true
  if (kind === "paid_agent" && status === 200) prev.paid = true
  if (gatedPath && status === 200 && isPaywalledKind(kind)) prev.gotContent = true
  summary.agentProfiles[key] = prev

  const keys = Object.keys(summary.agentProfiles)
  if (keys.length > 4000) {
    keys
      .sort(
        (a, b) =>
          String(summary.agentProfiles[a].lastTs || "").localeCompare(
            String(summary.agentProfiles[b].lastTs || "")
          )
      )
      .slice(0, keys.length - 4000)
      .forEach((k) => delete summary.agentProfiles[k])
  }
}

function pruneMap(map, max = 400) {
  const entries = Object.entries(map)
  if (entries.length <= max) return map
  entries.sort((a, b) => b[1] - a[1])
  return Object.fromEntries(entries.slice(0, max))
}

async function readLocal() {
  try {
    return JSON.parse(await readFile(LOCAL_FILE, "utf8"))
  } catch {
    return {}
  }
}

async function writeLocal(data) {
  await writeFile(LOCAL_FILE, JSON.stringify(data))
}

export async function analyticsGet(key) {
  if (preferLocalFile()) {
    const data = await readLocal()
    return data[key] ?? null
  }
  const store = getStore(STORE_NAME)
  return await store.get(key, { type: "json" })
}

export async function analyticsWrite(patch) {
  if (preferLocalFile()) {
    const data = await readLocal()
    Object.assign(data, patch)
    await writeLocal(data)
    return
  }
  const store = getStore(STORE_NAME)
  await Promise.all(
    Object.entries(patch).map(([key, value]) => store.setJSON(key, value))
  )
}

export async function analyticsSet(key, value) {
  await analyticsWrite({ [key]: value })
}

export async function recordVisit(event) {
  const writeStamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const summary = JSON.parse(
    JSON.stringify((await analyticsGet("summary")) || emptySummary())
  )
  const recent = JSON.parse(JSON.stringify((await analyticsGet("recent")) || []))
  applyVisit(summary, recent, event, writeStamp)
  await analyticsWrite({
    summary,
    // Was 500, which a single busy hour could fill entirely, evicting everything older.
    // 10,000 gives real headroom before the oldest rows start getting pushed out.
    recent: recent.slice(0, 10000),
  })
}

function applyVisit(summary, recent, event, writeStamp) {
  if (!summary.totals) summary.totals = emptySummary().totals
  if (!summary.visitorHashes) summary.visitorHashes = {}
  if (!summary.blogPaths) summary.blogPaths = {}
  if (!summary.paidTx) summary.paidTx = {}
  if (!summary.agents) summary.agents = {}
  if (!summary.paths) summary.paths = {}
  if (!summary.status) summary.status = {}
  if (!summary.days) summary.days = {}
  if (!summary.agentProfiles) summary.agentProfiles = {}

  const kind = event.kind || "unknown"
  const path = event.path || "/"
  const agent = event.agent || "unknown"
  const status = Number(event.status) || 0
  const ts = event.ts || new Date().toISOString()
  const day = ts.slice(0, 10)
  const visitorId = typeof event.visitorId === "string" ? event.visitorId.slice(0, 16) : ""

  summary.totals.requests += 1
  summary.totals[kind] = (summary.totals[kind] || 0) + 1
  bump(summary.agents, agent)
  bump(summary.paths, path)
  if (status) bump(summary.status, String(status))
  if (isBlogPath(path)) {
    summary.totals.blog += 1
    bump(summary.blogPaths, path)
  }

  if (visitorId && !summary.visitorHashes[visitorId]) {
    summary.totals.uniqueVisitors += 1
    if (Object.keys(summary.visitorHashes).length < MAX_UNIQUES) {
      summary.visitorHashes[visitorId] = 1
    }
  }

  updateAgentProfile(summary, { visitorId, agent, kind, status, path, ts })

  if (!summary.days[day]) {
    summary.days[day] = { requests: 0, human: 0, ai_agent: 0 }
  }
  summary.days[day].requests += 1
  summary.days[day][kind] = (summary.days[day][kind] || 0) + 1

  summary.agents = pruneMap(summary.agents)
  summary.paths = pruneMap(summary.paths)
  summary.blogPaths = pruneMap(summary.blogPaths)
  summary.updatedAt = ts
  summary.writeStamp = writeStamp

  const dayKeys = Object.keys(summary.days).sort()
  if (dayKeys.length > 90) {
    for (const old of dayKeys.slice(0, dayKeys.length - 90)) delete summary.days[old]
  }

  const row = { ts, path, kind, agent, status }
  if (visitorId) row.vid = visitorId.slice(0, 8)
  for (const field of ["purpose", "ua", "ref", "robots"]) {
    if (typeof event[field] === "string" && event[field]) row[field] = event[field]
  }
  if (typeof event.lat === "number" && typeof event.lon === "number") {
    row.lat = event.lat
    row.lon = event.lon
    row.country = typeof event.country === "string" ? event.country : ""
    row.countryCode = typeof event.countryCode === "string" ? event.countryCode : ""
    row.city = typeof event.city === "string" ? event.city : ""
  }
  recent.unshift(row)
}

export async function recordPayment({ txHash }) {
  if (!txHash) return
  const summary = (await analyticsGet("summary")) || emptySummary()
  if (!summary.paidTx) summary.paidTx = {}
  if (!summary.totals) summary.totals = emptySummary().totals
  if (summary.paidTx[txHash]) return
  summary.paidTx[txHash] = 1
  summary.totals.payments += 1
  summary.totals.revenueUsdc = Number(
    (summary.totals.payments * PRICE_USDC).toFixed(2)
  )
  summary.updatedAt = new Date().toISOString()
  await analyticsSet("summary", summary)
}

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_BOT_RULES))
}

// Rules added to the defaults after the stored list was saved still show up, with their default setting.
function withNewDefaults(stored) {
  const known = new Set(stored.map((r) => r.id))
  const missing = cloneDefaults().filter((r) => !known.has(r.id))
  return missing.length ? [...stored, ...missing] : stored
}

export async function getBotRulesStore() {
  if (useSqlitePrimary()) {
    try {
      const { getDbBotRules } = await sqlite()
      return await getDbBotRules()
    } catch (err) {
      console.warn("SQLite bot rules fallback:", err)
    }
  }
  const stored = await analyticsGet("bot_rules")
  if (!stored || !Array.isArray(stored) || stored.length === 0) {
    // Do not write defaults here. A stale read used to overwrite a toggle
    // the user had just saved, so the switch jumped back to off on refresh.
    return cloneDefaults()
  }
  const apple = stored.find((r) => r.id === "apple")
  if (apple && apple.allowed === false && !apple.updatedAt) {
    apple.allowed = true
    apple.updatedAt = new Date().toISOString()
    await analyticsSet("bot_rules", stored)
  }
  return withNewDefaults(stored)
}

export async function updateBotRuleStore(id, allowed, charge = false) {
  if (useSqlitePrimary()) {
    try {
      const { updateDbBotRule } = await sqlite()
      return await updateDbBotRule(id, allowed)
    } catch (err) {
      console.warn("SQLite bot rule update fallback:", err)
    }
  }
  const rules = withNewDefaults((await analyticsGet("bot_rules")) || cloneDefaults())
  const idx = rules.findIndex((r) => r.id === id)
  if (idx !== -1) {
    rules[idx].allowed = Boolean(allowed)
    rules[idx].charge = Boolean(charge) && !allowed
    rules[idx].updatedAt = new Date().toISOString()
  } else {
    rules.push({ id, allowed: Boolean(allowed), charge: Boolean(charge) && !allowed, updatedAt: new Date().toISOString() })
  }
  await analyticsSet("bot_rules", rules)
  return rules
}

export async function updateAllBotRulesStore(newRules) {
  if (useSqlitePrimary()) {
    try {
      const { updateAllDbBotRules } = await sqlite()
      return await updateAllDbBotRules(newRules)
    } catch (err) {
      console.warn("SQLite bot rules bulk fallback:", err)
    }
  }
  const rules = withNewDefaults((await analyticsGet("bot_rules")) || cloneDefaults())
  const now = new Date().toISOString()
  for (const item of newRules) {
    const idx = rules.findIndex((r) => r.id === item.id)
    if (idx !== -1) {
      rules[idx].allowed = Boolean(item.allowed)
      rules[idx].charge = Boolean(item.charge) && !item.allowed
      rules[idx].updatedAt = now
    }
  }
  await analyticsSet("bot_rules", rules)
  return rules
}

export { PRICE_USDC }
