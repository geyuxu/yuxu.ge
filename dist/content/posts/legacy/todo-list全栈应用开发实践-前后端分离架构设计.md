---
date: 2025-07-21
tags: [backend]
legacy: true
---

# Todo List全栈应用开发实践：前后端分离架构设计

### 后端技术栈
- **Python Flask**: 轻量级Web框架
- **SQLite**: 嵌入式数据库
- **RESTful API**: 标准化接口设计
- **JSON**: 数据交换格式

## 功能设计

### 核心功能
1. **任务创建**: 添加新的待办事项
2. **任务查看**: 显示所有任务列表
3. **任务编辑**: 修改任务内容和状态
4. **任务删除**: 移除已完成或不需要的任务
5. **状态切换**: 标记任务完成/未完成
6. **数据持久化**: 任务信息保存到数据库

### 界面特性
- **简洁设计**: 清晰的任务展示界面
- **实时更新**: 操作后立即反映到界面
- **响应式布局**: 适配不同屏幕尺寸
- **友好交互**: 直观的用户操作体验

## 前端实现

### JavaScript 核心逻辑

```javascript
// 任务管理类
class TodoManager {
    constructor() {
        this.tasks = [];
        this.init();
    }

    // 初始化应用
    init() {
        this.bindEvents();
        this.loadTasks();
    }

    // 绑定事件处理
    bindEvents() {
        $('#add-task-btn').on('click', () => this.addTask());
        $('#task-input').on('keypress', (e) => {
            if (e.which === 13) this.addTask();
        });
        $(document).on('click', '.delete-btn', (e) => {
            this.deleteTask($(e.target).data('id'));
        });
        $(document).on('change', '.task-checkbox', (e) => {
            this.toggleTask($(e.target).data('id'));
        });
    }

    // 添加任务
    async addTask() {
        const taskText = $('#task-input').val().trim();
        if (!taskText) return;

        try {
            const response = await $.post('/api/tasks', {
                text: taskText,
                completed: false
            });
            this.renderTask(response);
            $('#task-input').val('');
        } catch (error) {
            console.error('添加任务失败:', error);
        }
    }

    // 删除任务
    async deleteTask(taskId) {
        try {
            await $.ajax({
                url: `/api/tasks/${taskId}`,
                method: 'DELETE'
            });
            $(`[data-id="${taskId}"]`).closest('.task-item').remove();
        } catch (error) {
            console.error('删除任务失败:', error);
        }
    }

    // 切换任务状态
    async toggleTask(taskId) {
        try {
            const response = await $.ajax({
                url: `/api/tasks/${taskId}`,
                method: 'PUT',
                data: { completed: !this.getTaskById(taskId).completed }
            });
            this.updateTaskDisplay(response);
        } catch (error) {
            console.error('更新任务失败:', error);
        }
    }

    // 渲染任务列表
    renderTasks(tasks) {
        const $taskList = $('#task-list');
        $taskList.empty();
        
        tasks.forEach(task => this.renderTask(task));
    }

    // 渲染单个任务
    renderTask(task) {
        const taskHtml = `
            <div class="task-item ${task.completed ? 'completed' : ''}">
                <input type="checkbox" class="task-checkbox" 
                       data-id="${task.id}" ${task.completed ? 'checked' : ''}>
                <span class="task-text">${task.text}</span>
                <button class="delete-btn" data-id="${task.id}">删除</button>
            </div>
        `;
        $('#task-list').append(taskHtml);
    }
}

// 初始化应用
$(document).ready(() => {
    new TodoManager();
});
```

### CSS 样式设计

```css
/* 主容器样式 */
.todo-container {
    max-width: 600px;
    margin: 50px auto;
    padding: 20px;
    background: #fff;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

/* 输入区域 */
.input-section {
    display: flex;
    margin-bottom: 30px;
    gap: 10px;
}

#task-input {
    flex: 1;
    padding: 12px;
    border: 2px solid #ddd;
    border-radius: 4px;
    font-size: 16px;
}

#add-task-btn {
    padding: 12px 20px;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.3s;
}

#add-task-btn:hover {
    background: #0056b3;
}

/* 任务列表 */
.task-item {
    display: flex;
    align-items: center;
    padding: 15px;
    border-bottom: 1px solid #eee;
    transition: background 0.3s;
}

.task-item:hover {
    background: #f8f9fa;
}

.task-item.completed {
    opacity: 0.6;
}

.task-item.completed .task-text {
    text-decoration: line-through;
}

.task-checkbox {
    margin-right: 15px;
}

.task-text {
    flex: 1;
    font-size: 16px;
}

.delete-btn {
    background: #dc3545;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
}

.delete-btn:hover {
    background: #c82333;
}
```

## 后端实现

### Flask API 服务

