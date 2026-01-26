---
date: 2025-07-20
tags: [frontend]
legacy: true
---

# HTML5 Canvas Classic Tank Battle Game Development: Single-File Game Architecture Practice

### Architecture Characteristics
- **Single-file Design**: All code centralized in one HTML file
- **Object-oriented**: Using ES6 class syntax for code structure organization
- **Modular Thinking**: Clear functional separation and responsibility division
- **Zero Dependencies**: No external libraries or frameworks required

## Game System Design

### Core Class Structure

```javascript
// Main game class
class TankWarGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.width = 800;
        this.height = 600;
        
        this.player = new PlayerTank(100, 500);
        this.enemies = [];
        this.bullets = [];
        this.obstacles = [];
        
        this.gameState = 'playing'; // playing, paused, gameOver
        this.score = 0;
        this.level = 1;
        this.enemiesRemaining = 20;
        
        this.keys = {};
        this.lastTime = 0;
        
        this.init();
    }

    init() {
        this.setupCanvas();
        this.bindEvents();
        this.createObstacles();
        this.spawnEnemies();
        this.gameLoop();
    }

    setupCanvas() {
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.canvas.style.border = '2px solid #333';
        this.canvas.style.background = '#000';
    }

    bindEvents() {
        // Keyboard event handling
        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
    }

    gameLoop(currentTime = 0) {
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        if (this.gameState === 'playing') {
            this.update(deltaTime);
        }
        
        this.render();
        requestAnimationFrame((time) => this.gameLoop(time));
    }

    update(deltaTime) {
        // Update player
        this.player.update(deltaTime, this.keys);
        
        // Update enemies
        this.enemies.forEach(enemy => {
            enemy.update(deltaTime, this.player, this.obstacles);
        });
        
        // Update bullets
        this.bullets.forEach(bullet => {
            bullet.update(deltaTime);
        });
        
        // Handle collisions
        this.handleCollisions();
        
        // Clean up invalid objects
        this.cleanup();
        
        // Check game state
        this.checkGameState();
    }

    render() {
        // Clear canvas
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Render obstacles
        this.obstacles.forEach(obstacle => obstacle.render(this.ctx));
        
        // Render tanks
        this.player.render(this.ctx);
        this.enemies.forEach(enemy => enemy.render(this.ctx));
        
        // Render bullets
        this.bullets.forEach(bullet => bullet.render(this.ctx));
        
        // Render UI
        this.renderUI();
    }
}
```

### Tank Class Implementation

