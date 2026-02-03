---
date: 2025-01-24
tags: [ai]
legacy: true
---

# Technical Research on Using Claude for Automated Updates to Notion, Obsidian, and Heptabase

- `POST https://api.notion.com/v1/pages` - Create new page entries in specified databases
- `PATCH https://api.notion.com/v1/blocks/{block_id}/children` - Append content blocks to existing pages

Before use, you must create an "Integration," obtain an OAuth Token or internal integration secret, and connect it to target pages/databases with content insertion permissions. Otherwise, write requests will return HTTP 403 errors.

### Markdown Content Writing Solutions

The Notion API accepts JSON-formatted block structures to represent page content, not direct Markdown text. Therefore, Markdown must be parsed into Notion's block structure before writing via API.

Here's an example using the Notion Python SDK to create a database page and add text paragraph content:

```python
notion.pages.create(**{
    "parent": {"database_id": DATABASE_ID},
    "properties": {  
        "title": {"title": [{"type": "text", "text": {"content": title}}]},  
        "Tags": {"type": "multi_select", "multi_select": [{"name": tag}]},  
        "Created": {"date": {"start": date}}  
    },
    "children": [  
        {
            "object": "block",  
            "type": "paragraph",  
            "paragraph": {  
                "rich_text": [{"type": "text", "text": {"content": content}}]  
            }  
        }  
    ]
})
```

Where `parent` specifies the target database ID, `properties` sets page attributes (title, tags, date), and `children` contains the actual note content. Note that the Notion API has a limit of 100 content blocks per request, requiring segmentation for longer articles.

### Existing Integration Tool Ecosystem

Around the Notion API, the community has built a rich ecosystem of SDKs and integration tools:

#### Auto-GPT Plugin
An open-source Auto-GPT Notion plugin exists that allows autonomous agents to read, create, and update Notion pages/databases. The plugin provides a complete command set:
- `notion_create_page` - Create new pages
- `notion_append_page` - Append content
- `notion_query_database` - Query databases

Usage requires providing Notion integration tokens and database IDs in Auto-GPT's environment configuration, and whitelisting the plugin. Once enabled, AI agents can automatically save searched information or generated notes to specified Notion databases.

#### Claude MCP Integration
Anthropic's Claude supports MCP (Model Context Protocol) extensions. Community-developed MCP-based Notion connectors, such as Notion MCP Server, act as bridges between Claude and Notion. Configuring this connector requires:

1. Providing Notion API tokens
2. Running MCP services
3. Registering as tools in Claude Code or Claude Desktop

Once configured, Claude can execute instructions like "create a new Notion database entry" or "update page content," with underlying operations calling Notion APIs. This approach fully leverages Claude's automation capabilities, using Notion as external memory or task boards.

**Summary:** Notion is the platform with the highest degree of automation support. Through official APIs, Markdown notes can be created in batches, provided content is converted to Notion block structures with appropriate permissions. Whether using lightweight scripts or complex AI Agents, mature support solutions are available.

## Obsidian Platform: Plugin Ecosystem-Driven Local Automation

### Official Support Status and Limitations

Obsidian is a local-first note-taking application that **does not provide officially open cloud APIs**. The Obsidian Sync service also doesn't offer open interfaces. Developers mainly extend functionality through the Obsidian plugin API (for writing community plugins), with no default REST interfaces for external program operations.

Therefore, automatically writing content to Obsidian requires workaround solutions using local automation.

### Viable Automatic Writing Solutions

#### 1. Direct File System Operations
Obsidian notes are stored as Markdown (.md) files in local Vault folders. The most direct method is having automation scripts directly create/modify these Markdown files on the file system.

```python
# Example: Python script directly writing Obsidian notes
vault_path = "/path/to/obsidian/vault"
note_path = os.path.join(vault_path, f"{note_title}.md")

with open(note_path, 'w', encoding='utf-8') as f:
    f.write(f"# {note_title}\n\n{content}")
```

When Obsidian has the Vault open, newly added or modified .md files are detected and loaded in real-time. This method doesn't require Obsidian to provide interfaces but requires automation programs to have disk write permissions.

#### 2. Advanced URI Plugin Solution
Obsidian includes native `obsidian://` protocol for basic operations. The community-developed **Advanced URI plugin** further extends the URI interface, allowing rich Obsidian operations through specific URL calls:

