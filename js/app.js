import Phaser from 'phaser';
import { BootScene } from './game/scenes/BootScene';
import { MenuScene } from './game/scenes/MenuScene';
import { WorldScene } from './game/scenes/WorldScene';
import { BattleScene } from './game/scenes/BattleScene';
import { UIScene } from './game/scenes/UIScene';

const config = {
  type: Phaser.AUTO,
  backgroundColor: '#1a0f05',
  scene: [BootScene, MenuScene, WorldScene, BattleScene, UIScene],
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 }, debug: false },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    parent: 'game-container',
    width: 1280,
    height: 720,
  },
  render: {
    pixelArt: false,
    antialias: true,
  },
};

new Phaser.Game(config);