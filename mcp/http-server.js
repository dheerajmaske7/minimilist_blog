/**
 * Public HTTPS MCP server (Streamable HTTP).
 * Deploy on Railway: npm start → https://<host>/mcp
 */
import { randomUUID } from "node:crypto"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js"
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js"
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

/** @type {Record<string, StreamableHTTPServerTransport>} */
const transports = {}

app.get("/", (_req, res) => {
  res.json({
    name: "dheeraj-blog MCP",
    version: "1.0.0",
    mcp: "/mcp",
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
  })
})

app.get("/health", (_req, res) => {
  res.json({ ok: true })
})

async function mcpPostHandler(req, res) {
  const sessionId = req.headers["mcp-session-id"]
  try {
    let transport
    if (sessionId && transports[sessionId]) {
      transport = transports[sessionId]
    } else if (!sessionId && isInitializeRequest(req.body)) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          transports[id] = transport
        },
      })
      transport.onclose = () => {
        const sid = transport.sessionId
        if (sid && transports[sid]) delete transports[sid]
      }
      const server = createServer()
      await server.connect(transport)
      await transport.handleRequest(req, res, req.body)
      return
    } else {
      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Bad Request: No valid session ID provided",
        },
        id: null,
      })
      return
    }
    await transport.handleRequest(req, res, req.body)
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
}

async function mcpGetHandler(req, res) {
  const sessionId = req.headers["mcp-session-id"]
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send("Invalid or missing session ID")
    return
  }
  await transports[sessionId].handleRequest(req, res)
}

async function mcpDeleteHandler(req, res) {
  const sessionId = req.headers["mcp-session-id"]
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send("Invalid or missing session ID")
    return
  }
  await transports[sessionId].handleRequest(req, res)
  delete transports[sessionId]
}

app.post("/mcp", mcpPostHandler)
app.get("/mcp", mcpGetHandler)
app.delete("/mcp", mcpDeleteHandler)

app.listen(PORT, HOST, () => {
  console.log(`dheeraj-blog MCP listening on http://${HOST}:${PORT}/mcp`)
  console.log(`site=${SITE}`)
})