```bash
# Example URI for creating or updating notes
obsidian://advanced-uri?vault=MyVault&filepath=new-note.md&content=...&mode=append
```

Advanced URI converts URL parameters into file read/write actions within Obsidian, making it ideal for scripted integration. This solution requires Obsidian to have the corresponding Vault open and the plugin installed.

#### 3. Local REST API Plugin
For more general automation needs, the community developed the **Obsidian Local REST API plugin**. When installed and enabled, it starts a local HTTPS server (default ports 27123/27124) providing REST interfaces:

```bash
# Create new note
POST https://localhost:27123/notes/new-note-path
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "content": "# Title\n\nNote content..."
}
```

This plugin supports executing Obsidian commands, creating journals, and other advanced functions, making Obsidian a programmable platform. Using standard HTTP interfaces makes it highly suitable for integration with various programming languages and AI Agents.

### Integration Tools and AI Applications

#### Auto-GPT Obsidian Plugin
Similar to Notion, third parties have developed Auto-GPT plugins for Obsidian. This plugin allows Auto-GPT Agents to "understand" Obsidian Vault structure and content, programmatically creating or modifying notes. Features include:

- Automatically generating knowledge cards
- Completing note metadata
- Generating memory cards based on note content

Auto-GPT achieves these functions by calling files in Obsidian Vaults (using interfaces encapsulated by the obsidiantools library).

#### Claude MCP Integration
Similar to Notion's MCP approach, some have wrapped Obsidian's local REST API as MCP Server. For example, "MCP Obsidian Server" allows Claude to call tools for:

- Searching note content
- Reading full note text
- Browsing Vault file structures

While current MCP integrations focus on reading analysis (like having AI search for answers across all notes), since the underlying Obsidian REST interface also supports write operations, theoretically Claude Agents can also create or update Obsidian notes through appropriate tool instructions.

**Summary:** Obsidian's automatic content updates require implementation through local plugins or scripts. The community-provided local REST API plugin is a more general solution that, combined with AutoGPT or Claude Agents, can achieve automatic reading and writing of Obsidian notes. Compared to Notion, Obsidian integration requires users to have local runtime environments and some plugin configuration, but once set up, AI-generated Markdown can be seamlessly written to Vaults.

## Heptabase Platform: Limited Options in a Closed Ecosystem

### Official Support and Limitations

Heptabase **currently does not provide public APIs**. According to Heptabase's official August 2024 AMA, they plan to eventually support APIs to enhance interoperability, but this won't likely happen until after 2025.

The official strategy is to implement integrations with other applications on a case-by-case basis based on user needs before supporting general APIs. However, Heptabase is currently a relatively closed system overall, with no official interfaces for external programs to directly create or update note cards.

### Indirect Methods: Import/Export Mechanisms

While real-time writing through programming interfaces isn't possible, Heptabase supports importing data from other note-taking tools:

#### Markdown Import Functionality
Heptabase includes built-in functionality for importing notes from Markdown files. Users can:

1. Import Markdown notes (such as .md files from Obsidian) into Heptabase
2. Each Markdown file converts to cards in Heptabase
3. Support imports from Notion, Roam Research, Logseq, and other platforms

Import process example:
- Package Obsidian vault as zip, then use Heptabase's Import function in the bottom left to select "Obsidian"
- Can also directly select individual .md files for import within the application

Heptabase preserves Markdown text formatting (including links, tags, etc.) and converts to its proprietary card structure, with Wiki links converted to Heptabase-supported standard links.

#### Data Sync and Export
Heptabase automatically syncs user data to the cloud and writes local backups. It supports exporting notes as Markdown or PDF to ensure data portability. However, these are manually triggered import/export operations for data migration and backup, not programmable continuous update pipelines.

### Current Integration Tool Status

Due to the lack of open APIs and no official plugin mechanisms for AI integration, there are currently no open-source integration tools like AutoGPT or LangChain specifically for Heptabase.

Regarding AI functionality, Heptabase itself has launched a built-in "AI Chat" feature that can interact with note content to answer user questions. However, this is an internal AI feature of the Heptabase application, utilizing user-provided OpenAI API Keys, and doesn't provide interfaces for third-party AI to write content.

### Viable Alternative Solutions

Before official APIs are released, if automatic updating of Heptabase content is absolutely necessary, only unconventional methods can be considered:

