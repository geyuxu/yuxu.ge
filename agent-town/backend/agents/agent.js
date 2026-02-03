/**
 * Agent Class - Represents a virtual person in the town
 */

import { getRandomActivity, generateCommentPrompt } from './personalities.js';

export class Agent {
  constructor(personality, worldSize = { width: 800, height: 600 }) {
    this.id = personality.id;
    this.name = personality.name;
    this.avatar = personality.avatar;
    this.color = personality.color;
    this.traits = personality.traits;
    this.description = personality.description;
    this.commentStyle = personality.commentStyle;
    this.promptPrefix = personality.promptPrefix;

    // Position in the world (pixels)
    this.x = Math.random() * (worldSize.width - 100) + 50;
    this.y = Math.random() * (worldSize.height - 100) + 50;

    // Movement
    this.targetX = this.x;
    this.targetY = this.y;
    this.speed = 1 + Math.random() * 0.5;
    this.direction = Math.random() * Math.PI * 2;

    // State
    this.currentActivity = 'walking';
    this.activityTimer = 0;
    this.isBusy = false;

    // Memory
    this.memory = [];
    this.readPosts = new Set();
    this.comments = [];

    // World reference
    this.worldSize = worldSize;
  }

  // Update agent state
  update(deltaTime) {
    this.activityTimer -= deltaTime;

    if (this.activityTimer <= 0 && !this.isBusy) {
      this.chooseNewActivity();
    }

    // Move towards target
    if (this.currentActivity === 'walking') {
      this.move(deltaTime);
    }
  }

  // Choose a new activity based on personality
  chooseNewActivity() {
    this.currentActivity = getRandomActivity(this);
    this.activityTimer = 3000 + Math.random() * 5000; // 3-8 seconds

    if (this.currentActivity === 'walking') {
      this.setNewTarget();
    }
  }

  // Set a new movement target
  setNewTarget() {
    // Prefer staying near certain areas based on personality
    const margin = 50;
    this.targetX = margin + Math.random() * (this.worldSize.width - margin * 2);
    this.targetY = margin + Math.random() * (this.worldSize.height - margin * 2);
  }

  // Move towards target
  move(deltaTime) {
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 2) {
      const moveAmount = this.speed * deltaTime * 0.05;
      this.x += (dx / distance) * moveAmount;
      this.y += (dy / distance) * moveAmount;
      this.direction = Math.atan2(dy, dx);
    } else {
      // Reached target, wait a bit
      this.currentActivity = 'idle';
      this.activityTimer = 1000 + Math.random() * 2000;
    }
  }

  // Start reading a blog post
  async startReading(blogPost) {
    if (this.readPosts.has(blogPost.slug)) {
      return null; // Already read
    }

    this.isBusy = true;
    this.currentActivity = 'reading';
    this.readPosts.add(blogPost.slug);

    // Simulate reading time based on curiosity
    const readingTime = 2000 + (1 - this.traits.curiosity) * 3000;
    await this.wait(readingTime);

    this.memory.push({
      type: 'read',
      post: blogPost.slug,
      title: blogPost.title,
      timestamp: Date.now()
    });

    this.isBusy = false;
    return blogPost;
  }

  // Generate a comment for a blog post
  getCommentPrompt(blogPost) {
    return generateCommentPrompt(this, blogPost);
  }

  // Save a comment
  saveComment(blogPost, commentText) {
    const comment = {
      agentId: this.id,
      agentName: this.name,
      avatar: this.avatar,
      postSlug: blogPost.slug,
      postTitle: blogPost.title,
      text: commentText,
      timestamp: Date.now()
    };

    this.comments.push(comment);
    this.memory.push({
      type: 'comment',
      post: blogPost.slug,
      comment: commentText,
      timestamp: Date.now()
    });

    return comment;
  }

  // Utility: wait
  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get agent state for frontend
  getState() {
    return {
      id: this.id,
      name: this.name,
      avatar: this.avatar,
      color: this.color,
      x: Math.round(this.x),
      y: Math.round(this.y),
      direction: this.direction,
      activity: this.currentActivity,
      description: this.description,
      traits: this.traits,
      recentComments: this.comments.slice(-3),
      stats: {
        postsRead: this.readPosts.size,
        commentsWritten: this.comments.length
      }
    };
  }

  // Get full profile for display
  getProfile() {
    return {
      ...this.getState(),
      commentStyle: this.commentStyle,
      allComments: this.comments,
      memory: this.memory.slice(-20)
    };
  }
}

export default Agent;
