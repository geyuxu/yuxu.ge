---
date: 2025-07-23
tags: [ai]
legacy: true
---

# Building Agent Long-term Memory System with Claude Code, Graphiti, and Neo4j

Below is a summary of the installation and configuration process based on practice:
1. Install Neo4j Desktop: Download and install Neo4j Desktop from the official Neo4j website. Neo4j Desktop provides an intuitive interface to manage local databases, which is very suitable for getting started. Start Neo4j Desktop after installation is complete.
2. Create a database instance and set password: Create a new local graph database in Neo4j Desktop (version needs to be 5.x or higher). When starting the database for the first time, you will be asked to set a password. Please set a password for the Neo4j user (default username is neo4j) and remember this information. By default, Neo4j's Bolt connection URI is bolt://localhost:7687, and Graphiti will connect to the database through this URI later.
3. Clone the Graphiti repository and configure the environment: Open terminal, clone the Graphiti source code repository and enter the directory:

```
git clone https://github.com/getzep/graphiti.git
cd graphiti/mcp_server
```

The repository provides a .env.example template file. Copy one as .env and fill in Neo4j and OpenAI configurations according to actual conditions:

```
OPENAI_API_KEY=<your OpenAI API key>
MODEL_NAME=gpt-4.1-mini        # Specify LLM model name, such as OpenAI's GPT-4 mini version
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=<your Neo4j password>
```

Where OPENAI_API_KEY is the key used by Graphiti to call the OpenAI interface for LLM inference and embeddings, MODEL_NAME can specify OpenAI models (such as gpt-3.5-turbo or gpt-4 series, the default example uses GPT-4.1 mini model), and the Neo4j section fills in the connection information and credentials for the database just created.

4. Install required tools (uv, uvicorn, claude-cli):
* uv: Graphiti recommends using the uv tool developed by Astral to manage Python environments and dependencies. First install uv through pip install uv. Then execute uv sync in the graphiti/mcp_server directory, this command will install the required Python packages according to the project's lock file. uv is similar to pip but can synchronize dependencies faster. If not using uv, you can also manually create a virtual environment and use pip install -r requirements.txt to install dependencies.
* uvicorn: If you plan to run the service through HTTP SSE, you need to install the ASGI server uvicorn (usually already in dependencies). Make sure uvicorn can be called from the command line (e.g., pip install uvicorn).
* claude-cli: Claude Code provides command-line tools to manage MCP plugins. Install the claude CLI tool (e.g., through pip install anthropic or other means, see Anthropic documentation for details). After installation, the command line should be able to use the claude command for adding MCP servers and other configurations.

5. Start Graphiti MCP Server and register plugin in Claude: The Graphiti repository comes with an MCP Server implementation, used as a bridge between frontends like Claude and the Graphiti backend. There are two startup methods:
* Method A: Start through Claude Code CLI (stdio mode): This method runs Graphiti MCP Server as a subprocess of Claude, communicating through standard input/output. Execute the following command on the command line to add the Graphiti plugin to Claude Code (user scope):

```
claude mcp add-json graphiti-memory '{
  "type": "stdio",
  "command": "/usr/local/bin/uv",
  "args": [
    "run", "--directory", "/path/to/graphiti/mcp_server", 
    "graphiti_mcp_server.py", "--transport", "stdio"
  ],
  "env": {
    "OPENAI_API_KEY": "<your OpenAI key>",
    "MODEL_NAME": "gpt-4.1-mini",
    "NEO4J_URI": "bolt://localhost:7687",
    "NEO4J_USER": "neo4j",
    "NEO4J_PASSWORD": "<your Neo4j password>"
  }
}'
```

Replace the paths and parameters in the above command with actual values (e.g., uv executable path, Graphiti repository location, etc.). After execution, Claude Code will register an MCP plugin called "graphiti-memory", and Claude will automatically start this Server and communicate through stdio when memory is needed during conversations.

