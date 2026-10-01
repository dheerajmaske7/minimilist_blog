// SQLite store for AgentGate observability.
// Local: data/analytics.db
// Production: TURSO_DATABASE_URL + TURSO_AUTH_TOKEN (optional)

import { mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { DEFAULT_BOT_RULES } from "./_bot-defaults.mjs"

export { DEFAULT_BOT_RULES }

const PRICE_USDC = 0.01
let client
let ready

function dbUrl() {
  if (process.env.TURSO_DATABASE_URL) return process.env.TURSO_DATABASE_URL
  const file = process.env.ANALYTICS_DB_PATH || join(process.cwd(), "data", "analytics.db")
  mkdirSync(dirname(file), { recursive: true })
  return `file:${file}`
}

export function sqlitePath() {
  if (process.env.TURSO_DATABASE_URL) return "turso"
  return process.env.ANALYTICS_DB_PATH || join(process.cwd(), "data", "analytics.db")
}

async function getDb() {
  if (client) return client
  const url = dbUrl()
  const spec = process.env.TURSO_DATABASE_URL
    ? "@libsql/client/http"
    : "@libsql/client/sqlite3"
  const { createClient } = await import(spec)
  client = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  })
  return client
}

async function init() {
  if (ready) return getDb()
  const db = await getDb()
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts TEXT NOT NULL,
      path TEXT NOT NULL,
      kind TEXT NOT NULL,
      agent TEXT NOT NULL,
      status INTEGER,
      visitor_id TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);
    CREATE INDEX IF NOT EXISTS idx_events_kind ON events(kind);
    CREATE INDEX IF NOT EXISTS idx_events_agent ON events(agent);
    CREATE INDEX IF NOT EXISTS idx_events_path ON events(path);
    CREATE TABLE IF NOT EXISTS payments (
      tx_hash TEXT PRIMARY KEY,
      amount_usdc REAL NOT NULL DEFAULT 0.01,
      ts TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS bot_rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      allowed INTEGER NOT NULL DEFAULT 0,
      patterns TEXT NOT NULL,
      description TEXT,
      capabilities TEXT,
      updated_at TEXT NOT NULL
    );
  `)
  ready = true
  return db
}

export function isBlogPath(path) {
  return /^\/20\d{2}\/\d{2}\/\d{2}\//.test(path) || path.startsWith("/api/content")
}

export async function insertEvent(event) {
  const db = await init()
  const ts = event.ts || new Date().toISOString()
  await db.execute({
    sql: `INSERT INTO events (ts, path, kind, agent, status, visitor_id)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      ts,
      event.path || "/",
      event.kind || "unknown",
      event.agent || "unknown",
      Number(event.status) || 0,
      event.visitorId || "",
    ],
  })
}

export async function insertPayment({ txHash, amountUsdc = PRICE_USDC }) {
  if (!txHash) return
  const db = await init()
  await db.execute({
    sql: `INSERT OR IGNORE INTO payments (tx_hash, amount_usdc, ts) VALUES (?, ?, ?)`,
    args: [txHash, amountUsdc, new Date().toISOString()],
  })
}

function rangeStart(range) {
  const ms =
    range === "week" ? 7 * 24 * 3600 * 1000 : range === "month" ? 30 * 24 * 3600 * 1000 : 24 * 3600 * 1000
  return new Date(Date.now() - ms).toISOString()
}

function bucketExpr(range) {
  if (range === "day") return "substr(ts, 1, 13) || ':00'"
  return "substr(ts, 1, 10)"
}

function rows(result) {
  const cols = result.columns || []
  return (result.rows || []).map((row) => {
    const obj = {}
    cols.forEach((col, i) => {
      obj[col] = Array.isArray(row) ? row[i] : row[col]
    })
    return obj
  })
}

function num(v) {
  return Number(v || 0)
}

