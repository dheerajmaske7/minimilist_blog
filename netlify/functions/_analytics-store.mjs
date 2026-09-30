// Shared AgentGate analytics store.
// Uses Netlify Blobs in production; a temp JSON file when Blobs is unavailable.

import { connectLambda, getStore } from "@netlify/blobs"
import { readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

const STORE_NAME = "agent-analytics"
const LOCAL_FILE = join(tmpdir(), "dheeraj-agent-analytics.json")
const PRICE_USDC = 0.01
const MAX_UNIQUES = 20_000

function preferLocalFile() {
  return process.env.NETLIFY_DEV === "true"
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
    updatedAt: null,
  }
}

function bump(map, key, n = 1) {
  if (!key) return
  map[key] = (map[key] || 0) + n
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
    recent: recent.slice(0, 40),
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

  recent.unshift({ ts, path, kind, agent, status })
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

export { PRICE_USDC }
