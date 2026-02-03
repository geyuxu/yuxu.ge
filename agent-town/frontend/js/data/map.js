/**
 * 地图数据
 * 20x15 瓦片, 每个瓦片 32x32 像素
 * 总大小: 640x480
 */

// 瓦片类型
export const TILE_TYPES = {
  GRASS: 0,
  PATH: 1,
  WATER: 2,
  TREE: 3,
  FLOWER: 4,
  STONE: 5
};

// 瓦片颜色 (原型阶段用颜色代替素材)
export const TILE_COLORS = {
  [TILE_TYPES.GRASS]: '#4a7c59',
  [TILE_TYPES.PATH]: '#c9b896',
  [TILE_TYPES.WATER]: '#5d93b7',
  [TILE_TYPES.TREE]: '#2d5a3f',
  [TILE_TYPES.FLOWER]: '#e88d9e',
  [TILE_TYPES.STONE]: '#7a7d82'
};

// 建筑物定义
export const BUILDINGS = [
  {
    id: 'library',
    name: '📚 图书馆',
    x: 2,  // 瓦片坐标
    y: 5,
    width: 3,
    height: 2,
    color: '#8b4513',
    entranceX: 3,
    entranceY: 7,
    action: 'reading'
  },
  {
    id: 'cafe',
    name: '☕ 咖啡馆',
    x: 8,
    y: 2,
    width: 3,
    height: 2,
    color: '#d4a574',
    entranceX: 9,
    entranceY: 4,
    action: 'thinking'
  },
  {
    id: 'plaza',
    name: '🏛️ 广场',
    x: 14,
    y: 5,
    width: 4,
    height: 3,
    color: '#9ca3af',
    entranceX: 16,
    entranceY: 8,
    action: 'chatting'
  },
  {
    id: 'fountain',
    name: '⛲ 喷泉',
    x: 9,
    y: 7,
    width: 2,
    height: 2,
    color: '#60a5fa',
    entranceX: 10,
    entranceY: 9,
    action: 'resting'
  },
  {
    id: 'park',
    name: '🌳 公园',
    x: 2,
    y: 10,
    width: 4,
    height: 3,
    color: '#22c55e',
    entranceX: 4,
    entranceY: 10,
    action: 'walking'
  },
  {
    id: 'gallery',
    name: '🎨 画廊',
    x: 14,
    y: 10,
    width: 3,
    height: 2,
    color: '#f472b6',
    entranceX: 15,
    entranceY: 12,
    action: 'thinking'
  }
];

// 地图瓦片数据 (20x15)
// 0=草地, 1=路, 2=水, 3=树, 4=花, 5=石头
export const MAP_TILES = [
  [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  [3, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 3],
  [3, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 3],
  [3, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 3],
  [3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3],
  [3, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 3],
  [3, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 3],
  [3, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 3],
  [3, 0, 4, 4, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 3],
  [3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3],
  [3, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 3],
  [3, 0, 0, 0, 0, 0, 0, 1, 0, 2, 2, 0, 1, 0, 0, 0, 0, 0, 0, 3],
  [3, 0, 0, 0, 0, 0, 0, 1, 0, 2, 2, 0, 1, 0, 0, 0, 0, 0, 0, 3],
  [3, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 3],
  [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3]
];

// 地图配置
export const MAP_CONFIG = {
  tileSize: 32,
  width: 20,
  height: 15,
  pixelWidth: 640,
  pixelHeight: 480
};

// 判断某个瓦片是否可行走
export function isWalkable(tileX, tileY) {
  if (tileX < 0 || tileX >= MAP_CONFIG.width || tileY < 0 || tileY >= MAP_CONFIG.height) {
    return false;
  }

  const tile = MAP_TILES[tileY][tileX];

  // 树和水不能走
  if (tile === TILE_TYPES.TREE || tile === TILE_TYPES.WATER) {
    return false;
  }

  // 检查是否在建筑物内
  for (const building of BUILDINGS) {
    if (tileX >= building.x && tileX < building.x + building.width &&
        tileY >= building.y && tileY < building.y + building.height) {
      return false;
    }
  }

  return true;
}

// 获取随机可行走的位置
export function getRandomWalkablePosition() {
  let attempts = 0;
  while (attempts < 100) {
    const tileX = Math.floor(Math.random() * MAP_CONFIG.width);
    const tileY = Math.floor(Math.random() * MAP_CONFIG.height);

    if (isWalkable(tileX, tileY)) {
      return {
        x: tileX * MAP_CONFIG.tileSize + MAP_CONFIG.tileSize / 2,
        y: tileY * MAP_CONFIG.tileSize + MAP_CONFIG.tileSize / 2
      };
    }
    attempts++;
  }

  // 默认位置
  return { x: 240, y: 144 };
}

// 获取建筑物
export function getBuilding(id) {
  return BUILDINGS.find(b => b.id === id);
}

// 获取随机建筑物
export function getRandomBuilding() {
  return BUILDINGS[Math.floor(Math.random() * BUILDINGS.length)];
}