* Method B: Run Graphiti Server independently (SSE mode): In this method, Graphiti runs as an independent service, accessible to Claude through HTTP Server-Sent Events (SSE) interface. You can execute:

```
cd graphiti/mcp_server
uv run graphiti_mcp_server.py --transport sse --model gpt-4.1-mini
```

The above command will run Graphiti MCP Server in SSE mode locally (default listening on 0.0.0.0:8000). After successful startup, use Claude CLI to add this service as an MCP plugin:

```
claude mcp add --transport sse --scope user graphiti-memory http://localhost:8000/sse
```

This way Claude registers a remote MCP service called "graphiti-memory" (connected via HTTP). --scope user means it's globally available for this user (you can also use --scope project for specific projects). After completion, you can see the graphiti-memory plugin in the "MCP Servers" list in the Claude Code interface.

After completing the above installation and configuration, the Claude Agent now has Graphiti knowledge graph as long-term memory storage. Next, you can try conversing with Claude, recording information, and verifying the memory functionality.

## Usage Verification

To confirm whether Graphiti memory is working properly, you can directly check from the Neo4j side whether data is written:
* Knowledge graph node check: Open Neo4j Browser (built into Neo4j Desktop) and connect to the database just created, execute Cypher query: MATCH (n:Episodic) RETURN n LIMIT 25;. Graphiti stores each conversation or information fragment as a node with "Episodic" label, you can view the latest written Episode nodes and their attributes through this query. If you can see the node list, it means Claude has successfully stored conversation content in Neo4j.

If you cannot query any Episode nodes or Graphiti functionality is abnormal, it's recommended to troubleshoot from the following aspects:
* Bolt connection issues: Confirm that Graphiti MCP Server can connect to Neo4j database. Check whether the NEO4J_URI and port configured in .env are correct, the local default should be bolt://localhost:7687. Make sure the Neo4j database is started and no firewall is blocking local Bolt connections. If Neo4j uses non-default database name or username, Graphiti configuration also needs to be adjusted accordingly.
* OpenAI API Key status: When writing conversations, Graphiti will call OpenAI models to extract entities and generate embeddings. If the provided API Key is invalid or has insufficient balance, Graphiti may not be able to complete Episode parsing and writing. You can check the terminal output logs when running Graphiti Server. If there are OpenAI interface errors or insufficient balance messages, you need to replace with a valid API Key (OpenAI can get a certain amount of free quota daily if data sharing is enabled) or ensure the account has sufficient quota.
* Claude plugin enablement: Confirm that Graphiti MCP plugin is enabled in Claude frontend. In Claude Code, newly added MCP Servers may need to be enabled in the conversation interface (such as in Claude Desktop, you need to check and enable in the "plugins" list in the upper right corner of the conversation window). If the plugin is not enabled, Claude will not actually call Graphiti. Also note that Claude does not automatically trigger calls to MCP functionality for resources and prompt types by default (see details below), so when testing, you can first ask questions related to already recorded content to see if Claude can use previously stored memories to answer.

## Graphiti Memory Functionality Categories

As an MCP Server, Graphiti provides three types of interface capabilities, corresponding to the three types defined by MCP: Resources, Tools, and Prompts. Understanding these three helps leverage Graphiti memory's role:
1. Resources: Interfaces for retrieving information. Such as getting content from internal knowledge graphs or external databases. These interfaces only read data without side effects, serving to let LLM access historical information in knowledge bases. For example, Graphiti provides resource interfaces for retrieving nodes and facts, supporting time-aware queries that can get past conversation fragments by time or conditions. Claude can call Resource-type functionality to read relevant content when needing to reference memory.
2. Tools: Interfaces for executing operations that will change external environments or data. Such as writing data through APIs, performing calculations, etc. Graphiti's tool interfaces allow LLM to add new knowledge to graphs or call real-time search and graph operations, achieving online memory updates. Whenever users provide new information, Claude Agent can call Graphiti's tool methods (like add_episode) to store it as new nodes, thus continuously accumulating knowledge.
3. Prompts: Predefined prompt templates or workflows that facilitate reuse of complex interaction logic between LLM and MCP Server. For example, Graphiti may provide templates for certain queries, encapsulating commonly used multi-step operations. These Prompt templates can be viewed as Agent's "skill scripts" that are called when specific needs are triggered. Through Prompts, developers can solidify standard query patterns, allowing Claude to generate query requests to Graphiti with one click when needed.