```javascript
class Tank {
    constructor(x, y, color = '#00FF00') {
        this.x = x;
        this.y = y;
        this.width = 32;
        this.height = 32;
        this.speed = 100; // pixels per second
        this.direction = 0; // 0:up, 1:right, 2:down, 3:left
        this.color = color;
        this.health = 1;
        this.fireRate = 500; // milliseconds
        this.lastFireTime = 0;
    }

    move(direction, deltaTime, obstacles = []) {
        const speed = this.speed * (deltaTime / 1000);
        let newX = this.x;
        let newY = this.y;
        
        // Calculate new position
        switch(direction) {
            case 0: newY -= speed; break; // up
            case 1: newX += speed; break; // right
            case 2: newY += speed; break; // down
            case 3: newX -= speed; break; // left
        }
        
        // Boundary check
        if (newX < 0 || newX + this.width > 800 ||
            newY < 0 || newY + this.height > 600) {
            return false;
        }
        
        // Collision detection
        const tempTank = { 
            x: newX, 
            y: newY, 
            width: this.width, 
            height: this.height 
        };
        
        if (this.checkCollisions(tempTank, obstacles)) {
            return false;
        }
        
        // Update position and direction
        this.x = newX;
        this.y = newY;
        this.direction = direction;
        return true;
    }

    checkCollisions(rect, obstacles) {
        return obstacles.some(obstacle => 
            this.isColliding(rect, obstacle)
        );
    }

    isColliding(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width &&
               rect1.x + rect1.width > rect2.x &&
               rect1.y < rect2.y + rect2.height &&
               rect1.y + rect1.height > rect2.y;
    }

    fire(currentTime) {
        if (currentTime - this.lastFireTime < this.fireRate) {
            return null;
        }
        
        this.lastFireTime = currentTime;
        
        // Calculate bullet starting position and direction
        let bulletX = this.x + this.width / 2;
        let bulletY = this.y + this.height / 2;
        
        return new Bullet(bulletX, bulletY, this.direction, this);
    }

    render(ctx) {
        ctx.save();
        
        // Move to tank center
        ctx.translate(this.x + this.width/2, this.y + this.height/2);
        
        // Rotate based on direction
        ctx.rotate(this.direction * Math.PI / 2);
        
        // Draw tank body
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.width/2, -this.height/2, this.width, this.height);
        
        // Draw cannon
        ctx.fillStyle = '#444';
        ctx.fillRect(-2, -this.height/2 - 8, 4, 12);
        
        // Draw tracks
        ctx.fillStyle = '#333';
        ctx.fillRect(-this.width/2 - 2, -this.height/2, 2, this.height);
        ctx.fillRect(this.width/2, -this.height/2, 2, this.height);
        
        ctx.restore();
        
        // Draw health bar
        if (this.health < this.maxHealth) {
            this.drawHealthBar(ctx);
        }
    }

    drawHealthBar(ctx) {
        const barWidth = this.width;
        const barHeight = 4;
        const barY = this.y - 8;
        
        // Background
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(this.x, barY, barWidth, barHeight);
        
        // Health
        ctx.fillStyle = '#00FF00';
        const healthWidth = (this.health / this.maxHealth) * barWidth;
        ctx.fillRect(this.x, barY, healthWidth, barHeight);
    }
}

// Player tank class
class PlayerTank extends Tank {
    constructor(x, y) {
        super(x, y, '#00FF00');
        this.maxHealth = 3;
        this.health = this.maxHealth;
        this.lives = 3;
    }

    update(deltaTime, keys) {
        // Handle movement input
        if (keys['ArrowUp'] || keys['KeyW']) {
            this.move(0, deltaTime, game.obstacles);
        }
        if (keys['ArrowRight'] || keys['KeyD']) {
            this.move(1, deltaTime, game.obstacles);
        }
        if (keys['ArrowDown'] || keys['KeyS']) {
            this.move(2, deltaTime, game.obstacles);
        }
        if (keys['ArrowLeft'] || keys['KeyA']) {
            this.move(3, deltaTime, game.obstacles);
        }
        
        // Handle shooting input
        if (keys['Space']) {
            const bullet = this.fire(Date.now());
            if (bullet) {
                game.bullets.push(bullet);
            }
        }
    }
}

// Enemy tank class
class EnemyTank extends Tank {
    constructor(x, y) {
        super(x, y, '#FF0000');
        this.aiState = 'patrol';
        this.targetDirection = Math.floor(Math.random() * 4);
        this.stateChangeTime = 0;
        this.moveTime = 0;
        this.fireInterval = 1000 + Math.random() * 2000; // Random firing interval
        this.lastAIUpdate = 0;
    }

    update(deltaTime, player, obstacles) {
        const currentTime = Date.now();
        
        // AI decision update (reduce update frequency for performance)
        if (currentTime - this.lastAIUpdate > 100) {
            this.updateAI(deltaTime, player, obstacles);
            this.lastAIUpdate = currentTime;
        }
        
        // Movement
        this.executeMovement(deltaTime, obstacles);
        
        // Firing
        this.handleFiring(currentTime, player);
    }

    updateAI(deltaTime, player, obstacles) {
        const distanceToPlayer = Math.sqrt(
            Math.pow(player.x - this.x, 2) + 
            Math.pow(player.y - this.y, 2)
        );
        
        // State machine
        switch(this.aiState) {
            case 'patrol':
                if (distanceToPlayer < 150) {
                    this.aiState = 'attack';
                    this.targetDirection = this.getDirectionToPlayer(player);
                }
                break;
                
            case 'attack':
                if (distanceToPlayer > 200) {
                    this.aiState = 'patrol';
                } else {
                    // Face player
                    this.targetDirection = this.getDirectionToPlayer(player);
                }
                break;
        }
        
        // Random direction change (patrol state)
        if (this.aiState === 'patrol' && Math.random() < 0.02) {
            this.targetDirection = Math.floor(Math.random() * 4);
        }
    }

    getDirectionToPlayer(player) {
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        
        if (Math.abs(dx) > Math.abs(dy)) {
            return dx > 0 ? 1 : 3; // right or left
        } else {
            return dy > 0 ? 2 : 0; // down or up
        }
    }

    executeMovement(deltaTime, obstacles) {
        if (!this.move(this.targetDirection, deltaTime, obstacles)) {
            // Hit a wall, change direction
            this.targetDirection = Math.floor(Math.random() * 4);
        }
    }

    handleFiring(currentTime, player) {
        if (this.aiState === 'attack' && 
            currentTime - this.lastFireTime > this.fireInterval) {
            
            // Check if can shoot player (simple ray casting)
            if (this.canShootPlayer(player)) {
                const bullet = this.fire(currentTime);
                if (bullet) {
                    game.bullets.push(bullet);
                }
            }
        }
    }

    canShootPlayer(player) {
        // Simplified ray casting
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        
        // Check if player is in firing direction
        switch(this.direction) {
            case 0: return dy < 0 && Math.abs(dx) < 50; // up
            case 1: return dx > 0 && Math.abs(dy) < 50; // right
            case 2: return dy > 0 && Math.abs(dx) < 50; // down
            case 3: return dx < 0 && Math.abs(dy) < 50; // left
        }
        return false;
    }
}
```

