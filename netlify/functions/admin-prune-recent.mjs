// ONE-TIME admin tool: collapses redundant duplicate rows in the "recent" analytics list
// within a given time window, down to the first and last occurrence of each repeated
// (agent, path, status) signature. Rows outside the window, and any signature that occurs
// 2 times or fewer even inside the window, are left untouched.
//
// This is meant to be deployed, called once with POST, then deleted. It requires the same
// admin password as the rest of the analytics API, and only ever runs as a GET (dry run,
// no write) unless ?confirm=1 is also passed, so it can't be triggered destructively by
// accident or by a stray GET crawl.
//
// Usage:
//   GET  /api/admin-prune-recent?auth=...&start=...&end=...           -> preview, no write
//   POST /api/admin-prune-recent?auth=...&start=...&end=...&confirm=1 -> actually writes

import { analyticsGet, analyticsSet } from "./_analytics-store.mjs"

const corsHeaders = { "Content-Type": "application/json", "Cache-Control": "no-store" }
function json(statusCode, body) {
  return { statusCode, headers: corsHeaders, body: JSON.stringify(body, null, 2) }
}

function isAuthorized(event) {
  const expected = process.env.ANALYTICS_PASSWORD || process.env.ADMIN_PASSWORD || "1432"
  const q = event.queryStringParameters?.auth
  const h = event.headers?.["x-admin-key"] || event.headers?.["X-Admin-Key"]
  return q === expected || h === expected
}

function sig(r) {
  return `${r.agent || ""}|${r.path || ""}|${r.status || ""}`
}

export async function handler(event) {
  if (!isAuthorized(event)) return json(401, { ok: false, error: "Password required" })

  const q = event.queryStringParameters || {}
  const start = q.start
  const end = q.end
  if (!start || !end) {
    return json(400, { ok: false, error: "Pass ?start=ISO&end=ISO (the window to collapse within)" })
  }

  const recent = (await analyticsGet("recent")) || []
  const groups = new Map()
  const outsideWindow = []
  recent.forEach((r, i) => {
    if (!r.ts || r.ts < start || r.ts > end) {
      outsideWindow.push({ row: r, i })
      return
    }
    const key = sig(r)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(r)
  })

  let kept = outsideWindow.map((x) => x.row)
  let collapsedAway = 0
  for (const rows of groups.values()) {
    if (rows.length <= 2) {
      kept.push(...rows)
      continue
    }
    const ordered = [...rows].sort((a, b) => (a.ts < b.ts ? -1 : 1))
    kept.push(ordered[0], ordered[ordered.length - 1])
    collapsedAway += rows.length - 2
  }
  kept.sort((a, b) => (a.ts < b.ts ? 1 : -1))

  const summary = {
    ok: true,
    before: recent.length,
    after: kept.length,
    collapsedAway,
    window: { start, end },
    wrote: false,
  }

  const confirm = q.confirm === "1" && event.httpMethod === "POST"
  if (!confirm) return json(200, { ...summary, note: "Dry run, nothing written. POST with &confirm=1 to actually write." })

  await analyticsSet("recent", kept)
  summary.wrote = true
  return json(200, summary)
}
