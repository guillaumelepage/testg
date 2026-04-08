import Phaser from 'phaser';
import { BootScene } from './game/scenes/BootScene';
import { MenuScene } from './game/scenes/MenuScene';
import { WorldScene } from './game/scenes/WorldScene';
import { BattleScene } from './game/scenes/BattleScene';
import { UIScene } from './game/scenes/UIScene';

// Cap DPR at 2 for performance (phones are often 3×, overkill for a canvas game)
const DPR = Math.min(window.devicePixelRatio || 1, 2);

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
    zoom: DPR,        // canvas renders at native device resolution → no blur
  },
  render: {
    pixelArt: false,
    antialias: true,
    antialiasGL: true,
  },
};

new Phaser.Game(config);