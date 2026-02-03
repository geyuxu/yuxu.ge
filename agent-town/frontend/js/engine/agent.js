/**
 * Agent类 - 前端模拟版本
 * 处理Agent的移动、状态、行为
 */

import { MAP_CONFIG, isWalkable, getRandomWalkablePosition, getBuilding, getRandomBuilding, BUILDINGS } from '../data/map.js';

// Agent状态
export const AGENT_STATES = {
  IDLE: 'idle',
  WALKING: 'walking',
  READING: 'reading',
  THINKING: 'thinking',
  CHATTING: 'chatting',
  RESTING: 'resting'
};

// 状态对应的动作描述
export const STATE_DESCRIPTIONS = {
  [AGENT_STATES.IDLE]: '站着发呆',
  [AGENT_STATES.WALKING]: '正在散步',
  [AGENT_STATES.READING]: '正在阅读博客',
  [AGENT_STATES.THINKING]: '陷入沉思',
  [AGENT_STATES.CHATTING]: '和朋友聊天',
  [AGENT_STATES.RESTING]: '休息中'
};

export class Agent {
  constructor(config) {
    // 基础属性
    this.id = config.id;
    this.name = config.name;
    this.avatar = config.avatar;
    this.color = config.color;
    this.description = config.description;
    this.traits = config.traits;
    this.favoritePlace = config.favoritePlace;
    this.commentStyle = config.commentStyle;

    // 位置 (像素坐标)
    const startPos = getRandomWalkablePosition();
    this.x = startPos.x;
    this.y = startPos.y;

    // 目标位置
    this.targetX = this.x;
    this.targetY = this.y;

    // 路径
    this.path = [];
    this.pathIndex = 0;

    // 状态
    this.state = AGENT_STATES.IDLE;
    this.stateTimer = 1000 + Math.random() * 2000;
    this.currentBuilding = null;

    // 移动
    this.speed = 50 + Math.random() * 20; // 像素/秒
    this.direction = 'down'; // up, down, left, right

    // 动画
    this.animFrame = 0;
    this.animTimer = 0;
    this.animSpeed = 150; // ms per frame

    // 气泡消息
    this.bubble = null;
    this.bubbleTimer = 0;

    // 统计
    this.stats = {
      postsRead: Math.floor(Math.random() * 10),
      comments: Math.floor(Math.random() * 5)
    };
  }

  /**
   * 更新Agent状态
   * @param {number} deltaTime - 毫秒
   */
  update(deltaTime) {
    // 更新状态计时器
    this.stateTimer -= deltaTime;

    // 更新气泡
    if (this.bubble) {
      this.bubbleTimer -= deltaTime;
      if (this.bubbleTimer <= 0) {
        this.bubble = null;
      }
    }

    // 根据状态更新
    switch (this.state) {
      case AGENT_STATES.IDLE:
        if (this.stateTimer <= 0) {
          this.decideNextAction();
        }
        break;

      case AGENT_STATES.WALKING:
        this.moveTowardsTarget(deltaTime);
        this.updateAnimation(deltaTime);
        break;

      case AGENT_STATES.READING:
      case AGENT_STATES.THINKING:
      case AGENT_STATES.CHATTING:
      case AGENT_STATES.RESTING:
        if (this.stateTimer <= 0) {
          this.finishActivity();
        }
        break;
    }
  }

  /**
   * 决定下一个行动
   */
  decideNextAction() {
    const roll = Math.random();

    // 根据性格特点调整概率
    const curiosityBonus = this.traits.curiosity * 0.1;
    const depthBonus = this.traits.depth * 0.1;
    const empathyBonus = this.traits.empathy * 0.1;

    if (roll < 0.3 + curiosityBonus) {
      // 去图书馆读书
      this.goToBuilding('library');
    } else if (roll < 0.45 + depthBonus) {
      // 去咖啡馆思考
      this.goToBuilding('cafe');
    } else if (roll < 0.55 + empathyBonus) {
      // 去广场社交
      this.goToBuilding('plaza');
    } else if (roll < 0.65) {
      // 去喷泉休息
      this.goToBuilding('fountain');
    } else if (roll < 0.75) {
      // 去公园散步
      this.goToBuilding('park');
    } else {
      // 随机散步
      this.walkToRandomPosition();
    }
  }