Note that in Claude Desktop's current implementation, Tools-type MCP interfaces (like Graphiti's write/search functions) can be automatically called based on conversation context, while Resources and Prompts types will not be automatically triggered. That is, even if Graphiti lists available resources and prompt templates, Claude doesn't know when to use them by default unless users actively attach them. This point is particularly important in actual use, and coping strategies will be discussed in the next section.

## Usage Recommendations and Pitfall Records

Based on actual experience, here are some noteworthy recommendations and possible pitfalls encountered when using Graphiti long-term memory:
* Debugging Graphiti writes: When you find that conversation content is not written to Neo4j, you can check the console output logs of Graphiti MCP Server. Graphiti will print information like the model name and Group ID used when starting, and if errors occur during write execution (such as OpenAI returning formats that don't meet expectations), exception stacks are usually also printed in the logs. When debugging, you can try directly calling Graphiti's API (such as REST interface) to add test data, or use short and clearly structured inputs to trigger add_episode to isolate problems. Make sure .env is loaded correctly (you can explicitly specify --env-file .env in the startup command just in case). If Graphiti prompts embedding or parsing schema errors, it's usually caused by model output not conforming to expected JSON format.
* Avoiding Schema errors: Graphiti requires that the LLM used supports structured output to ensure correct formatting when extracting entity relationships. It's recommended to use OpenAI's GPT-4 or new versions of GPT-3.5 that have function calling or strict JSON output capabilities. If using models that don't support structured output (especially smaller models), you may encounter situations where Graphiti cannot parse returned content and Episode writing fails (manifested as log errors like schema mismatch). Additionally, running Graphiti for the first time will create required indexes and constraints on Neo4j, and IndexAlreadyExists prompts can be ignored. When adjusting Graphiti's entity/relationship type definitions, try to maintain consistency with Neo4j schema to avoid write errors due to schema mismatches.
* Correctly triggering Memory in Claude: To make Claude fully utilize Graphiti long-term memory, some guidance in conversation strategies is needed. Currently Claude doesn't automatically use Resource/Prompt, so users or developers need to actively trigger them. There are several practical techniques: First, prompt Claude at the very beginning of conversations that Graphiti memory is available and should query the graph first when needed. For example, you can set system prompts like: "Please search existing knowledge before answering." Second, skillfully use the **"References"** function provided by Claude interface: In Claude Desktop, you can click the "+" sign to attach stored memory fragments from MCP Server as reference materials. Third, refer to official recommendations to establish conversation conventions - such as "search first, then answer" and "record new information immediately". These rules can be used as Claude prompts, making the model develop habits of calling add_episode to save when encountering new preferences/facts, and calling search_nodes/search_facts to retrieve relevant nodes and relationships when encountering problems first. Such explicit prompts can greatly improve Graphiti memory utilization. In summary, some human guidance is currently needed, and future versions of Claude may make AI automatically aware of available memory resources and call them.

Through stable configuration and adjustment of the above tool chain, the integration of Claude Code with Graphiti + Neo4j can run smoothly, and an AI Agent with long-term memory is built. In real development, we should continuously optimize prompt strategies based on logs and conversation performance to ensure AI both "remembers" knowledge provided by users and can accurately recall and utilize it when needed. This solution can effectively avoid information forgetting in complex projects and greatly improve Agent's coherence and intelligence level for long-term tasks. In the future, if Claude plugin mechanisms are upgraded to automatically utilize Resource/Prompt, AI long-term memory will become even more handy. Hope the above pitfall experiences can help everyone more easily reproduce this powerful long-term memory Agent solution!