// GET /api/bot-rules — retrieve current dynamic bot permissions
// POST /api/bot-rules — update permissions for specific bots or in bulk

import {
  getBotRulesStore,
  updateBotRuleStore,
  updateAllBotRulesStore,
  useBlobs,
} from "./_analytics-store.mjs"
import { DEFAULT_BOT_RULES } from "./_bot-defaults.mjs"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Admin-Key",
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

export async function handler(event) {
  useBlobs(event)

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" }
  }

  if (event.httpMethod === "GET") {
    try {
      const rules = await getBotRulesStore()
      return json(200, { ok: true, rules })
    } catch (err) {
      return json(500, { ok: false, error: err.message || "Failed to load bot rules" })
    }
  }

  if (event.httpMethod === "POST") {
    let body
    try {
      body = JSON.parse(event.body || "{}")
    } catch {
      return json(400, { ok: false, error: "Invalid JSON body" })
    }

    try {
      // Single toggle update
      if (typeof body.id === "string" && typeof body.allowed === "boolean") {
        const rules = await updateBotRuleStore(body.id, body.allowed)
        return json(200, { ok: true, updatedId: body.id, allowed: body.allowed, rules })
      }

      // Bulk update
      if (Array.isArray(body.rules)) {
        const rules = await updateAllBotRulesStore(body.rules)
        return json(200, { ok: true, rules })
      }

      // Action shortcuts
      if (body.action === "allow_all") {
        const current = await getBotRulesStore()
        const updated = current.map((r) => ({ id: r.id, allowed: true }))
        const rules = await updateAllBotRulesStore(updated)
        return json(200, { ok: true, rules })
      }

      if (body.action === "block_all_ai") {
        const current = await getBotRulesStore()
        const updated = current.map((r) => ({
          id: r.id,
          allowed: r.category === "Search Engine", // preserve search engines
        }))
        const rules = await updateAllBotRulesStore(updated)
        return json(200, { ok: true, rules })
      }

      if (body.action === "reset_defaults") {
        const rules = await updateAllBotRulesStore(DEFAULT_BOT_RULES)
        return json(200, { ok: true, rules })
      }

      return json(400, { ok: false, error: "Provide id and allowed boolean, or action" })
    } catch (err) {
      return json(500, { ok: false, error: err.message || "Failed to update bot rules" })
    }
  }

  return json(405, { ok: false, error: "Method not allowed" })
}
