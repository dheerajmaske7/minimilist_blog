import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { registerBlogTools } from "./tools.js"

const server = new McpServer({ name: "dheeraj-blog", version: "1.0.0" })
registerBlogTools(server)

const transport = new StdioServerTransport()
await server.connect(transport)
