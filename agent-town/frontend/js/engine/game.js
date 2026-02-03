/**
 * 游戏主引擎
 * 管理游戏循环、Agent、渲染
 */

import { Agent } from './agent.js';
import { Renderer } from '../render/renderer.js';
import { UI } from '../render/ui.js';
import { AGENT_CONFIGS, MOCK_COMMENTS } from '../data/agents.js';
import { MAP_CONFIG } from '../data/map.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // 设置canvas大小
    this.canvas.width = MAP_CONFIG.pixelWidth;
    this.canvas.height = MAP_CONFIG.pixelHeight;

    // 创建渲染器
    this.renderer = new Renderer(this.ctx);

    // 创建UI管理器
    this.ui = new UI(this);

    // 创建Agents
    this.agents = AGENT_CONFIGS.map(config => new Agent(config));

    // 评论数据
    this.comments = [...MOCK_COMMENTS];

    // 活动日志
    this.activityLog = [];

    // 游戏状态
    this.isPaused = false;
    this.speed = 1;
    this.lastTime = 0;

    // 鼠标交互
    this.hoveredAgent = null;
    this.selectedAgent = null;

    // 绑定事件
    this.bindEvents();

    // 添加初始日志
    this.addActivity('🏘️ 小镇开始苏醒...');
  }

  /**
   * 绑定事件
   */
  bindEvents() {
    // 鼠标移动 - 检测悬停
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      const mouseX = (e.clientX - rect.left) * scaleX;
      const mouseY = (e.clientY - rect.top) * scaleY;

      this.hoveredAgent = this.getAgentAt(mouseX, mouseY);
      this.canvas.style.cursor = this.hoveredAgent ? 'pointer' : 'default';
    });

    // 鼠标点击 - 选择Agent
    this.canvas.addEventListener('click', (e) => {
      if (this.hoveredAgent) {
        this.selectedAgent = this.hoveredAgent;
        this.ui.showAgentDetail(this.selectedAgent);
      }
    });

    // 鼠标离开
    this.canvas.addEventListener('mouseleave', () => {
      this.hoveredAgent = null;
    });
  }

  /**
   * 获取某位置的Agent
   */
  getAgentAt(x, y) {
    const hitRadius = 20;
    for (const agent of this.agents) {
      const dx = x - agent.x;
      const dy = y - agent.y;
      if (dx * dx + dy * dy < hitRadius * hitRadius) {
        return agent;
      }
    }
    return null;
  }

  /**
   * 启动游戏
   */
  start() {
    this.lastTime = performance.now();
    this.loop();
    this.ui.init();

    // 定期检查并生成活动日志
    setInterval(() => this.checkAgentActivities(), 3000);
  }

  /**
   * 游戏主循环
   */
  loop() {
    const currentTime = performance.now();
    const deltaTime = (currentTime - this.lastTime) * this.speed;
    this.lastTime = currentTime;

    if (!this.isPaused) {
      this.update(deltaTime);
    }

    this.render();

    requestAnimationFrame(() => this.loop());
  }

  /**
   * 更新游戏状态
   */
  update(deltaTime) {
    // 更新所有Agent
    for (const agent of this.agents) {
      agent.update(deltaTime);
    }
  }

  /**
   * 渲染游戏
   */
  render() {
    // 清空画布
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 渲染地图
    this.renderer.drawMap();

    // 渲染建筑物
    this.renderer.drawBuildings();

    // 按Y坐标排序Agent (实现遮挡)
    const sortedAgents = [...this.agents].sort((a, b) => a.y - b.y);

    // 渲染Agent
    for (const agent of sortedAgents) {
      const isHovered = agent === this.hoveredAgent;
      const isSelected = agent === this.selectedAgent;
      this.renderer.drawAgent(agent.getRenderState(), isHovered, isSelected);
    }

    // 渲染气泡
    for (const agent of sortedAgents) {
      if (agent.bubble) {
        this.renderer.drawBubble(agent);
      }
    }
  }

  /**
   * 检查Agent活动并记录日志
   */
  checkAgentActivities() {
    for (const agent of this.agents) {
      // 随机生成活动日志
      if (Math.random() < 0.1) {
        const action = agent.getStateDescription();
        this.addActivity(`${agent.avatar} ${agent.name} ${action}`);
      }
    }
  }

  /**
   * 添加活动日志
   */
  addActivity(text) {
    const time = new Date().toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    });

    this.activityLog.unshift({ time, text });

    // 保留最近20条
    if (this.activityLog.length > 20) {
      this.activityLog.pop();
    }

    this.ui.updateActivityLog(this.activityLog);
  }

  /**
   * 暂停/继续
   */
  togglePause() {
    this.isPaused = !this.isPaused;
    return this.isPaused;
  }

  /**
   * 设置速度
   */
  setSpeed(speed) {
    this.speed = speed;
  }

  /**
   * 获取所有评论
   */
  getComments() {
    return this.comments;
  }

  /**
   * 获取所有Agent
   */
  getAgents() {
    return this.agents;
  }
}
