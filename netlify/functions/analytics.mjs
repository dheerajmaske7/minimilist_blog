// GET /api/analytics?range=day|week|month

import {
  analyticsGet,
  emptySummary,
  useBlobs,
  useSqlitePrimary,
} from "./_analytics-store.mjs"
import { queryDashboard } from "./_db.mjs"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(body),
  }
}

function top(map, n = 10) {
  return Object.entries(map || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, count]) => ({ name, count }))
}

function parseRange(event) {
  const raw = event.queryStringParameters?.range || "week"
  if (raw === "day" || raw === "week" || raw === "month") return raw
  return "week"
}

export async function handler(event) {
  useBlobs(event)
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" }
  }
  if (event.httpMethod !== "GET") {
    return json(405, { ok: false, error: "GET required" })
  }

  const range = parseRange(event)

  try {
    if (useSqlitePrimary()) {
      return json(200, await queryDashboard(range))
    }
  } catch (err) {
    // fall through to blobs
    if (useSqlitePrimary()) {
      return json(500, { ok: false, error: err.message || "SQLite query failed" })
    }
  }

  try {
    const summary = (await analyticsGet("summary")) || emptySummary()
    const recent = (await analyticsGet("recent")) || []
    const t = { ...emptySummary().totals, ...(summary.totals || {}) }
    const topAgents = top(summary.agents, 40)
    const topBlogs = top(summary.blogPaths)
    const topPages = top(summary.paths)
    const topAgent =
      topAgents.find((row) => row.name !== "browser") || topAgents[0] || null
    const days = Object.entries(summary.days || {})
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([t, row]) => ({
        t,
        requests: row.requests || 0,
        human: row.human || 0,
        ai: (row.ai_agent || 0) + (row.paid_agent || 0) + (row.unknown || 0),
        paid: row.paid_agent || 0,
        blocked: 0,
      }))

    return json(200, {
      ok: true,
      store: "blobs",
      range,
      totalRequests: t.requests,
      uniqueVisitors: t.uniqueVisitors,
      aiAgentRequests: (t.ai_agent || 0) + (t.paid_agent || 0) + (t.unknown || 0),
      humanRequests: t.human || 0,
      blogRequests: t.blog || 0,
      paidRequests: t.paid_agent || 0,
      paymentRequired: Number((summary.status || {})["402"] || 0),
      payments: t.payments || 0,
      revenueUsdc: t.revenueUsdc || 0,
      topAgent,
      topBlog: topBlogs[0] || null,
      topAgents,
      topBlogs,
      topPages,
      series: days,
      recent: recent.slice(0, 80),
      updatedAt: summary.updatedAt || null,
    })
  } catch (err) {
    return json(500, { ok: false, error: err.message || "No analytics store yet" })
  }
}
