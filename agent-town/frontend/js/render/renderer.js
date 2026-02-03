/**
 * 渲染器 - 绘制地图、建筑、角色
 * 原型阶段使用简单图形，后续可替换为精灵图
 */

import { MAP_TILES, MAP_CONFIG, TILE_COLORS, TILE_TYPES, BUILDINGS } from '../data/map.js';
import { AGENT_STATES } from '../engine/agent.js';

export class Renderer {
  constructor(ctx) {
    this.ctx = ctx;
    this.tileSize = MAP_CONFIG.tileSize;
  }

  /**
   * 绘制地图
   */
  drawMap() {
    const ctx = this.ctx;

    for (let y = 0; y < MAP_CONFIG.height; y++) {
      for (let x = 0; x < MAP_CONFIG.width; x++) {
        const tile = MAP_TILES[y][x];
        const color = TILE_COLORS[tile];

        ctx.fillStyle = color;
        ctx.fillRect(
          x * this.tileSize,
          y * this.tileSize,
          this.tileSize,
          this.tileSize
        );

        // 给路径添加边框效果
        if (tile === TILE_TYPES.PATH) {
          ctx.strokeStyle = '#b8a888';
          ctx.lineWidth = 1;
          ctx.strokeRect(
            x * this.tileSize,
            y * this.tileSize,
            this.tileSize,
            this.tileSize
          );
        }

        // 树添加简单的树冠效果
        if (tile === TILE_TYPES.TREE) {
          ctx.fillStyle = '#1a4731';
          ctx.beginPath();
          ctx.arc(
            x * this.tileSize + this.tileSize / 2,
            y * this.tileSize + this.tileSize / 2,
            this.tileSize / 3,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }

        // 花添加点缀
        if (tile === TILE_TYPES.FLOWER) {
          ctx.fillStyle = '#fecdd3';
          ctx.beginPath();
          ctx.arc(
            x * this.tileSize + this.tileSize / 3,
            y * this.tileSize + this.tileSize / 3,
            4,
            0,
            Math.PI * 2
          );
          ctx.fill();

          ctx.fillStyle = '#fda4af';
          ctx.beginPath();
          ctx.arc(
            x * this.tileSize + this.tileSize * 2 / 3,
            y * this.tileSize + this.tileSize * 2 / 3,
            4,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }

        // 水添加波纹效果
        if (tile === TILE_TYPES.WATER) {
          ctx.strokeStyle = '#7dd3fc';
          ctx.lineWidth = 1;
          const time = Date.now() / 1000;
          const offset = Math.sin(time + x + y) * 2;

          ctx.beginPath();
          ctx.moveTo(x * this.tileSize + 4, y * this.tileSize + this.tileSize / 2 + offset);
          ctx.lineTo(x * this.tileSize + this.tileSize - 4, y * this.tileSize + this.tileSize / 2 + offset);
          ctx.stroke();
        }
      }
    }
  }

  /**
   * 绘制建筑物
   */
  drawBuildings() {
    const ctx = this.ctx;

    for (const building of BUILDINGS) {
      const x = building.x * this.tileSize;
      const y = building.y * this.tileSize;
      const width = building.width * this.tileSize;
      const height = building.height * this.tileSize;

      // 建筑阴影
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(x + 4, y + 4, width, height);

      // 建筑主体
      ctx.fillStyle = building.color;
      ctx.fillRect(x, y, width, height);

      // 建筑边框
      ctx.strokeStyle = this.darkenColor(building.color, 30);
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, width, height);

      // 屋顶效果
      ctx.fillStyle = this.darkenColor(building.color, 20);
      ctx.fillRect(x, y, width, 8);

      // 门
      const doorX = building.entranceX * this.tileSize + this.tileSize / 4;
      const doorY = (building.y + building.height - 1) * this.tileSize + this.tileSize / 4;
      ctx.fillStyle = '#4a3728';
      ctx.fillRect(doorX, doorY, this.tileSize / 2, this.tileSize * 3 / 4);

      // 建筑名称
      ctx.fillStyle = '#fff';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        building.name,
        x + width / 2,
        y + height / 2
      );
    }
  }

