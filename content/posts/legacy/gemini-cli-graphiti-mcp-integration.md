---
date: 2024-01-01
tags: [ai]
legacy: true
---

# Gemini CLI 对接 Graphiti MCP：实战指南

在开始配置之前，请确保完成以下准备工作：

1.  **安装 Gemini CLI**：
    ```bash
    # 通过 Homebrew (macOS)
    brew install gemini
    # 或通过 npm
    npm install -g @gemini-cli/core
    ```

2.  **获取并启动 Graphiti MCP Server**：
    您可以选择以下任一方式启动 Graphiti 服务。
    *   **Docker (推荐)**：
        ```bash
        # 在 Graphiti 项目根目录
        docker-compose up -d
        ```
    *   **源码启动**：
        ```bash
        # 确保已安装 uv
        uv run graphiti_mcp_server.py --transport sse --model gpt-4o
        ```

3.  **配置环境变量**：
    Graphiti 需要访问 OpenAI API 和 Neo4j 数据库，请确保以下环境变量已正确设置：
    ```bash
    export OPENAI_API_KEY="sk-..."
    export NEO4J_PASSWORD="your-neo4j-password"
    ```

4.  **确认服务端口**：
    启动后，Graphiti 默认在 `localhost:8000` 暴露服务。您可以通过访问以下端点来确认服务是否正常运行：
    *   **SSE 端点**: `http://localhost:8000/sse`
    *   **WebSocket 端点**: `http://localhost:8000/ws`

## 3. 配置方法 A：Gemini CLI 本地启动 Graphiti (stdio)

这种方法让 Gemini CLI 托管 Graphiti 进程，适合快速本地集成。

打开 Gemini CLI 的配置文件 `~/.gemini/settings.json`，并添加以下 `mcpServers` 配置：

```json
{
  "mcpServers": {
    "graphiti": {
      "command": "uv",
      "args": ["run", "graphiti_mcp_server.py", "--model", "gpt-4o", "--transport", "stdio"],
      "cwd": "/ABSOLUTE/PATH/TO/graphiti-mcp-server",
      "env": {
        "OPENAI_API_KEY": "sk-...",
        "NEO4J_PASSWORD": "..."
      },
      "trust": true
    }
  }
}
```

*   **`command` & `args`**: 定义了启动 Graphiti 服务的命令。
*   **`cwd`**: **必须**填写 Graphiti MCP Server 项目的**绝对路径**。
*   **`env`**: 用于传递必要的环境变量。
*   **优点**: 配置简单，零端口冲突，无需额外网络设置。

配置完成后，重新打开一个新的 `gemini` 终端。输入 `/mcp` 命令，如果看到 `graphiti` 服务已连接，则表示配置成功。

## 4. 配置方法 B：Gemini CLI 连接常驻 Graphiti 服务 (SSE)

如果 Graphiti 已经作为一个独立服务在运行，可以使用此方法连接。

同样，在 `~/.gemini/settings.json` 中添加配置：

```json
{
  "mcpServers": {
    "graphiti": {
      "url": "http://127.0.0.1:8000/sse",
      "timeout": 8000,
      "trust": true
    }
  }
}
```

*   **`url`**: 这是关键字段。请确保使用 `url` 而不是 `httpUrl`，这会告诉 Gemini CLI 使用 `GET` 方法和 `text/event-stream` 类型进行连接，以兼容 SSE。
*   **`timeout`**: 建议设置一个较长的超时时间（如 8000ms），以适应可能存在的网络延迟。
*   **`headers`**: 如果您的远程服务需要认证，可以在此添加 `Authorization` 头，例如：`"headers": { "Authorization": "Bearer your-token" }`。

**验证连接**:

1.  **测试 SSE 流**:
    ```bash
    curl -N http://127.0.0.1:8000/sse | head
    ```
    如果能看到持续输出的心跳事件（如 `event: ping`），说明 SSE 服务正常。

2.  **在 Gemini CLI 中检查**:
    启动 `gemini`，然后运行 `/mcp desc graphiti`。如果成功列出了 Graphiti 提供的工具列表，则连接成功。

## 5. 常见错误 & 解决方案

| 症状 | 可能原因 | 解决方案 |
| :--- | :--- | :--- |
| `Error 405 Method Not Allowed` | CLI 默认使用 `POST` 访问 SSE 端点。 | 将配置文件中的 `httpUrl` 字段改为 `url`，或确保 Graphiti 端点支持 `POST`。 |
| `Disconnected (0 tools cached)` | Graphiti 服务未运行或端点地址错误。 | 检查 `docker ps` 或 `lsof -Pni :8000` 确认服务状态，并仔细核对 `settings.json` 中的 URL。 |
| `Timeout` | SSE 长连接被防火墙或反向代理（如 Nginx）中断。 | 适当增加 `timeout` 值；检查防火墙规则；关闭 Nginx 的代理缓冲（`proxy_buffering off;`）。 |
| 需要多实例导致端口冲突 | 多个 Graphiti 实例或其他服务占用了 8000 端口。 | 修改 Graphiti 的启动端口（如 `GRAPHITI_PORT=8001`），并在 `settings.json` 中添加多个节点配置。 |

## 6. 快速排查脚本

当遇到问题时，以下命令可以帮助您快速定位：

1.  **检查 Graphiti 进程和端口占用**:
    ```bash
    # 查看哪个进程在使用 8000 端口
    lsof -Pni :8000
    ```

2.  **测试 SSE 连通性**:
    ```bash
    # 持续监听 SSE 事件流
    curl -N http://127.0.0.1:8000/sse | head
    ```

3.  **开启 Gemini CLI 调试模式**:
    ```bash
    # 启动时附加 --debug 参数，查看详细日志
    gemini --debug
    ```

## 7. 一句话总结

整个对接过程的核心可以概括为：**启动 Graphiti 服务 → 在 `~/.gemini/settings.json` 中正确填写 `url` 或 `command` → 重启 Gemini CLI**。完成这三步，您就可以在终端中无缝使用 Graphiti 提供的强大工具集了。