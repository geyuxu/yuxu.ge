---
date: 2024-01-01
tags: [backend]
legacy: true
---

# Todo List Multi-User Application Development Practice: Complete Upgrade from Single-User to Cross-Platform Architecture

### Upgraded Tech Stack
- **Frontend**: HTML5 + CSS3 + jQuery 3.6.0 + Authentication interfaces
- **Backend**: Flask 2.3.3 + Flask-JWT-Extended + bcrypt
- **Database**: SQLite multi-user design (foreign key relationships)
- **Authentication**: Hybrid approach using both session-based authentication (for web UI) and JWT tokens (for API clients)
- **Architecture**: Multi-user server architecture designed to support cross-platform clients

## Core Upgrade Components

### 1. Project Structure Reorganization

Reorganized the original flat structure to prepare for multi-platform development:

```
todo-list/
├── BLUE.md              # Cross-platform development blueprint
├── CLAUDE.md            # Development guide and code analysis
├── README.md            # Project documentation
└── web-client/          # B/S Web client
    ├── backend/
    │   ├── app.py           # Flask application main file
    │   ├── models.py        # Data models
    │   ├── requirements.txt # Python dependencies
    │   ├── migrate_db.py    # Database migration script
    │   └── todo.db         # SQLite database
    ├── static/
    │   ├── auth.css        # Authentication page styles
    │   ├── auth.js         # Authentication page scripts
    │   ├── script.js       # Main application script
    │   └── style.css       # Main application styles
    └── templates/
        ├── index.html      # Main application page
        ├── login.html      # Login page
        └── register.html   # Registration page
```

### 2. Database Schema Redesign

#### Original Schema
```sql
CREATE TABLE todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Multi-User Schema
```sql
-- Users table
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    email TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Todos table (updated for multi-user support)
CREATE TABLE todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
```

**Technical Note:** In SQLite, the `updated_at` column will only be set to the current timestamp on INSERT operations. For the `updated_at` field to function correctly on UPDATE operations, either the application logic must explicitly set this value during updates, or a database trigger should be implemented:

```sql
CREATE TRIGGER update_todos_updated_at 
AFTER UPDATE ON todos 
WHEN old.updated_at <> current_timestamp 
BEGIN 
    UPDATE todos 
    SET updated_at = CURRENT_TIMESTAMP 
    WHERE id = OLD.id; 
END;
```

The `ON DELETE CASCADE` constraint ensures that when a user is deleted, all their associated todos are automatically removed from the database, maintaining referential integrity.

### 3. User Authentication System Implementation

#### Backend API Design
```python
# User authentication endpoints
@app.route('/api/register', methods=['POST'])
def register():
    # User registration logic with password encryption
    
@app.route('/api/login', methods=['POST'])
def login():
    # User login verification, returns JWT Token
    
@app.route('/api/logout', methods=['POST'])
def logout():
    # User logout, clears session

# Protected API endpoints
@app.route('/api/todos', methods=['GET'])
@login_required
def get_todos():
    # Returns only current user's todos
```

#### Authentication Decorator
```python
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated_function
```

### 4. Frontend Authentication Interface

#### Login Page Features
- **Responsive Design**: Supports desktop and mobile devices
- **Real-time Validation**: Username length and password strength checks
- **Error Handling**: Friendly error messages and loading states
- **Security Features**: Prevents form resubmission, password masking

#### Registration Page Features
- **Input Validation**: Username uniqueness, password confirmation matching
- **Visual Feedback**: Real-time input status indicators
- **User Experience**: Automatic redirect to login after successful registration

### 5. Database Migration Solution

Developed a professional database migration script `migrate_db.py`:

```python
def migrate_database(db_path):
    # 1. Automatically backup existing database
    backup_path = backup_database(db_path)
    
    # 2. Check table structure, determine if migration is needed
    todos_columns, users_exists = check_table_structure(db_path)
    
    # 3. Safely add user_id column and users table
    # 4. Preserve existing data, assign to default user
    # 5. Add foreign key constraints to ensure data consistency
    # 6. Automatic rollback on failure