  /**
   * 绘制Agent
   */
  drawAgent(agent, isHovered = false, isSelected = false) {
    const ctx = this.ctx;
    const x = agent.x;
    const y = agent.y;

    // 阴影
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(x, y + 12, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // 选中高亮
    if (isSelected) {
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, 18, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 悬停高亮
    if (isHovered) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.beginPath();
      ctx.arc(x, y, 16, 0, Math.PI * 2);
      ctx.fill();
    }

    // 身体 (根据状态变化)
    let bodyColor = agent.color;
    if (agent.state === AGENT_STATES.READING) {
      bodyColor = this.lightenColor(agent.color, 20);
    }

    // 绘制像素风格的角色
    this.drawPixelCharacter(x, y, bodyColor, agent.direction, agent.animFrame);

    // 头像emoji
    ctx.font = '16px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(agent.avatar, x, y - 4);

    // 名字 (悬停或选中时显示)
    if (isHovered || isSelected) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(agent.name, x, y + 26);
    }

    // 状态指示器
    this.drawStateIndicator(x, y, agent.state);
  }

  /**
   * 绘制像素风格角色
   */
  drawPixelCharacter(x, y, color, direction, animFrame) {
    const ctx = this.ctx;
    const size = 24;
    const halfSize = size / 2;

    // 身体
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x - halfSize / 2, y - halfSize / 2, halfSize, size * 0.8, 4);
    ctx.fill();

    // 腿 (走路动画)
    const legOffset = Math.sin(animFrame * Math.PI / 2) * 3;
    ctx.fillStyle = this.darkenColor(color, 30);

    // 左腿
    ctx.fillRect(x - 5, y + 8, 4, 8 + (direction === 'down' || direction === 'up' ? legOffset : 0));
    // 右腿
    ctx.fillRect(x + 1, y + 8, 4, 8 - (direction === 'down' || direction === 'up' ? legOffset : 0));
  }

  /**
   * 绘制状态指示器
   */
  drawStateIndicator(x, y, state) {
    const ctx = this.ctx;
    let indicator = '';
    let color = '#4ade80';

    switch (state) {
      case AGENT_STATES.READING:
        indicator = '📖';
        color = '#fbbf24';
        break;
      case AGENT_STATES.THINKING:
        indicator = '💭';
        color = '#818cf8';
        break;
      case AGENT_STATES.CHATTING:
        indicator = '💬';
        color = '#f472b6';
        break;
      case AGENT_STATES.RESTING:
        indicator = '😌';
        color = '#34d399';
        break;
      case AGENT_STATES.WALKING:
        // 走路时不显示指示器
        return;
      default:
        return;
    }

    // 小圆点背景
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + 12, y - 16, 8, 0, Math.PI * 2);
    ctx.fill();

    // emoji
    ctx.font = '10px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(indicator, x + 12, y - 16);
  }

  /**
   * 绘制气泡
   */
  drawBubble(agent) {
    const ctx = this.ctx;
    const text = agent.bubble;
    const x = agent.x;
    const y = agent.y - 40;

    // 测量文本
    ctx.font = '12px sans-serif';
    const metrics = ctx.measureText(text);
    const padding = 8;
    const width = metrics.width + padding * 2;
    const height = 24;

    // 气泡背景
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.beginPath();
    ctx.roundRect(x - width / 2, y - height / 2, width, height, 6);
    ctx.fill();

    // 气泡边框
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 气泡小尖角
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.beginPath();
    ctx.moveTo(x - 5, y + height / 2);
    ctx.lineTo(x, y + height / 2 + 8);
    ctx.lineTo(x + 5, y + height / 2);
    ctx.fill();

    // 文本
    ctx.fillStyle = '#1f2937';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
  }

  /**
   * 颜色变暗
   */
  darkenColor(color, amount) {
    const hex = color.replace('#', '');
    const r = Math.max(0, parseInt(hex.substring(0, 2), 16) - amount);
    const g = Math.max(0, parseInt(hex.substring(2, 4), 16) - amount);
    const b = Math.max(0, parseInt(hex.substring(4, 6), 16) - amount);
    return `rgb(${r}, ${g}, ${b})`;
  }

  /**
   * 颜色变亮
   */
  lightenColor(color, amount) {
    const hex = color.replace('#', '');
    const r = Math.min(255, parseInt(hex.substring(0, 2), 16) + amount);
    const g = Math.min(255, parseInt(hex.substring(2, 4), 16) + amount);
    const b = Math.min(255, parseInt(hex.substring(4, 6), 16) + amount);
    return `rgb(${r}, ${g}, ${b})`;
  }
}
