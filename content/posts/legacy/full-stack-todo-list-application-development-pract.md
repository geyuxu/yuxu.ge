---
date: 2025-07-21
tags: [backend]
legacy: true
---

# Full-Stack Todo List Application Development Practice: Front-End and Back-End Separation Architecture

### Backend Technology Stack
- **Python Flask**: Lightweight web framework
- **SQLite**: Embedded database
- **RESTful API**: Standardized interface design
- **JSON**: Data exchange format

## Feature Design

### Core Features
1. **Task Creation**: Add new todo items
2. **Task Viewing**: Display all task lists
3. **Task Editing**: Modify task content and status
4. **Task Deletion**: Remove completed or unwanted tasks
5. **Status Toggle**: Mark tasks as completed/incomplete
6. **Data Persistence**: Save task information to database

### Interface Features
- **Clean Design**: Clear task display interface
- **Real-time Updates**: Operations immediately reflected in the interface
- **Responsive Layout**: Adapts to different screen sizes
- **Friendly Interaction**: Intuitive user operation experience

## Frontend Implementation

### JavaScript Core Logic

```javascript
// Task management class
class TodoManager {
    constructor() {
        this.tasks = [];
        this.init();
    }

    // Initialize application
    init() {
        this.bindEvents();
        this.loadTasks();
    }

    // Bind event handlers
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

    // Add task
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
            console.error('Failed to add task:', error);
        }
    }

    // Delete task
    async deleteTask(taskId) {
        try {
            await $.ajax({
                url: `/api/tasks/${taskId}`,
                method: 'DELETE'
            });
            $(`[data-id="${taskId}"]`).closest('.task-item').remove();
        } catch (error) {
            console.error('Failed to delete task:', error);
        }
    }

    // Toggle task status
    async toggleTask(taskId) {
        try {
            const response = await $.ajax({
                url: `/api/tasks/${taskId}`,
                method: 'PUT',
                data: { completed: !this.getTaskById(taskId).completed }
            });
            this.updateTaskDisplay(response);
        } catch (error) {
            console.error('Failed to update task:', error);
        }
    }

    // Render task list
    renderTasks(tasks) {
        const $taskList = $('#task-list');
        $taskList.empty();
        
        tasks.forEach(task => this.renderTask(task));
    }

    // Render single task
    renderTask(task) {
        const taskHtml = `
            <div class="task-item ${task.completed ? 'completed' : ''}">
                <input type="checkbox" class="task-checkbox" 
                       data-id="${task.id}" ${task.completed ? 'checked' : ''}>
                <span class="task-text">${task.text}</span>
                <button class="delete-btn" data-id="${task.id}">Delete</button>
            </div>
        `;
        $('#task-list').append(taskHtml);
    }
}

// Initialize application
$(document).ready(() => {
    new TodoManager();
});
```

### CSS Style Design

```css
/* Main container styles */
.todo-container {
    max-width: 600px;
    margin: 50px auto;
    padding: 20px;
    background: #fff;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

/* Input section */
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

/* Task list */
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

## Backend Implementation

### Flask API Service

```python
from flask import Flask, request, jsonify, render_template
import sqlite3
import json
from datetime import datetime

app = Flask(__name__)

# Database initialization
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

# Get all tasks
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

# Create new task
@app.route('/api/tasks', methods=['POST'])
def create_task():
    data = request.get_json() or request.form
    text = data.get('text', '').strip()
    
    if not text:
        return jsonify({'error': 'Task content cannot be empty'}), 400
    
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

# Update task
@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    data = request.get_json() or request.form
    
    conn = sqlite3.connect('todo.db')
    cursor = conn.cursor()
    
    # Check if task exists
    cursor.execute('SELECT * FROM tasks WHERE id = ?', (task_id,))
    task = cursor.fetchone()
    if not task:
        conn.close()
        return jsonify({'error': 'Task not found'}), 404
    
    # Update task
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

# Delete task
@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    conn = sqlite3.connect('todo.db')
    cursor = conn.cursor()
    cursor.execute('DELETE FROM tasks WHERE id = ?', (task_id,))
    
    if cursor.rowcount == 0:
        conn.close()
        return jsonify({'error': 'Task not found'}), 404
    
    conn.commit()
    conn.close()
    return jsonify({'message': 'Task deleted successfully'})

# Home route
@app.route('/')
def index():
    return render_template('index.html')

if __name__ == '__main__':
    init_db()
    app.run(debug=True, host='0.0.0.0', port=5000)
```

## Project Features

### 1. Front-End and Back-End Separation
- Clear separation of responsibilities
- RESTful API design
- Frontend focuses on user interaction, backend focuses on data processing

### 2. Reasonable Technology Selection
- Native JavaScript ensures performance
- jQuery simplifies DOM operations
- Flask is lightweight and easy to develop
- SQLite is a zero-configuration database

### 3. Well-Organized Code
- Modular JavaScript class design
- Clear CSS style structure  
- Standard Flask route organization

### 4. Excellent User Experience
- Real-time response to user operations
- Intuitive visual feedback
- Clean and beautiful interface design

## Deployment and Running

### Local Development Environment

```bash
# Backend startup
pip install flask
python app.py

# Frontend access
http://localhost:5000
```

### Directory Structure

```
todo-app/
├── app.py                 # Flask backend service
├── todo.db               # SQLite database
├── templates/
│   └── index.html        # Main page template
├── static/
│   ├── js/
│   │   └── app.js        # Frontend JavaScript
│   └── css/
│       └── style.css     # Style files
└── requirements.txt      # Python dependencies
```

## Technical Insights and Reflections

### Architecture Design
- **Front-end and back-end separation** improved development efficiency and maintainability
- **RESTful API** design ensured interface standardization
- **Lightweight technology stack** reduced project complexity

### Development Experience
- **Native JavaScript** provided better performance control
- **jQuery** greatly simplified DOM operations and AJAX requests
- **Flask's** simplicity accelerated development progress

### Code Quality
- **Modular design** improved code reusability
- **Exception handling** ensured application stability
- **Data validation** ensured data integrity

## Future Optimization Directions

1. **Feature Expansion**: Task categories, priorities, deadlines
2. **Performance Optimization**: Paginated loading, caching mechanisms
3. **User System**: Login registration, multi-user support
4. **Interface Enhancement**: Drag-and-drop sorting, batch operations
5. **Mobile Adaptation**: PWA support, offline functionality

## Summary

This Todo List full-stack application successfully implemented a front-end and back-end separated architecture design. Through reasonable technology selection and clear code organization, it built a feature-complete task management application with good user experience.

The project demonstrates how to use classic Web technology stack to build modern applications, laying a solid foundation for further feature expansion and technology upgrades.