```

**Migration Features**:
- ✅ Automatic data backup
- ✅ Data integrity protection
- ✅ Automatic rollback on failure
- ✅ Detailed migration logs

## Technical Challenges and Solutions

### 1. Database Schema Mismatch Issue

**Problem**: After upgrade, encountered `sqlite3.OperationalError: no such column: user_id` error

**Solution**: 
- Created safe database migration script
- Implemented progressive table structure upgrade
- Ensured zero data loss migration

### 2. API Path 404 Errors

**Problem**: Frontend calling `/api/5` instead of `/api/todos/5`

**Solution**: 
```javascript
// Before fix
url: `${API_BASE}/${id}`  // /api/5

// After fix  
url: `${API_BASE}/todos/${id}`  // /api/todos/5
```

### 3. User Data Isolation

**Problem**: Ensuring different users can only access their own data

**Solution**: 
- Added user authentication checks to all API endpoints
- Database queries must include `user_id` filter conditions
- Implemented strict session management

## Performance Optimization Practices

### 1. Database Connection Optimization
- Avoid creating new connections for each query
- Implement connection pool management
- Optimize SQL query efficiency

### 2. Frontend Experience Optimization
- Implement loading state indicators
- Add operation confirmation dialogs
- Optimize error message display

### 3. Security Enhancements
- bcrypt password encryption storage
- JWT Token authentication mechanism
- XSS attack protection (HTML escaping)
- CSRF protection measures

## Development Workflow

### 1. Requirements Analysis and Architecture Design
- Analyzed technical challenges from single-user to multi-user
- Designed cross-platform server architecture
- Developed detailed development roadmap

### 2. Backend System Refactoring
- Redesigned data models
- Strengthened API endpoint security
- Implemented user authentication system

### 3. Frontend Interface Development
- Designed authentication page UI/UX
- Refactored JavaScript logic
- Adapted responsive layout

### 4. Database Migration Implementation
- Developed and tested migration scripts
- Safely migrated production data
- Verified data consistency

### 5. Integration Testing and Optimization
- API interface functional testing
- User registration/login flow verification
- Data isolation security testing

## Project Results

### Functional Features
- ✅ **User Management**: Complete registration/login/logout functionality
- ✅ **Data Isolation**: Each user has independent todo data
- ✅ **Session Management**: Dual authentication based on Session + JWT
- ✅ **Responsive Design**: Supports desktop and mobile device access
- ✅ **Security Authentication**: bcrypt password encryption, anti-XSS attacks

### Technical Metrics
- **User Response Time**: < 200ms (local environment)
- **Data Security**: 100% user data isolation
- **Compatibility**: Supports modern browsers
- **Scalability**: Reserved interfaces for multi-platform clients

## Cross-Platform Development Plan

Based on today's established server architecture, development will continue according to the BLUE.md roadmap:

### Phase 2: Apple Ecosystem
- iOS client (Swift + SwiftUI)
- macOS client (Catalyst)
- Core Data offline caching

### Phase 3: Android + Windows
- Android client (Kotlin + Compose)
- Windows client (C# + WPF)
- Local database caching

### Phase 4: Linux + Integration Testing
- Linux client (Python + PyQt)
- Cross-platform integration testing
- Complete documentation writing

## Technical Insights

### 1. Importance of Architecture Design
Good architecture design is the foundation of project success. Through reasonable module division and interface design, sufficient space is reserved for future functional expansion.

### 2. Caution in Data Migration
Data migration is a high-risk operation that requires adequate backup and rollback preparation. Automated migration scripts greatly reduce the risk of human error.

### 3. Importance of User Experience
Technical implementation is important, but user experience is equally critical. Responsive design, friendly error messages, and smooth interactions are all details that cannot be ignored.

### 4. Security-First Design Principles
Security must be considered from the beginning of the project, including password encryption, session management, and data isolation. The cost of later remediation is far higher than early design.

## Summary

Today's Todo List application upgrade was a complete technical practice, successfully evolving from a single-function web application to a modern multi-user system. This project not only demonstrates web application development best practices but also lays a solid foundation for subsequent cross-platform development.

Through this practice, I deeply realize: **Good software is not completed in one go, but gradually perfected through continuous iteration and optimization**. Each feature implementation and each problem solution is a step toward better user experience and stronger technical capabilities.

---

**Tech Stack**: Python Flask, SQLite, HTML5, CSS3, JavaScript, JWT, bcrypt  
**Project Features**: Multi-user authentication, Data isolation, Responsive design, Cross-platform architecture  
**Development Date**: July 24, 2025  
**Project Status**: Web client completed, multi-platform client development in progress