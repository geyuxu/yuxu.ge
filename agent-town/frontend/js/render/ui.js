/**
 * UI管理器 - 处理DOM交互
 */

export class UI {
  constructor(game) {
    this.game = game;

    // DOM元素
    this.agentList = document.getElementById('agent-list');
    this.activityLog = document.getElementById('activity-log');
    this.tooltip = document.getElementById('agent-tooltip');
    this.commentsModal = document.getElementById('comments-modal');
    this.commentsList = document.getElementById('comments-list');

    // 控制按钮
    this.btnPause = document.getElementById('btn-pause');
    this.btnSpeed = document.getElementById('btn-speed');
    this.btnComments = document.getElementById('btn-comments');

    this.currentSpeed = 1;
  }

  /**
   * 初始化UI
   */
  init() {
    this.renderAgentList();
    this.bindControlEvents();
  }

  /**
   * 渲染Agent列表
   */
  renderAgentList() {
    const agents = this.game.getAgents();
    this.agentList.innerHTML = '';

    for (const agent of agents) {
      const chip = document.createElement('div');
      chip.className = 'agent-chip';
      chip.dataset.agentId = agent.id;

      chip.innerHTML = `
        <span class="avatar">${agent.avatar}</span>
        <span class="name">${agent.name}</span>
        <span class="status" data-agent-status="${agent.id}"></span>
      `;

      // 点击查看详情
      chip.addEventListener('click', () => {
        this.showAgentDetail(agent);
      });

      // 悬停显示tooltip
      chip.addEventListener('mouseenter', (e) => {
        this.showTooltip(agent, e);
      });

      chip.addEventListener('mouseleave', () => {
        this.hideTooltip();
      });

      this.agentList.appendChild(chip);
    }

    // 定期更新状态指示器
    setInterval(() => this.updateAgentStatuses(), 500);
  }

  /**
   * 更新Agent状态指示器
   */
  updateAgentStatuses() {
    const agents = this.game.getAgents();
    for (const agent of agents) {
      const statusEl = document.querySelector(`[data-agent-status="${agent.id}"]`);
      if (statusEl) {
        statusEl.className = `status ${agent.state}`;
      }
    }
  }

  /**
   * 显示Tooltip
   */
  showTooltip(agent, event) {
    const tooltip = this.tooltip;

    tooltip.querySelector('.tooltip-avatar').textContent = agent.avatar;
    tooltip.querySelector('.tooltip-name').textContent = agent.name;
    tooltip.querySelector('.tooltip-desc').textContent = agent.description;
    tooltip.querySelector('.tooltip-stats').textContent =
      `📖 已读: ${agent.stats.postsRead} | ✍️ 评论: ${agent.stats.comments}`;

    // 定位
    const rect = event.target.getBoundingClientRect();
    tooltip.style.left = `${rect.left}px`;
    tooltip.style.top = `${rect.bottom + 8}px`;

    tooltip.classList.remove('hidden');
  }

  /**
   * 隐藏Tooltip
   */
  hideTooltip() {
    this.tooltip.classList.add('hidden');
  }

  /**
   * 显示Agent详情
   */
  showAgentDetail(agent) {
    // 可以用modal显示详细信息
    console.log('Show detail for:', agent.name);

    // 暂时用alert
    const info = `
${agent.avatar} ${agent.name}

${agent.description}

📊 性格特点:
- 好奇心: ${(agent.traits.curiosity * 100).toFixed(0)}%
- 深度: ${(agent.traits.depth * 100).toFixed(0)}%
- 幽默: ${(agent.traits.humor * 100).toFixed(0)}%
- 批判性: ${(agent.traits.criticism * 100).toFixed(0)}%
- 同理心: ${(agent.traits.empathy * 100).toFixed(0)}%

💬 评论风格: ${agent.commentStyle}

📈 统计:
- 已读文章: ${agent.stats.postsRead}
- 发表评论: ${agent.stats.comments}
    `.trim();

    alert(info);
  }

  /**
   * 更新活动日志
   */
  updateActivityLog(logs) {
    this.activityLog.innerHTML = '';

    for (const log of logs) {
      const item = document.createElement('div');
      item.className = 'activity-item';
      item.innerHTML = `
        <span class="activity-time">${log.time}</span>
        <span class="activity-text">${log.text}</span>
      `;
      this.activityLog.appendChild(item);
    }
  }

  /**
   * 绑定控制按钮事件
   */
  bindControlEvents() {
    // 暂停按钮
    this.btnPause.addEventListener('click', () => {
      const isPaused = this.game.togglePause();
      this.btnPause.textContent = isPaused ? '▶️' : '⏸️';
    });

    // 速度按钮
    this.btnSpeed.addEventListener('click', () => {
      const speeds = [1, 2, 4];
      const currentIndex = speeds.indexOf(this.currentSpeed);
      this.currentSpeed = speeds[(currentIndex + 1) % speeds.length];
      this.game.setSpeed(this.currentSpeed);
      this.btnSpeed.textContent = `⏩ ${this.currentSpeed}x`;
    });

    // 评论按钮
    this.btnComments.addEventListener('click', () => {
      this.showCommentsModal();
    });

    // 关闭Modal
    this.commentsModal.querySelector('.modal-close').addEventListener('click', () => {
      this.commentsModal.classList.add('hidden');
    });

    // 点击背景关闭
    this.commentsModal.addEventListener('click', (e) => {
      if (e.target === this.commentsModal) {
        this.commentsModal.classList.add('hidden');
      }
    });
  }

  /**
   * 显示评论Modal
   */
  showCommentsModal() {
    const comments = this.game.getComments();
    const agents = this.game.getAgents();

    this.commentsList.innerHTML = '';

    for (const comment of comments) {
      const agent = agents.find(a => a.id === comment.agentId);
      if (!agent) continue;

      const timeStr = new Date(comment.timestamp).toLocaleString('zh-CN');

      const item = document.createElement('div');
      item.className = 'comment-item';
      item.innerHTML = `
        <div class="comment-header">
          <span class="comment-avatar">${agent.avatar}</span>
          <div class="comment-meta">
            <div class="comment-author">${agent.name}</div>
            <div class="comment-post">评论《${comment.postTitle}》</div>
          </div>
        </div>
        <div class="comment-text">${comment.text}</div>
        <div class="comment-time">${timeStr}</div>
      `;

      this.commentsList.appendChild(item);
    }

    this.commentsModal.classList.remove('hidden');
  }
}