### Bullet System

```javascript
class Bullet {
    constructor(x, y, direction, owner) {
        this.x = x;
        this.y = y;
        this.width = 4;
        this.height = 4;
        this.speed = 300;
        this.direction = direction;
        this.owner = owner;
        this.active = true;
    }

    update(deltaTime) {
        if (!this.active) return;
        
        const speed = this.speed * (deltaTime / 1000);
        
        // Move based on direction
        switch(this.direction) {
            case 0: this.y -= speed; break; // up
            case 1: this.x += speed; break; // right
            case 2: this.y += speed; break; // down
            case 3: this.x -= speed; break; // left
        }
        
        // Boundary check
        if (this.x < 0 || this.x > 800 || this.y < 0 || this.y > 600) {
            this.active = false;
        }
    }

    render(ctx) {
        if (!this.active) return;
        
        ctx.fillStyle = '#FFFF00';
        ctx.fillRect(this.x - this.width/2, this.y - this.height/2, 
                    this.width, this.height);
    }

    checkCollision(target) {
        if (!this.active || this.owner === target) return false;
        
        return this.x < target.x + target.width &&
               this.x + this.width > target.x &&
               this.y < target.y + target.height &&
               this.y + this.height > target.y;
    }
}
```

## Game Mechanics Implementation

### Collision Detection System

