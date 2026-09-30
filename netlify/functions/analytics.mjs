// GET /api/analytics — AgentGate KPI snapshot for /analytics/

import { analyticsGet, emptySummary, useBlobs } from "./_analytics-store.mjs"

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

function emptyKpis() {
  return {
    ok: true,
    totalRequests: 0,
    uniqueVisitors: 0,
    aiAgentRequests: 0,
    humanRequests: 0,
    blogRequests: 0,
    paidRequests: 0,
    payments: 0,
    revenueUsdc: 0,
    topAgent: null,
    topBlog: null,
    topAgents: [],
    topBlogs: [],
    recent: [],
    updatedAt: null,
  }
}

export async function handler(event) {
  useBlobs(event)
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" }
  }
  if (event.httpMethod !== "GET") {
    return json(405, { ok: false, error: "GET required" })
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

    return json(200, {
      ok: true,
      totalRequests: t.requests,
      uniqueVisitors: t.uniqueVisitors,
      aiAgentRequests: (t.ai_agent || 0) + (t.paid_agent || 0) + (t.unknown || 0),
      humanRequests: t.human || 0,
      blogRequests: t.blog || 0,
      paidRequests: t.paid_agent || 0,
      payments: t.payments || 0,
      revenueUsdc: t.revenueUsdc || 0,
      topAgent,
      topBlog: topBlogs[0] || null,
      topAgents,
      topBlogs,
      topPages,
      recent: recent.slice(0, 12),
      updatedAt: summary.updatedAt || null,
    })
  } catch (err) {
    return json(200, {
      ...emptyKpis(),
      error: err.message || "No analytics store yet",
    })
  }
}