```python
from flask import Flask, request, jsonify, render_template
import sqlite3
import json
from datetime import datetime

app = Flask(__name__)

# 数据库初始化
def init_db():
    conn = sqlite3.connect('todo.db')
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            text TEXT NOT NULL,
            completed BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

# 获取所有任务
@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    conn = sqlite3.connect('todo.db')
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM tasks ORDER BY created_at DESC')
    tasks = []
    for row in cursor.fetchall():
        tasks.append({
            'id': row[0],
            'text': row[1],
            'completed': bool(row[2]),
            'created_at': row[3],
            'updated_at': row[4]
        })
    conn.close()
    return jsonify(tasks)

# 创建新任务
@app.route('/api/tasks', methods=['POST'])
def create_task():
    data = request.get_json() or request.form
    text = data.get('text', '').strip()
    
    if not text:
        return jsonify({'error': '任务内容不能为空'}), 400
    
    conn = sqlite3.connect('todo.db')
    cursor = conn.cursor()
    cursor.execute(
        'INSERT INTO tasks (text, completed) VALUES (?, ?)',
        (text, data.get('completed', False))
    )
    task_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    return jsonify({
        'id': task_id,
        'text': text,
        'completed': data.get('completed', False),
        'created_at': datetime.now().isoformat()
    }), 201

# 更新任务
@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    data = request.get_json() or request.form
    
    conn = sqlite3.connect('todo.db')
    cursor = conn.cursor()
    
    # 检查任务是否存在
    cursor.execute('SELECT * FROM tasks WHERE id = ?', (task_id,))
    task = cursor.fetchone()
    if not task:
        conn.close()
        return jsonify({'error': '任务不存在'}), 404
    
    # 更新任务
    text = data.get('text', task[1])
    completed = data.get('completed', task[2])
    
    cursor.execute(
        'UPDATE tasks SET text = ?, completed = ?, updated_at = ? WHERE id = ?',
        (text, completed, datetime.now().isoformat(), task_id)
    )
    conn.commit()
    conn.close()
    
    return jsonify({
        'id': task_id,
        'text': text,
        'completed': completed,
        'updated_at': datetime.now().isoformat()
    })

# 删除任务
@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    conn = sqlite3.connect('todo.db')
    cursor = conn.cursor()
    cursor.execute('DELETE FROM tasks WHERE id = ?', (task_id,))
    
    if cursor.rowcount == 0:
        conn.close()
        return jsonify({'error': '任务不存在'}), 404
    
    conn.commit()
    conn.close()
    return jsonify({'message': '任务删除成功'})

# 主页路由
@app.route('/')
def index():
    return render_template('index.html')

if __name__ == '__main__':
    init_db()
    app.run(debug=True, host='0.0.0.0', port=5000)
```

## 项目特色

### 1. 前后端分离
- 清晰的职责划分
- RESTful API 设计
- 前端专注用户交互，后端专注数据处理

### 2. 技术选型合理
- 原生 JavaScript 保证性能
- jQuery 简化 DOM 操作
- Flask 轻量级易于开发
- SQLite 零配置数据库

### 3. 代码组织良好
- 模块化的 JavaScript 类设计
- 清晰的 CSS 样式结构  
- 标准的 Flask 路由组织

### 4. 用户体验优秀
- 实时响应用户操作
- 直观的视觉反馈
- 简洁美观的界面设计

## 部署与运行

### 本地开发环境

```bash
# 后端启动
pip install flask
python app.py

# 前端访问
http://localhost:5000
```

### 目录结构

```
todo-app/
├── app.py                 # Flask后端服务
├── todo.db               # SQLite数据库
├── templates/
│   └── index.html        # 主页模板
├── static/
│   ├── js/
│   │   └── app.js        # 前端JavaScript
│   └── css/
│       └── style.css     # 样式文件
└── requirements.txt      # Python依赖
```

## 技术收获与思考

### 架构设计
- **前后端分离**提升了开发效率和可维护性
- **RESTful API**设计确保了接口的标准化
- **轻量级技术栈**降低了项目复杂度

### 开发体验
- **原生JavaScript**提供了更好的性能控制
- **jQuery**大幅简化了DOM操作和AJAX请求
- **Flask**的简洁性加快了开发进度

### 代码质量
- **模块化设计**提高了代码复用性
- **异常处理**保证了应用的稳定性
- **数据验证**确保了数据的完整性

## 未来优化方向

1. **功能扩展**: 任务分类、优先级、截止日期
2. **性能优化**: 分页加载、缓存机制
3. **用户系统**: 登录注册、多用户支持
4. **界面增强**: 拖拽排序、批量操作
5. **移动适配**: PWA支持、离线功能

## 总结

这个 Todo List 全栈应用成功实现了前后端分离的架构设计，通过合理的技术选型和清晰的代码组织，构建了一个功能完整、用户体验良好的任务管理应用。

项目展示了如何使用经典的Web技术栈构建现代化的应用，为进一步的功能扩展和技术升级奠定了坚实的基础。