```javascript
class CollisionManager {
    static handleBulletCollisions(bullets, targets) {
        bullets.forEach(bullet => {
            if (!bullet.active) return;
            
            // Check collision with obstacles
            game.obstacles.forEach(obstacle => {
                if (bullet.checkCollision(obstacle)) {
                    bullet.active = false;
                    // Can add explosion effect
                    this.createExplosion(bullet.x, bullet.y);
                }
            });
            
            // Check collision with tanks
            targets.forEach(target => {
                if (bullet.checkCollision(target)) {
                    bullet.active = false;
                    target.health--;
                    
                    // Create hit effect
                    this.createHitEffect(target.x, target.y);
                    
                    // Check if target is destroyed
                    if (target.health <= 0) {
                        this.destroyTarget(target);
                    }
                }
            });
        });
    }

    static createExplosion(x, y) {
        // Simple explosion effect
        const explosion = new ParticleEffect(x, y, 'explosion');
        game.effects.push(explosion);
    }

    static createHitEffect(x, y) {
        // Hit effect
        const hitEffect = new ParticleEffect(x, y, 'hit');
        game.effects.push(hitEffect);
    }

    static destroyTarget(target) {
        if (target instanceof EnemyTank) {
            // Enemy tank destroyed
            game.score += 100;
            game.enemiesRemaining--;
            
            // Remove from array
            const index = game.enemies.indexOf(target);
            if (index > -1) {
                game.enemies.splice(index, 1);
            }
            
            // Create explosion effect
            this.createExplosion(target.x, target.y);
            
        } else if (target instanceof PlayerTank) {
            // Player tank destroyed
            target.lives--;
            target.health = target.maxHealth;
            
            if (target.lives <= 0) {
                game.gameState = 'gameOver';
            } else {
                // Reset player position
                target.x = 100;
                target.y = 500;
            }
        }
    }
}
```

### Level System

```javascript
class LevelManager {
    static levels = [
        { enemies: 5, speed: 1.0, fireRate: 1.0 },
        { enemies: 8, speed: 1.2, fireRate: 1.2 },
        { enemies: 12, speed: 1.4, fireRate: 1.4 },
        { enemies: 16, speed: 1.6, fireRate: 1.6 },
        { enemies: 20, speed: 1.8, fireRate: 1.8 }
    ];

    static loadLevel(levelNumber) {
        const level = this.levels[levelNumber - 1] || this.levels[this.levels.length - 1];
        
        // Clear existing enemies
        game.enemies = [];
        game.bullets = [];
        
        // Set level parameters
        game.enemiesRemaining = level.enemies;
        game.level = levelNumber;
        
        // Spawn enemies
        this.spawnEnemies(level);
        
        // Reset player
        game.player.x = 100;
        game.player.y = 500;
        game.player.health = game.player.maxHealth;
    }

    static spawnEnemies(levelConfig) {
        const spawnPositions = [
            { x: 50, y: 50 },
            { x: 400, y: 50 },
            { x: 750, y: 50 },
            { x: 750, y: 300 },
            { x: 400, y: 300 }
        ];
        
        for (let i = 0; i < Math.min(5, levelConfig.enemies); i++) {
            const pos = spawnPositions[i];
            const enemy = new EnemyTank(pos.x, pos.y);
            
            // Apply level difficulty
            enemy.speed *= levelConfig.speed;
            enemy.fireInterval /= levelConfig.fireRate;
            
            game.enemies.push(enemy);
        }
        
        // Set remaining enemy count
        game.enemiesToSpawn = levelConfig.enemies - game.enemies.length;
    }

    static checkLevelComplete() {
        if (game.enemies.length === 0 && game.enemiesToSpawn === 0) {
            // Level complete
            game.level++;
            setTimeout(() => {
                this.loadLevel(game.level);
            }, 2000);
            
            return true;
        }
        return false;
    }
}
```

## UI System and Game State

### User Interface Rendering

```javascript
class UIRenderer {
    static render(ctx, game) {
        // Set font
        ctx.font = '16px Arial';
        ctx.fillStyle = '#FFFFFF';
        
        // Render score
        ctx.fillText(`Score: ${game.score}`, 10, 25);
        
        // Render level
        ctx.fillText(`Level: ${game.level}`, 10, 45);
        
        // Render lives
        ctx.fillText(`Lives: ${game.player.lives}`, 10, 65);
        
        // Render remaining enemies
        ctx.fillText(`Enemies: ${game.enemiesRemaining}`, 10, 85);
        
        // Render game state information
        if (game.gameState === 'paused') {
            this.renderPauseScreen(ctx);
        } else if (game.gameState === 'gameOver') {
            this.renderGameOverScreen(ctx);
        }
    }

    static renderPauseScreen(ctx) {
        // Semi-transparent background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, 800, 600);
        
        // Pause text
        ctx.font = '48px Arial';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.fillText('PAUSED', 400, 300);
        
        ctx.font = '24px Arial';
        ctx.fillText('Press P to continue', 400, 350);
        ctx.textAlign = 'left';
    }

    static renderGameOverScreen(ctx) {
        // Semi-transparent background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, 800, 600);
        
        // Game over text
        ctx.font = '48px Arial';
        ctx.fillStyle = '#FF0000';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', 400, 250);
        
        ctx.font = '24px Arial';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(`Final Score: ${game.score}`, 400, 300);
        ctx.fillText('Press R to restart', 400, 350);
        ctx.textAlign = 'left';
    }
}
```

