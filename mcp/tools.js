import { z } from "zod"

export const SITE = process.env.SITE_URL || "https://dheeraj-work.netlify.app"

export function ok(data) {
  return {
    content: [
      {
        type: "text",
        text: typeof data === "string" ? data : JSON.stringify(data, null, 2),
      },
    ],
  }
}

function decode(html) {
  return html
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

export function parseAtomFeed(xml) {
  const posts = []
  const entries = xml.split("<entry>").slice(1)
  for (const entry of entries) {
    const titleMatch = entry.match(/<title[^>]*>([\s\S]*?)<\/title>/)
    const hrefMatch = entry.match(/<link[^>]*href="([^"]+)"/)
    if (!titleMatch || !hrefMatch) continue
    const url = hrefMatch[1]
    const path = new URL(url).pathname
    posts.push({ title: decode(titleMatch[1]), url, path })
  }
  return posts
}

/** Register blog + payment tools on an McpServer instance */
export function registerBlogTools(server) {
  server.tool(
    "get_access_terms",
    "How to pay for AI access to this blog (0.01 USDC on Base)",
    {},
    async () =>
      ok({
        amount: "0.01 USDC",
        network: "Base",
        payTo: "0x8873cD8D93D6FDee9d21F699723C90eeC783747e",
        site: SITE,
        llmsTxt: `${SITE}/llms.txt`,
        next: "Call verify_payment with the tx hash, then get_post with the accessToken.",
      })
  )

  server.tool(
    "verify_payment",
    "Exchange a Base USDC tx hash for an access token",
    { txHash: z.string() },
    async ({ txHash }) => {
      const res = await fetch(`${SITE}/api/verify-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash }),
      })
      const text = await res.text()
      try {
        return ok(JSON.parse(text))
      } catch {
        return ok(text)
      }
    }
  )

  server.tool(
    "list_posts",
    "List post titles and links from the public feed (free)",
    {},
    async () => {
      const res = await fetch(`${SITE}/feed.xml`)
      if (!res.ok) return ok(`Failed to fetch feed.xml (${res.status})`)
      const xml = await res.text()
      const posts = parseAtomFeed(xml)
      return ok({ count: posts.length, posts })
    }
  )

  server.tool(
    "get_post",
    "Fetch a paid post. path looks like /2026/06/08/Understanding-x402-Agent-Payments-on-Chain.html",
    { path: z.string(), accessToken: z.string() },
    async ({ path, accessToken }) => {
      const res = await fetch(
        `${SITE}/api/content?path=${encodeURIComponent(path)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      const body = await res.text()
      if (res.status === 402) {
        return ok(
          "Payment required. Call get_access_terms, pay 0.01 USDC on Base, then verify_payment."
        )
      }
      return ok(body)
    }
  )
}
