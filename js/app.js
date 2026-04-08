import Phaser from 'phaser';
import { BootScene } from './game/scenes/BootScene';
import { MenuScene } from './game/scenes/MenuScene';
import { WorldScene } from './game/scenes/WorldScene';
import { BattleScene } from './game/scenes/BattleScene';
import { UIScene } from './game/scenes/UIScene';

// Render at the device's native CSS resolution → no letterbox bars on any screen.
// Zoom = DPR (capped at 2) so the canvas backing store is at native device pixels → no blur.
const DPR = Math.min(window.devicePixelRatio || 1, 2);
const W   = window.innerWidth;
const H   = window.innerHeight;

const config = {
  type: Phaser.AUTO,
  backgroundColor: '#1a0f05',
  scene: [BootScene, MenuScene, WorldScene, BattleScene, UIScene],
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 }, debug: false },
  },
  scale: {
    mode: Phaser.Scale.RESIZE,   // canvas always fills the container exactly
    autoCenter: Phaser.Scale.NO_CENTER,
    parent: 'game-container',
    width: W,
    height: H,
    zoom: DPR,
  },
  render: {
    pixelArt: false,
    antialias: true,
    antialiasGL: true,
  },
};

new Phaser.Game(config);