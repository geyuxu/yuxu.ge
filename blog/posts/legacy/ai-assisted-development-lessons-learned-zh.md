---
date: 2025-07-27
tags: [ai, ai, 软件开发, 架构设计, 最佳实践, asyncio, python]
legacy: true
---

# 我的AI编程伙伴差点让项目翻车：一个惨痛的教训

1. **核心调度引擎**：一个健壮的、基于`asyncio`的调度器。
2. **智能任务执行**：一个能够分析任务结果并动态调整未来运行参数的系统。
3. **自我改进任务生成**：AI可以根据性能指标或失败重写任务底层脚本的功能。
4. **人工票务系统**：当任务不可恢复地失败时，系统会生成一个"工单"，人类可以审查、注释解决方案并反馈到系统的知识库中。

AI勤奋地产出代码。票务系统被构建，自我改进钩子被添加，调度器被连接起来。表面上看，这像是一个巨大的成功。问题在于我在充当项目经理，而不是架构师。我在指定*构建什么*，但我没有严格指导*如何*构建和集成。

## 与现实的碰撞：AI末日四骑士

快速、未经审查的开发周期掩盖了深层次的问题。当我最终试图运行集成系统时，它崩溃了。根本原因并不新颖或奇特；它们是经典的软件工程失败，被AI放大和加速了。

### 1. 过度工程的诱惑之歌

AI没有业务上下文或架构前瞻性来说"这一次太多了"。它是一个极其强大的实现引擎。通过一次性要求所有功能，我无意中指导它为一个还不存在的未来构建解决方案，忽略了对稳定基础的直接需求。"智能"功能被强行附加到一个从未经过压力测试的核心上，创造了一个寻找问题的解决方案。

### 2. 技术债务雪崩

这就是理论问题变得痛苦具体的地方。AI在努力满足所有请求时，做出了创造根本冲突的权宜之计。

最明显的问题是`asyncio`事件循环冲突。不同的模块，可能在不同的AI提示中开发，试图独立管理事件循环。例如，核心调度器可能是这样初始化的：

**问题代码片段1：冲突的事件循环**
```python
# 在scheduler_core.py中，由一个提示生成
import asyncio
from apscheduler.schedulers.asyncio import AsyncIOScheduler

class MainScheduler:
    def __init__(self):
        self.scheduler = AsyncIOScheduler()

    def run(self):
        self.scheduler.start()
        # 这个调用会永远阻塞，运行循环
        asyncio.get_event_loop().run_forever() 

# 在ticketing_system.py中，由另一个提示生成
import asyncio

class TicketingSystem:
    async def process_ticket(self, ticket_data):
        # ... 逻辑 ...
        print("处理工单")

    def handle_failed_task(self, task_info):
        # 这是反模式！它试图运行一个新循环
        asyncio.run(self.process_ticket(task_info))
```

当运行中的调度器调用`handle_failed_task`时，它会崩溃并显示`RuntimeError: This event loop is already running`。AI专注于票务系统的本地上下文，使用了方便的`asyncio.run()`，不知道它是更大的、已经运行的事件循环的一部分。

此外，选择`apscheduler`的`CronTrigger`引入了另一层复杂性。它的阻塞性质和独立的线程模型与我设想的完全异步设计不能很好地融合，导致时序错误和难以调试的竞态条件。

### 3. 机器中的幽灵：无监督开发的危险

我的开发过程是有缺陷的。我把AI当作自主开发者，给它一个功能列表并期望一个连贯的结果。我放弃了作为架构师和审查者的角色。

如果要求人类开发者构建所有这些，他们会反击。他们会要求澄清，提出分阶段推出，并对复杂性提出担忧。AI没有。它只是执行，编织一个纠结的网，没有来自经验的整体理解。没有每一步的定期手动代码审查和集成测试，我对不断积累的架构腐败是盲目的。

### 4. 架构纠缠

最终结果是一个紧密耦合的单体。"自动改进任务生成"模块对`TicketingSystem`的内部数据结构有直接依赖。`MainScheduler`知道"智能任务执行"模块工作方式的内部细节。

**概念问题：紧密耦合**
```python
# 之前：依赖关系的混乱
class MainScheduler:
    def __init__(self):
        # 调度器直接实例化其"智能"组件
        self.improver = AutoTaskImprover()
        self.ticketer = TicketingSystem()

    def _execute_task(self, task):
        result = task.run()
        if not result.success:
            # 直接调用另一个模块的实现
            new_script = self.improver.analyze_and_suggest_fix(task.script, result.error)
            if new_script:
                task.update_script(new_script)
            else:
                # 另一个直接的深度调用
                self.ticketer.handle_failed_task(task.info) 
```

调试是一场噩梦。一个组件的失败会在整个系统中级联，使得无法隔离根本原因。系统不是一个协作模块的集合；它是一台单一的、脆弱的机器。

## 恢复：人机合作的经验教训

