// GET /api/analytics?range=day|week|month

import {
  analyticsGet,
  emptySummary,
  reputationFromProfiles,
  useBlobs,
  useSqlitePrimary,
} from "./_analytics-store.mjs"

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

function sinceIso(range) {
  const days = range === "week" ? 7 : range === "month" ? 30 : 1
  return new Date(Date.now() - days * 24 * 3600 * 1000).toISOString()
}

function isAuthorized(event) {
  const adminKey = event.headers?.["x-admin-key"] || event.headers?.["X-Admin-Key"]
  if (adminKey === "1432") return true
  if (event.queryStringParameters?.auth === "1432") return true
  const cookie = event.headers?.cookie || ""
  if (cookie.includes("agentgate_auth=1432")) return true
  return false
}

export async function handler(event) {
  useBlobs(event)
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" }
  }
  if (event.httpMethod !== "GET") {
    return json(405, { ok: false, error: "GET required" })
  }

  if (!isAuthorized(event)) {
    return json(401, { ok: false, error: "Password required" })
  }

  const range = parseRange(event)
  const since = sinceIso(range)

  if (useSqlitePrimary()) {
    try {
      const { queryDashboard } = await import("./_db.mjs")
      const data = await queryDashboard(range)
      let reputation = {}
      try {
        const summary = (await analyticsGet("summary")) || emptySummary()
        reputation = reputationFromProfiles(summary.agentProfiles, summary.recent || [])
      } catch (_e) {}
      return json(200, {
        ...data,
        ...reputation,
      })
    } catch (err) {
      console.warn("SQLite query fallback:", err)
    }
  }

  try {
    const summary = (await analyticsGet("summary")) || emptySummary()
    const recent = ((await analyticsGet("recent")) || []).filter(
      (row) => !row.ts || row.ts >= since
    )
    const t = { ...emptySummary().totals, ...(summary.totals || {}) }
    const reputation = reputationFromProfiles(
      summary.agentProfiles,
      recent
    )
    const topAgents = top(summary.agents, 40)
    const topBlogs = top(summary.blogPaths)
    const topPages = top(summary.paths)
    const topAgent =
      topAgents.find((row) => row.name !== "browser") || topAgents[0] || null
    const series = Object.entries(summary.days || {})
      .sort((a, b) => a[0].localeCompare(b[0]))
      .filter(([day]) => day >= since.slice(0, 10))
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
      since,
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
      series,
      recent: recent.slice(0, 500),
      ...reputation,
      updatedAt: summary.updatedAt || null,
    })
  } catch (err) {
    return json(500, { ok: false, error: err.message || "No analytics store yet" })
  }
}
