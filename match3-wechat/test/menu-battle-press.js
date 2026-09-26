'use strict';

const assert = require('assert');
const Main = require('../js/main');
const UI = require('../js/render/ui');
const AudioFX = require('../js/audio');

AudioFX.unlock = () => {};
AudioFX.click = () => {};

function fixture() {
    const app = Object.create(Main.prototype);
    app.state = 'menu';
    app.runtimeState = 'menu';
    app.screen = { width: 320, height: 568, reduceEffects: false };
    app.menuButtons = { battle: { x: 50, y: 250, w: 220, h: 66 } };
    app.handleGuideTouch = () => false;
    app.handleStaminaDialogTouch = () => false;
    let starts = 0;
    app.startBattle = () => { starts++; };
    return { app, starts: () => starts };
}

const touch = { touches: [{ clientX: 160, clientY: 280 }] };
const normal = fixture();
normal.app.handleTouchStart(touch);
assert(normal.app.menuBattlePress, 'battle tap starts visible feedback');
normal.app.handleTouchStart(touch);
normal.app.update(80);
assert.strictEqual(normal.starts(), 0, 'action waits for the press frame');
assert(normal.app.menuBattlePress.elapsed === 80);
normal.app.update(80);
assert.strictEqual(normal.starts(), 1, 'battle starts once');
assert.strictEqual(normal.app.menuBattlePress, null);
normal.app.update(200);
assert.strictEqual(normal.starts(), 1);

const interrupted = fixture();
interrupted.app.handleTouchStart(touch);
interrupted.app.state = 'settings';
interrupted.app.update(200);
assert.strictEqual(interrupted.starts(), 0, 'navigation cancels pending battle');
assert.strictEqual(interrupted.app.menuBattlePress, null);

const backgrounded = fixture();
backgrounded.app.handleTouchStart(touch);
backgrounded.app.handleHide();
backgrounded.app.update(200);
assert.strictEqual(backgrounded.starts(), 0, 'backgrounding cancels pending battle');

const scales = [];
const context = new Proxy({}, { get(target, key) {
    if (key === 'scale') return (scaleX, scaleY) => scales.push([scaleX, scaleY]);
    if (key === 'measureText') return text => ({ width: String(text).length * 8 });
    if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => ({ addColorStop() {} });
    return () => {};
} });
const screen = { width: 320, height: 568, safeTop: 20, contentTop: 76, reduceEffects: false };
const heart = { count: 5, canPlay: true, timeLeftText: '00:00' };
UI.drawMenu(context, screen, 1, heart, { coins: 0 });
const baselineScales = scales.splice(0);
UI.drawMenu(context, screen, 1, heart, { coins: 0, battlePress: 1 });
assert.strictEqual(scales.length, baselineScales.length + 1, 'only the battle button adds a transform');
assert(scales.some(pair => pair[0] === 0.985 && pair[1] === 0.945));

console.log('menu battle press feedback: ok');