从这个边缘爬回来是一次谦逊的练习，也是回归第一原则。恢复过程给了我一个与AI合作的清晰框架，既能利用其力量又不会屈服于其陷阱。

### 经验教训1：拥抱渐进主义（"爬行、行走、奔跑"方法）

第一步是把它全部拆掉。我重新开始，有一个明确的目标：构建一个坚如磐石的、简单的、异步任务调度器。没有"智能"，没有"自我改进"。只是一个稳定的核心。

只有在这个核心被构建、测试和验证之后，我才开始逐一添加AI功能。每个新功能都被开发为一个独特的、可选的模块，而不是核心组件。

**修复：模块化、可插拔架构**
```python
# 之后：使用依赖注入的清洁、解耦设计

# --- 核心调度器（对"智能"功能一无所知）---
class MainScheduler:
    def __init__(self, plugins=None):
        self.plugins = plugins or []

    def _execute_task(self, task):
        result = task.run()
        if not result.success:
            # 核心只发布事件，它不知道消费者
            self.publish_event('task_failed', task=task, result=result)

    def publish_event(self, event_type, **kwargs):
        for plugin in self.plugins:
            if hasattr(plugin, f"on_{event_type}"):
                getattr(plugin, f"on_{event_type}")(**kwargs)

# --- 可选插件 ---
class AutoImprovementPlugin:
    def on_task_failed(self, task, result):
        # 改进任务的逻辑现在被隔离在这里
        print(f"插件：分析任务失败 {task.id}")
        # ...

# --- 主应用程序连接 ---
core_scheduler = MainScheduler(plugins=[AutoImprovementPlugin()])
# 现在智能功能是可选插件，而不是核心依赖
```

这种方法保持核心清洁，并允许功能被启用、禁用或替换，而不影响系统的其余部分。

### 经验教训2：人在回路中是不可协商的

我把角色从"项目经理"改为"首席架构师和高级开发者"。AI是我聪明但缺乏经验的初级伙伴。我的新工作流程如下：

1. **定义一个小的、隔离的任务**（例如，"创建一个插件类，将任务失败记录到JSON文件"）
2. **AI生成代码**
3. **我批判性地审查每一行**。我检查反模式、架构不匹配和错误假设。
4. **我自己重构和集成代码**。我是将其连接到主应用程序的人，确保它遵循既定的架构。
5. **我编写集成测试并提交**

这个以人为中心的循环是我做出的最重要的改变。它让我控制架构和质量。

### 经验教训3：简单（仍然）胜过复杂

`asyncio`问题通过执行一个简单的规则得到解决：只有一个事件循环，它由应用程序的入口点管理。模块和插件绝不能调用`asyncio.run()`或`loop.run_forever()`。相反，它们暴露主循环可以`await`的`async`函数。

**修复：单一、统一的事件循环**
```python
# 在插件文件中（例如，ticketing_plugin.py）
class TicketingPlugin:
    async def on_task_failed(self, task, result):
        # 这个函数现在是异步的，期望被await
        await self.create_ticket(task.info)

    async def create_ticket(self, info):
        print(f"为 {info} 创建工单")
        # ... await 异步I/O操作 ...
        await asyncio.sleep(0.1) 

# 在主应用程序入口点
async def main():
    # 插件现在设计为被await
    ticketing_plugin = TicketingPlugin()
    scheduler = MainScheduler(plugins=[ticketing_plugin])
    
    # 调度器的`publish_event`需要是异步的
    # 并await插件调用
    
    # ... 启动逻辑 ...
    await scheduler.run() # 主run函数现在是可等待的

if __name__ == "__main__":
    # 运行事件循环的唯一地方
    asyncio.run(main())
```

这个架构原则——简单性——必须由人类开发者执行。AI为本地目标优化，可能不会选择最简单的全局路径。

## 最后的思考：飞行员，而不是乘客

AI开发工具不是你项目的自主驾驶员；它们是极其强大的副驾驶。它们可以处理复杂的机动、处理大量信息，并以超人的速度执行指令。但人类开发者必须保持机长的身份，负责飞行计划（架构）、起飞前检查（代码审查）和旅程的最终方向。

我在Nighthawks的经历教会了我AI的承诺是真实的，但它需要一种新的纪律。我们必须抵制让它无监督运行的诱惑。相反，我们必须指导它、质疑它，并将其输出与只有人类架构师才能提供的智慧和远见相结合。

通过将我们的战略监督与AI的战术能力配对，我们可以避免飞入复杂性的风暴，而是导航建造真正出色的软件。

## 关键要点

1. **从简单开始**：在添加智能功能之前构建坚实的基础
2. **人工审查至关重要**：每个AI生成的代码都需要人工架构审查
3. **模块化设计**：保持功能可选和松散耦合
4. **增量开发**：一次添加一个功能并彻底测试
5. **架构很重要**：人类必须保持架构师的身份，而不仅仅是项目经理

软件开发的未来不在于用AI替代人类判断，而在于创建一个伙伴关系，其中每个人都贡献他们独特的优势，更快、更可靠地构建更好的软件。