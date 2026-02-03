---
date: 2024-01-01
tags: [devops, mcp, python, fastmcp, 自动化, 博客]
legacy: true
---

# 从混乱到清晰：一次MCP服务器开发的反思与总结

选择了Python和FastMCP框架来实现MCP服务器。FastMCP的优势在于：
- 极简的API设计
- 通过装饰器即可将普通函数转换为MCP工具
- 内置的stdio通信支持

### 2. 核心功能实现

最终实现了一个整合的`publish_blog_post`工具，它包含了完整的发布流程：

```python
@app.tool()
async def publish_blog_post(
    directory: str, 
    content: str, 
    filename: str,
    commit_message: str = None,
    deploy: bool = True
) -> str:
    """Save article, commit changes, and optionally deploy - all in one command."""
    
    # 1. 保存文章（自动添加frontmatter）
    # 2. Git提交
    # 3. 可选的部署
```

关键特性：
- **智能frontmatter生成**：自动为Markdown文件添加必要的元数据
- **一站式操作**：整合了文件保存、Git操作和部署
- **错误处理**：优雅处理"nothing to commit"等情况

## 三、遇到的问题与解决

### 问题1：初稿"乱写一通"

第一次写的博客文章被指出"乱写一通"，原因是我把FastMCP描述得过于复杂，实际上它就是一个简单的Python脚本。

**反思**：技术写作要准确、简洁，不要为了显得高深而把简单的事情复杂化。

**解决**：重新理解项目本质，强调Python脚本的简洁性，用不到100行代码就实现了完整功能。

### 问题2：测试的困境

尝试测试MCP工具时遇到了FastMCP装饰器导致的调用问题：
```python
TypeError: 'FunctionTool' object is not callable
```

**原因**：`@app.tool()`装饰器将函数包装成了`FunctionTool`对象，不能直接调用。

**解决**：在MCP服务器中添加了测试模式：
```python
if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--test":
        asyncio.run(test_mode())
    else:
        app.run()
```

### 问题3：测试原则的违背

最初的测试直接操作文件系统，而不是通过MCP服务器，完全违背了测试原则。

**解决**：修改MCP服务器程序，添加内置的测试功能，确保测试通过服务器的工具函数进行。

## 四、项目成果

1. **成功发布的博客文章**：
   - 《用Python脚本快速实现MCP服务器》（中英文版本）
   - 准确描述了FastMCP的使用方法

2. **功能完整的MCP服务器**：
   - 代码已推送到 [GitHub](https://github.com/geyuxu/astro-mcp-publisher)
   - 实现了发布、搜索、删除功能（后两者已注释，保持简洁）

3. **简化的工作流程**：
   - 从4步手动操作简化为1个函数调用
   - 实现了真正的"一键发布"

## 五、技术细节与最佳实践

### 1. 环境配置的灵活性
```python
ASTRO_DIR = pathlib.Path(os.getenv("ASTRO_DIR", "./astro")).expanduser().resolve()
```

### 2. 命令执行的封装
```python
def _run(cmd: List[str]) -> str:
    proc = subprocess.run(cmd, cwd=ASTRO_DIR, capture_output=True, text=True)
    banner = f"$ {' '.join(cmd)}\n"
    return banner + proc.stdout + proc.stderr
```

### 3. 时间格式的规范化
从简单的日期格式演进到包含时分秒：
```python
pubDate: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
```

## 六、经验教训

1. **清晰沟通的重要性**：技术实现再好，如果不能清晰地传达价值，就是失败的。

2. **简洁即是美**：不到100行Python代码就能实现强大的功能，这本身就是FastMCP的魅力。

3. **测试的正确方式**：测试应该通过被测试的系统进行，而不是绕过它。

4. **迭代改进**：从初始版本到最终版本，经历了多次重构和简化，每次都让代码更清晰。

## 七、未来展望

虽然当前版本已经满足了核心需求，但仍有改进空间：
- 恢复搜索和删除功能
- 添加更多的错误处理
- 支持批量操作
- 集成更多的博客平台

## 总结

这次开发经历虽然只有一天，但收获颇丰。从被批评"乱写一通"到最终实现清晰、实用的MCP服务器，这个过程本身就是一次宝贵的学习经历。它提醒我们：好的技术方案不仅要功能强大，更要简洁明了、易于理解和使用。

正如这个项目的标题所示，从混乱到清晰，不仅是代码的演进，更是认知的提升。