  /**
   * 去某个建筑物
   */
  goToBuilding(buildingId) {
    const building = getBuilding(buildingId);
    if (!building) {
      this.walkToRandomPosition();
      return;
    }

    this.currentBuilding = building;
    this.targetX = building.entranceX * MAP_CONFIG.tileSize + MAP_CONFIG.tileSize / 2;
    this.targetY = building.entranceY * MAP_CONFIG.tileSize + MAP_CONFIG.tileSize / 2;
    this.state = AGENT_STATES.WALKING;

    // 显示气泡
    this.showBubble(`去${building.name}`, 2000);
  }

  /**
   * 随机散步
   */
  walkToRandomPosition() {
    const pos = getRandomWalkablePosition();
    this.targetX = pos.x;
    this.targetY = pos.y;
    this.state = AGENT_STATES.WALKING;
    this.currentBuilding = null;
  }

  /**
   * 向目标移动
   */
  moveTowardsTarget(deltaTime) {
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 5) {
      // 到达目标
      this.x = this.targetX;
      this.y = this.targetY;
      this.arrivedAtTarget();
      return;
    }

    // 移动
    const moveSpeed = this.speed * (deltaTime / 1000);
    const moveX = (dx / distance) * moveSpeed;
    const moveY = (dy / distance) * moveSpeed;

    // 更新位置
    this.x += moveX;
    this.y += moveY;

    // 更新朝向
    if (Math.abs(dx) > Math.abs(dy)) {
      this.direction = dx > 0 ? 'right' : 'left';
    } else {
      this.direction = dy > 0 ? 'down' : 'up';
    }
  }

  /**
   * 到达目标后的处理
   */
  arrivedAtTarget() {
    if (this.currentBuilding) {
      // 在建筑物处执行活动
      this.startBuildingActivity(this.currentBuilding);
    } else {
      // 随机散步到达，休息一下
      this.state = AGENT_STATES.IDLE;
      this.stateTimer = 2000 + Math.random() * 3000;
    }
  }

  /**
   * 开始建筑物活动
   */
  startBuildingActivity(building) {
    switch (building.action) {
      case 'reading':
        this.state = AGENT_STATES.READING;
        this.stateTimer = 5000 + Math.random() * 5000;
        this.showBubble('📖 阅读中...', this.stateTimer);
        this.stats.postsRead++;
        break;

      case 'thinking':
        this.state = AGENT_STATES.THINKING;
        this.stateTimer = 4000 + Math.random() * 4000;
        this.showBubble('💭 思考中...', this.stateTimer);
        break;

      case 'chatting':
        this.state = AGENT_STATES.CHATTING;
        this.stateTimer = 3000 + Math.random() * 3000;
        this.showBubble('💬 聊天中...', this.stateTimer);
        break;

      case 'resting':
        this.state = AGENT_STATES.RESTING;
        this.stateTimer = 3000 + Math.random() * 2000;
        this.showBubble('😌 休息中...', this.stateTimer);
        break;

      default:
        this.state = AGENT_STATES.IDLE;
        this.stateTimer = 2000 + Math.random() * 2000;
    }
  }

  /**
   * 结束活动
   */
  finishActivity() {
    // 有概率生成评论
    if (this.state === AGENT_STATES.READING && Math.random() < 0.3) {
      this.stats.comments++;
      this.showBubble('✍️ 写了一条评论!', 3000);
    }

    this.state = AGENT_STATES.IDLE;
    this.stateTimer = 1000 + Math.random() * 2000;
    this.currentBuilding = null;
  }

  /**
   * 更新动画帧
   */
  updateAnimation(deltaTime) {
    this.animTimer += deltaTime;
    if (this.animTimer >= this.animSpeed) {
      this.animTimer = 0;
      this.animFrame = (this.animFrame + 1) % 4;
    }
  }

  /**
   * 显示气泡消息
   */
  showBubble(text, duration = 3000) {
    this.bubble = text;
    this.bubbleTimer = duration;
  }

  /**
   * 获取状态描述
   */
  getStateDescription() {
    return STATE_DESCRIPTIONS[this.state] || '未知状态';
  }

  /**
   * 获取用于渲染的状态
   */
  getRenderState() {
    return {
      id: this.id,
      name: this.name,
      avatar: this.avatar,
      color: this.color,
      x: this.x,
      y: this.y,
      direction: this.direction,
      state: this.state,
      animFrame: this.animFrame,
      bubble: this.bubble,
      description: this.description,
      stats: this.stats
    };
  }
}
