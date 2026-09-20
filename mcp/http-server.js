/**
 * Public HTTPS MCP server (stateless Streamable HTTP).
 * Deploy on Railway: npm start → https://<host>/mcp
 *
 * Stateless mode avoids "Invalid or missing session ID" after redeploys
 * and works better with Cursor remote MCP clients.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js"
import { registerBlogTools, SITE } from "./tools.js"

const PORT = Number(process.env.PORT || process.env.MCP_PORT || 3000)
const HOST = process.env.HOST || "0.0.0.0"

const allowedHosts = (process.env.ALLOWED_HOSTS || "")
  .split(",")
  .map((h) => h.trim())
  .filter(Boolean)

const app = createMcpExpressApp({
  host: HOST,
  ...(allowedHosts.length ? { allowedHosts } : {}),
})

function createServer() {
  const server = new McpServer({
    name: "dheeraj-blog",
    version: "1.0.0",
    websiteUrl: SITE,
  })
  registerBlogTools(server)
  return server
}

app.get("/", (_req, res) => {
  res.json({
    name: "dheeraj-blog MCP",
    version: "1.0.0",
    mcp: "/mcp",
    transport: "streamable-http (stateless)",
    site: SITE,
    llmsTxt: `${SITE}/llms.txt`,
    payment: {
      amount: "0.01 USDC",
      network: "Base",
      payTo: "0x8873cD8D93D6FDee9d21F699723C90eeC783747e",
    },
    tools: [
      "list_posts (free)",
      "get_access_terms (free)",
      "verify_payment",
      "get_post (requires accessToken)",
    ],
    connect: {
      cursor: {
        mcpServers: {
          "dheeraj-blog": {
            url: "https://mcp-production-3ebd.up.railway.app/mcp",
          },
        },
      },
    },
  })
})

app.get("/health", (_req, res) => {
  res.json({ ok: true })
})

app.post("/mcp", async (req, res) => {
  const server = createServer()
  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    })
    await server.connect(transport)
    await transport.handleRequest(req, res, req.body)
    res.on("close", () => {
      transport.close()
      server.close()
    })
  } catch (error) {
    console.error("MCP POST error:", error)
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      })
    }
  }
})

app.get("/mcp", (_req, res) => {
  // Browsers hit GET /mcp and used to see "Invalid or missing session ID".
  // Stateless servers don't use GET sessions — point clients here instead.
  res.status(405).json({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message:
        "GET /mcp is not used in stateless mode. Open / for discovery, or connect an MCP client with POST to /mcp (Cursor: url https://mcp-production-3ebd.up.railway.app/mcp).",
    },
    id: null,
  })
})

app.delete("/mcp", (_req, res) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "DELETE not required in stateless mode.",
    },
    id: null,
  })
})

app.listen(PORT, HOST, () => {
  console.log(`dheeraj-blog MCP (stateless) on http://${HOST}:${PORT}/mcp`)
  console.log(`site=${SITE}`)
})