export async function queryDashboard(range = "week") {
  const db = await init()
  const since = rangeStart(range)
  const bucket = bucketExpr(range)

  const [kpis, series, agents, pages, events, statusRows, pay] = await Promise.all([
    db.execute({
      sql: `SELECT
              COUNT(*) AS requests,
              COUNT(DISTINCT CASE WHEN visitor_id != '' THEN visitor_id END) AS uniques,
              SUM(CASE WHEN kind = 'human' THEN 1 ELSE 0 END) AS human,
              SUM(CASE WHEN kind IN ('ai_agent', 'paid_agent', 'unknown') THEN 1 ELSE 0 END) AS ai,
              SUM(CASE WHEN kind = 'search_bot' THEN 1 ELSE 0 END) AS search,
              SUM(CASE WHEN kind = 'preview_bot' THEN 1 ELSE 0 END) AS preview,
              SUM(CASE WHEN kind = 'paid_agent' THEN 1 ELSE 0 END) AS paid,
              SUM(CASE WHEN status = 402 THEN 1 ELSE 0 END) AS blocked,
              SUM(CASE WHEN path LIKE '/20%/%/%/%' OR path LIKE '/api/content%' THEN 1 ELSE 0 END) AS blog
            FROM events
            WHERE ts >= ?`,
      args: [since],
    }),
    db.execute({
      sql: `SELECT ${bucket} AS bucket,
              COUNT(*) AS requests,
              SUM(CASE WHEN kind = 'human' THEN 1 ELSE 0 END) AS human,
              SUM(CASE WHEN kind IN ('ai_agent', 'paid_agent', 'unknown') THEN 1 ELSE 0 END) AS ai,
              SUM(CASE WHEN kind = 'paid_agent' THEN 1 ELSE 0 END) AS paid,
              SUM(CASE WHEN status = 402 THEN 1 ELSE 0 END) AS blocked
            FROM events
            WHERE ts >= ?
            GROUP BY bucket
            ORDER BY bucket`,
      args: [since],
    }),
    db.execute({
      sql: `SELECT agent AS name, COUNT(*) AS count
            FROM events WHERE ts >= ?
            GROUP BY agent ORDER BY count DESC LIMIT 20`,
      args: [since],
    }),
    db.execute({
      sql: `SELECT path AS name, COUNT(*) AS count
            FROM events WHERE ts >= ?
            GROUP BY path ORDER BY count DESC LIMIT 20`,
      args: [since],
    }),
    db.execute({
      sql: `SELECT ts, path, kind, agent, status
            FROM events WHERE ts >= ?
            ORDER BY ts DESC, id DESC LIMIT 80`,
      args: [since],
    }),
    db.execute({
      sql: `SELECT CAST(status AS TEXT) AS name, COUNT(*) AS count
            FROM events WHERE ts >= ?
            GROUP BY status ORDER BY count DESC`,
      args: [since],
    }),
    db.execute({
      sql: `SELECT COUNT(*) AS payments, COALESCE(SUM(amount_usdc), 0) AS revenue
            FROM payments WHERE ts >= ?`,
      args: [since],
    }),
  ])

  const k = rows(kpis)[0] || {}
  const seriesRows = rows(series).map((r) => ({
    t: r.bucket,
    requests: num(r.requests),
    human: num(r.human),
    ai: num(r.ai),
    paid: num(r.paid),
    blocked: num(r.blocked),
  }))
  const agentRows = rows(agents).map((r) => ({ name: r.name, count: num(r.count) }))
  const pageRows = rows(pages).map((r) => ({ name: r.name, count: num(r.count) }))
  const eventRows = rows(events).map((r) => ({
    ts: r.ts,
    path: r.path,
    kind: r.kind,
    agent: r.agent,
    status: num(r.status),
  }))
  const payRow = rows(pay)[0] || {}
  const blogPages = pageRows.filter((p) => isBlogPath(p.name))

  return {
    ok: true,
    store: sqlitePath(),
    range,
    since,
    totalRequests: num(k.requests),
    uniqueVisitors: num(k.uniques),
    aiAgentRequests: num(k.ai),
    humanRequests: num(k.human),
    blogRequests: num(k.blog),
    paidRequests: num(k.paid),
    paymentRequired: num(k.blocked),
    payments: num(payRow.payments),
    revenueUsdc: Number(num(payRow.revenue).toFixed(2)),
    topAgent: agentRows.find((a) => a.name !== "browser") || agentRows[0] || null,
    topBlog: blogPages[0] || null,
    topAgents: agentRows,
    topPages: pageRows,
    topBlogs: blogPages,
    series: seriesRows,
    status: rows(statusRows).map((r) => ({ name: r.name, count: num(r.count) })),
    recent: eventRows,
    updatedAt: eventRows[0]?.ts || null,
  }
}

export async function initDbBotRules() {
  const db = await init()
  for (const r of DEFAULT_BOT_RULES) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO bot_rules (id, name, category, allowed, patterns, description, capabilities, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        r.id,
        r.name,
        r.category,
        r.allowed ? 1 : 0,
        r.patterns || "",
        r.description || "",
        r.capabilities || "",
        new Date().toISOString(),
      ],
    })
  }
}

export async function getDbBotRules() {
  const db = await init()
  await initDbBotRules()
  const res = await db.execute("SELECT * FROM bot_rules ORDER BY category, name")
  const ruleRows = rows(res)
  if (ruleRows.length === 0) {
    return DEFAULT_BOT_RULES
  }
  return ruleRows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    description: r.description,
    capabilities: r.capabilities,
    patterns: r.patterns,
    allowed: Boolean(r.allowed),
    updatedAt: r.updated_at,
  }))
}

export async function updateDbBotRule(id, allowed) {
  const db = await init()
  await initDbBotRules()
  await db.execute({
    sql: `UPDATE bot_rules SET allowed = ?, updated_at = ? WHERE id = ?`,
    args: [allowed ? 1 : 0, new Date().toISOString(), id],
  })
  return getDbBotRules()
}

export async function updateAllDbBotRules(rules) {
  const db = await init()
  await initDbBotRules()
  const now = new Date().toISOString()
  for (const r of rules) {
    if (r.id !== undefined) {
      await db.execute({
        sql: `UPDATE bot_rules SET allowed = ?, updated_at = ? WHERE id = ?`,
        args: [r.allowed ? 1 : 0, now, r.id],
      })
    }
  }
  return getDbBotRules()
}

export { PRICE_USDC }
