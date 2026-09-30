// POST /api/track — edge gate logs visits here.

import { recordVisit, useBlobs } from "./_analytics-store.mjs"

const KINDS = new Set([
  "human",
  "ai_agent",
  "search_bot",
  "preview_bot",
  "paid_agent",
  "unknown",
])

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, X-Track-Key",
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

function trackSecret() {
  return process.env.ACCESS_TOKEN_SECRET || "dheeraj-work-netlify-ai-access-hmac-v1"
}

export async function handler(event) {
  useBlobs(event)
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" }
  }
  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, error: "POST required" })
  }

  const key = event.headers["x-track-key"] || event.headers["X-Track-Key"]
  if (key !== trackSecret()) {
    return json(401, { ok: false, error: "Unauthorized" })
  }

  let body
  try {
    body = JSON.parse(event.body || "{}")
  } catch {
    return json(400, { ok: false, error: "Invalid JSON" })
  }

  const kind = KINDS.has(body.kind) ? body.kind : "unknown"
  const path =
    typeof body.path === "string" && body.path.startsWith("/")
      ? body.path.slice(0, 180)
      : "/"
  const agent =
    typeof body.agent === "string" ? body.agent.slice(0, 60) : "unknown"

  try {
    await recordVisit({
      kind,
      path,
      agent,
      status: Number(body.status) || 0,
      ts: body.ts,
      visitorId: typeof body.visitorId === "string" ? body.visitorId : "",
    })
    return json(200, { ok: true })
  } catch (err) {
    return json(500, {
      ok: false,
      error: err.message || "Failed to write analytics",
    })
  }
}
