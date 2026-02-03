---
date: 2024-01-01
tags: [ai, claude, notion, api, automation, cli, mcp]
legacy: true
---

# Connect Claude Code to Notion MCP with a Single Command

Let's get started.

## 2. Prerequisites

Before you begin, please ensure you've completed these two simple preparation steps.

### 2.1 Update Claude CLI / Desktop

MCP (Message-based Communication Protocol) is a newer feature in Claude Code that manages secure communication with external services. Please ensure your client is updated to a recent version (**≥ v0.7.0**) to support this feature.

**For CLI Users:**

Open your terminal and run the following command to upgrade:

```bash
pip install --upgrade claude-cli
```

**For Claude Desktop Users:**

Open the desktop application and check for updates via the menu bar to ensure you are running the latest version.

### 2.2 Check Your Notion Permissions

To allow Claude to access your Notion content, you will need to:
1.  **Have the right permissions**: Ensure you are an Admin or Member of the Notion workspace you want Claude to operate on.
2.  **Pre-select the authorization scope**: Think about which specific pages or databases you want to grant Claude access to. A best practice is to create a dedicated database (e.g., named "AI Drafts") or a top-level page (e.g., "Claude Inbox") and grant the Claude Integration access only to that specific scope. This adheres to the principle of least privilege.

## 3. Add the MCP Server with a Single Command

With the prerequisites out of the way, open your terminal and execute this single, crucial command:

```bash
claude mcp add --transport http notion https://mcp.notion.com/mcp
```

Let's break down this command:
- `claude mcp add`: This is the `claude-cli` instruction for adding a new MCP service.
- `--transport http`: Specifies the communication protocol as standard HTTP/S requests. This is the most common and versatile method.
- `notion`: This is the **local alias** you are setting for this connection. You can name it whatever you like, such as `my-notion` or `work-notion`. All future commands related to Notion will use this alias as a prefix (e.g., `notion.help`).
- `https://mcp.notion.com/mcp`: This is the official public MCP endpoint provided by Claude for connecting to Notion. It's a secure, cloud-hosted proxy that handles the OAuth flow and data exchange between Claude and the Notion API.

> **Advanced Option**: If you prefer using Server-Sent Events (SSE) for a more real-time, bidirectional communication experience, you can adjust the command to:
> `claude mcp add --transport sse notion https://mcp.notion.com/mcp/sse`

After executing the command, the CLI will confirm that the MCP server has been added, but its status will be "unconnected" for now.

## 4. The First-Time OAuth Authorization Flow

Now, we need to trigger an authorization flow so that Notion knows you are allowing Claude to access your account.

1.  In your Claude conversation or terminal, try to call any tool command that starts with the alias you just set. The simplest one is to ask for help:
    ```
    notion.help
    ```

2.  At this point, the Claude CLI or desktop app will detect that the `notion` service is not yet authorized and will **automatically open your default browser**, redirecting you to Notion's login and authorization page.

3.  In the browser, log in to your Notion account (if you aren't already), select the **Workspace** you want to authorize, and then choose the **specific pages or databases** you wish to grant access to.

4.  Click the **"Allow access"** button.

5.  After successful authorization, the browser will display a success page, indicating that you can return to your application. You can now close this browser tab.

Back in Claude, the connection has been established silently in the background. You haven't touched a single API Token throughout this entire secure process.

## 5. Verifying the Connection

How can you confirm the connection was successful? We can use the `mcp` subcommand to check. Note that the following commands **only check the status and will not write to or modify any of your Notion content**.

First, list all configured MCP services:
```bash
claude mcp list
```
You should see the `notion` service you just added, along with its communication method:
```
Available MCP servers:
- notion (http)
```

Next, get the detailed information for the `notion` service:
```bash
claude mcp get notion
```
You will see a JSON output, where the most important field is `status`. If everything went well, it should show as `connected`.
```json
{
  "name": "notion",
  "transport": "http",
  "url": "https://mcp.notion.com/mcp",
  "status": "connected",
  "last_error": null
}
```
If you see `status: "connected"`, congratulations! Claude now has the ability to communicate securely with your Notion account.

## 6. Common Issues & Troubleshooting

If you encounter problems during setup, refer to the table below for troubleshooting.

| Symptom | Possible Cause | Solution |
| :--- | :--- | :--- |
| After the browser pop-up, Claude still reports "unauthorized" or times out. | 1. The OAuth flow was manually canceled by the user.<br>2. A browser extension (like an ad blocker or privacy enhancer) blocked the redirect. | Re-run the `notion.help` command and ensure you complete the authorization flow in the browser. Try temporarily disabling any interfering browser extensions. |
| Tool calls return a `403 Forbidden` or similar permission error. | The Claude Integration has not been added to the specific page or database you are trying to access. | Navigate to the Notion page/database you want to work with → Click `Share` in the top-right corner → `Invite` → Find and select your Claude Integration from the list. |
| The CLI still prompts me for an `NTN_ACCESS_TOKEN`. | 1. Your `claude-cli` version is too old and doesn't support MCP.<br>2. You might be using an older local `STDIO` flow instead of MCP. | 1. Ensure you have upgraded to the latest version with `pip install --upgrade claude-cli`.<br>2. Confirm you have added the service via `claude mcp add` and are using the correct alias when calling tools (e.g., `notion.create_page`). |
| I want to share the same Notion connection config with my team. | The default configuration is saved in the user's home directory. | Run `claude mcp add -s project ...` in your project's root directory. This will generate a `.mcp.json` file in the current directory. Commit this file to your code repository, and team members who pull it will share the configuration. |

## 7. What's Next (A Teaser)

Now that the bridge is built, a wide range of automation possibilities are open for exploration. In upcoming articles, we will demonstrate how to use this connection to do some really cool things:

-   **Manage notes and tasks**: Use tools like `notion.create_page`, `notion.append_block_children`, and `notion.search` to create, update, and find Notion content directly from your conversation.
-   **Build an automation pipeline**: Combine this with local file system tools to create a "Markdown → Notion" summarization pipeline that automatically summarizes local `*.md` files and writes the content to a Notion database.
-   **Self-host an MCP service**: For developers with special requirements (like private deployments, offline environments, or enterprise compliance), we will explore how to self-host an MCP server for a fully controllable, end-to-end connection.

## 8. Conclusion

With just **one command** and a simple **OAuth web authorization**, we have established a trusted connection between Claude and Notion. This modern integration method does away with the cumbersome and insecure process of manually managing access tokens.

This connection is the bedrock for all future Notion automation. Your Claude is now ready to become your true Notion assistant.

In the next article, we will dive deep into how to actually call Notion's various tool commands to perform content creation, queries, and synchronization. Stay tuned!