## Performance Optimization Strategies

### 1. Object Pool Pattern
```javascript
class ObjectPool {
    constructor(createFn, resetFn, initialSize = 10) {
        this.createFn = createFn;
        this.resetFn = resetFn;
        this.pool = [];
        
        // Pre-create objects
        for (let i = 0; i < initialSize; i++) {
            this.pool.push(this.createFn());
        }
    }

    get() {
        if (this.pool.length > 0) {
            return this.pool.pop();
        }
        return this.createFn();
    }

    release(obj) {
        this.resetFn(obj);
        this.pool.push(obj);
    }
}

// Usage example
const bulletPool = new ObjectPool(
    () => new Bullet(0, 0, 0, null),
    (bullet) => { bullet.active = false; },
    20
);
```

### 2. Rendering Optimization
```javascript
class RenderOptimizer {
    static dirtyRectangles = [];
    
    static addDirtyRect(x, y, width, height) {
        this.dirtyRectangles.push({ x, y, width, height });
    }
    
    static clearDirtyRects(ctx) {
        this.dirtyRectangles.forEach(rect => {
            ctx.clearRect(rect.x, rect.y, rect.width, rect.height);
        });
        this.dirtyRectangles = [];
    }
    
    static isInViewport(obj, viewX, viewY, viewWidth, viewHeight) {
        return obj.x + obj.width >= viewX &&
               obj.x <= viewX + viewWidth &&
               obj.y + obj.height >= viewY &&
               obj.y <= viewY + viewHeight;
    }
}
```

## Project Features

### 1. Single-file Architecture Advantages
- **Simple Deployment**: Only one HTML file needed to run
- **Zero Dependencies**: No external libraries or frameworks required
- **Easy Sharing**: Convenient for code reading and learning
- **Fast Loading**: Reduced HTTP requests

### 2. Classic Game Mechanics
- **Instant Response**: Smooth real-time control experience
- **Intelligent AI**: Enemy tanks with basic tactical AI
- **Progressive Difficulty**: Multi-level difficulty escalation design
- **Visual Feedback**: Rich hit and explosion effects

### 3. Extensible Design
- **Modular Code**: Clear class structure for easy extension
- **Event System**: Support for custom game events
- **Configuration-driven**: Level data separated from logic

## Technical Insights

### Canvas 2D Programming
- Mastered advanced usage of Canvas drawing API
- Understood optimization strategies for game rendering loops
- Learned graphic transformation and animation implementation

### Game Development Fundamentals
- Implemented complete game loop architecture
- Designed efficient collision detection system
- Built state management and AI decision system

### Performance Optimization Practice
- Applied memory management techniques like object pools
- Implemented rendering optimizations like dirty rectangles
- Balanced functional complexity with runtime efficiency

## Future Extension Directions

1. **Multiplayer Mode**: Local two-player battles
2. **Level Editor**: Custom map functionality
3. **Power-up System**: Weapon upgrades and special items
4. **Save Function**: LocalStorage for game progress
5. **Mobile Adaptation**: Touch controls and responsive design

## Summary

This HTML5 Canvas tank battle project successfully demonstrates the feasibility of developing complete games using native Web technologies. Through carefully designed architecture and efficient implementation strategies, it achieves rich game functionality while maintaining code simplicity.

The project is not only a tribute to classic games but also a practical application of modern Web game development technologies, providing a complete solution reference for lightweight game development.