#### GUI Script Simulation
Using methods that simulate user interface operations to "automatically input" content into Heptabase. For example:

```applescript
# AppleScript example: Adding logs to Heptabase
tell application "Heptabase"
    activate
    key code 36  # Enter key
    type text "## " & (current date as string) & "\n\n"
    type text "New log content..."
end tell
```

Community users have shared scripts using AppleScript + Raycast to quickly append logs to Heptabase's today page. These scripts use AppleScript to call Heptabase application windows, insert specific strings at the end of current cards (triggering Heptabase's template expansion functionality), achieving one-click addition of timestamped log entries.

This approach essentially "plays human" when no API exists, partially satisfying personal workflow automation needs, but requires writing scripts specific to Heptabase client interfaces, with high maintenance costs and vulnerability to application interface changes.

#### Indirect Collaborative Updates
If users simultaneously use Heptabase and another API-supporting note tool (like Obsidian or Notion), consider maintaining content sync through intermediate bridging:

1. Use plugins to automatically generate notes in Obsidian
2. Periodically export these notes as Markdown
3. Import into Heptabase

However, this workflow cannot achieve real-time, fine-grained updates and is more of a batch import approach.

**Summary:** Currently, there's no way to programmatically update Heptabase notes directly through Claude or other automation Agents. Only manual imports and some interface-level script assistance are available. The Heptabase team clearly states they won't open APIs in the short term, so for users pursuing automation, Heptabase lags behind in this aspect.

## Platform Solution Comparison Summary

| Platform | Automatic Writing Methods | Required Permissions/Configuration | Integration Examples | Content Format Support |
|----------|---------------------------|-------------------------------------|---------------------|----------------------|
| **Notion** | Official REST API<br/>Third-party SDK/scripts | Notion integration token<br/>Grant content insertion permissions | Auto-GPT Notion plugin<br/>Claude MCP server<br/>Zapier automation platforms | Database page entry format<br/>Supports rich text, properties<br/>Requires Markdown to block conversion |
| **Obsidian** | No official cloud API<br/>Local plugins provide REST interfaces<br/>Advanced URI plugin<br/>Direct script .md file writing | Local Obsidian running<br/>Install relevant plugins<br/>REST plugin needs API key configuration | Auto-GPT Obsidian plugin<br/>Claude Code local REST integration<br/>Obsidian plugins calling AI APIs | Markdown text files as core<br/>Supports Wiki links<br/>YAML metadata formats |
| **Heptabase** | No official API currently<br/>(Expected after 2025)<br/>Supports manual Markdown import<br/>Can attempt GUI automation scripts | Import requires manual operation<br/>Scripts need desktop simulation | No official/public Agent integration<br/>Community has Raycast+AppleScript scripts | Internal card-based note management<br/>Supports Markdown import<br/>Preserves links, tags during conversion |

## Technical Implementation Recommendations

### For Notion Integration
1. **Recommended Solution**: Official SDK + Claude MCP integration
2. **Implementation Steps**:
   - Create Notion integration to obtain API Token
   - Set up MCP server configuration
   - Register tools in Claude Code
   - Test automatic content creation and updates

### For Obsidian Integration
1. **Recommended Solution**: Local REST API plugin + file system direct writing backup
2. **Implementation Steps**:
   - Install and configure Local REST API plugin
   - Set API keys and ports
   - Develop or configure Agent interface calls
   - Implement automatic Markdown content writing

### For Heptabase Integration
1. **Current Solution**: Indirect import + GUI automation assistance
2. **Implementation Steps**:
   - First automatically generate content in Obsidian/Notion
   - Periodically export to Markdown format
   - Process in batches through Heptabase import functionality
   - Use AppleScript and other tools for assistance when necessary

## Conclusion

Among the three major knowledge management platforms, **Notion provides the most comprehensive automation support**, with its official API and rich integration ecosystem making it easy for AI Agents like Claude to achieve automatic content creation and updates.

**Obsidian provides flexible local automation solutions through community plugins**. While requiring some configuration work, once set up, seamless integration with AI workflows can be achieved.

**Heptabase is currently most limited in automation**, mainly relying on manual imports and interface simulation scripts. Users need to wait for official API releases or adopt indirect workflows to achieve partial automation needs.

For knowledge management workflows pursuing high degrees of automation, we recommend prioritizing Notion or Obsidian solutions and selecting appropriate integration paths based on specific requirements.