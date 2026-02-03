---
date: 2024-01-01
tags: [ai, claude, notion, api, automation, cli, mcp]
legacy: true
---

# 使用一条命令把 Claude Code 接入 Notion MCP

让我们开始吧。

## 2. 基础准备

在开始连接之前，请确保完成以下两个简单的准备步骤。

### 2.1 更新 Claude CLI / Desktop

MCP (Message-based Communication Protocol) 是 Claude Code 中较新的功能，它负责管理与外部服务的安全通信。请确保你的客户端版本足够新（**≥ v0.7.0**）以支持此功能。

**对于 CLI 用户：**

打开你的终端，运行以下命令进行升级：

```bash
pip install --upgrade claude-cli
```

**对于 Claude Desktop 用户：**

打开桌面应用，通过菜单栏检查更新，确保你运行的是最新版本。

### 2.2 检查 Notion 侧权限

为了让 Claude 能够访问你的 Notion 内容，你需要：
1.  **拥有编辑权限**：确保你对希望 Claude 操作的 Notion 工作区（Workspace）拥有管理员或成员权限。
2.  **预先选好授权范围**：想好你希望授权给 Claude 的具体页面或数据库。一个最佳实践是专门创建一个数据库（例如，命名为 "AI Drafts"）或一个顶级页面（例如 "Claude Inbox"），仅将 Claude Integration 授权给这个特定范围，以遵循最小权限原则。

## 3. 一条命令添加 MCP 服务器

准备工作就绪后，打开你的终端，执行这关键的一条命令：

```bash
claude mcp add --transport http notion https://mcp.notion.com/mcp
```

让我们来分解这个命令：
- `claude mcp add`: 这是 `claude-cli` 中用于添加一个新的 MCP 服务的指令。
- `--transport http`: 指定通信协议为标准的 HTTP/S 请求。这是最常用、最通用的方式。
- `notion`: 这是你为这个连接设置的**本地别名**。你可以随意命名，比如 `my-notion`、`work-notion` 等。后续所有与 Notion 相关的指令都将使用这个别名作为前缀，例如 `notion.help`。
- `https://mcp.notion.com/mcp`: 这是 Claude 官方提供的、用于连接 Notion 的公共 MCP 端点。它是一个托管在云端的安全代理，负责处理 Claude 与 Notion API 之间的 OAuth 流程和数据交换。

> **高级选项**：如果你偏好使用 Server-Sent Events (SSE) 以获得更实时的双向通信体验，可以将命令调整为：
> `claude mcp add --transport sse notion https://mcp.notion.com/mcp/sse`

执行命令后，CLI 会确认 MCP 服务器已添加，但此时的状态是"未连接"。

## 4. 首次 OAuth 授权流程

现在，我们需要触发一次授权，让 Notion 知道你允许 Claude 访问你的账户。

1.  在你的 Claude 对话或终端中，尝试调用任何一个以你刚才设置的别名开头的工具指令。最简单的就是请求帮助：
    ```
    notion.help
    ```

2.  此时，Claude CLI 或桌面应用会检测到 `notion` 服务尚未授权，并**自动打开你的默认浏览器**，跳转到 Notion 的登录和授权页面。

3.  在浏览器中，登录你的 Notion 账户（如果尚未登录），然后选择你想要授权的**工作区 (Workspace)**，接着选择你希望授予权限的**具体页面或数据库**。

4.  点击 **"Allow access"** 按钮。

5.  授权成功后，浏览器会显示一个成功页面，提示你可以返回到你的应用。此时，你可以关闭这个浏览器标签页。

回到 Claude，连接已经悄然建立。整个过程你没有接触到任何 API Token，非常安全。

## 5. 验证连接是否生效

如何确认连接真的成功了？我们可以用 `mcp` 子命令来检查。请注意，以下命令**只检查状态，不会对你的 Notion 内容进行任何写入或修改操作**。

首先，列出所有已配置的 MCP 服务：
```bash
claude mcp list
```
你应该能看到刚才添加的 `notion` 服务，以及它的通信方式：
```
Available MCP servers:
- notion (http)
```

接下来，获取 `notion` 服务的详细信息：
```bash
claude mcp get notion
```
你会看到一段 JSON 输出，其中最重要的字段是 `status`。如果一切顺利，它应该显示为 `connected`。
```json
{
  "name": "notion",
  "transport": "http",
  "url": "https://mcp.notion.com/mcp",
  "status": "connected",
  "last_error": null
}
```
看到 `status: "connected"`，恭喜你，大功告成！Claude 现在已经拥有了与你的 Notion 账户安全通信的能力。

## 6. 常见问题 & 排错

如果在设置过程中遇到问题，可以参考下表进行排查：

| 症状 | 可能原因 | 解决方法 |
| :--- | :--- | :--- |
| 浏览器弹窗后，Claude 仍提示未授权或超时 | 1. OAuth 流程被用户手动取消。<br>2. 浏览器插件（如广告拦截器、隐私增强工具）拦截了重定向。 | 重新执行 `notion.help` 指令，确保在浏览器中完成授权流程。暂时禁用可能干扰的浏览器插件再试一次。 |
| 调用工具时返回 `403 Forbidden` 或类似权限错误 | 你尝试操作的页面或数据库，没有把 Claude Integration 添加进去。 | 打开你想要操作的 Notion 页面/数据库 → 点击右上角的 `Share` (分享) → `Invite` (邀请) → 在列表中找到并勾选你的 Claude Integration。 |
| CLI 仍然提示我输入 `NTN_ACCESS_TOKEN` | 1. `claude-cli` 版本过旧，不支持 MCP。<br>2. 你可能正在使用旧的本地 `STDIO` 流程，而非 MCP。 | 1. 确保已通过 `pip install --upgrade claude-cli` 升级到最新版。<br>2. 确认你已通过 `claude mcp add` 添加了服务，并且调用时使用了正确的别名（如 `notion.create_page`）。 |
| 我想让团队成员共享同一个 Notion 连接配置 | 默认配置保存在用户个人目录。 | 在项目根目录运行 `claude mcp add -s project ...`。这会在当前目录生成一个 `.mcp.json` 文件。将此文件提交到你们的代码仓库，团队成员拉取后即可共享该配置。 |

## 7. 后续可做的事（预告）

现在，连接的桥梁已经架设完毕，一片广阔的自动化大陆正等待我们去探索。在接下来的文章中，我们将展示如何利用这个连接做一些真正酷的事情：

-   **管理笔记和任务**：使用 `notion.create_page`、`notion.append_block_children` 和 `notion.search` 等工具，直接在对话中创建、更新和查找 Notion 内容。
-   **构建自动化流水线**：结合本地文件系统工具，实现一个 "Markdown → Notion" 的摘要流水线，自动将本地的 `*.md` 文件内容总结并写入到 Notion 数据库。
-   **自托管 MCP 服务**：对于有特殊需求（如私有化部署、离线环境、企业合规）的开发者，我们将探讨如何自托管 MCP 服务器，实现完全可控的端到端连接。

## 8. 结语

我们通过**一条命令**和一次简单的 **OAuth 网页授权**，就完成了 Claude 与 Notion 之间可信连接的建立。这种现代化的集成方式，彻底告别了手动管理 Access Token 的繁琐与不安全。

这个连接是所有后续 Notion 自动化的基石。现在，你的 Claude 已经准备好成为你真正的 Notion 助理了。

在下一篇文章中，我们将深入探讨如何实际调用 Notion 的各种工具指令，完成内容的写入、查询与同步。敬请期待！