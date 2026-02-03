/**
 * Agent Town - 主入口
 * AI虚拟人小镇模拟器
 */

import { Game } from './engine/game.js';

// 等待DOM加载完成
document.addEventListener('DOMContentLoaded', () => {
  console.log('🏘️ Agent Town 正在启动...');

  // 获取Canvas
  const canvas = document.getElementById('game-canvas');
  if (!canvas) {
    console.error('Canvas not found!');
    return;
  }

  // 创建游戏实例
  const game = new Game(canvas);

  // 启动游戏
  game.start();

  console.log('✅ Agent Town 已启动!');
  console.log('📊 8个AI居民已就位');

  // 暴露到全局，方便调试
  window.agentTown = game;
});
