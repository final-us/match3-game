'use strict';
const assert = require('assert');
const assets = require('../js/render/assets');
const art = require('../js/render/illustration-art');
const original = assets.get;
const calls = [], ctx = { drawImage(...args) { calls.push(args); } };
try {
    assets.get = () => undefined;
    assert.strictEqual(art.drawItem(ctx, 'freeze', 1, 2, 30), false);
    assert.strictEqual(art.drawChest(ctx, 0, 1, 2, 30), false);
    assert.strictEqual(art.drawFrame(ctx, 1, 2, 300, 600), false);
    assert.strictEqual(calls.length, 0, 'unavailable art must leave fallback choice to caller');
    for (const cell of [192, 256]) {
        const items = { width: cell * 4, height: cell * 2 }, chests = { width: cell * 3, height: cell };
        const frame = { width: 640, height: 832 };
        assets.get = key => ({ uiIllustrationItems: items, uiIllustrationChests: chests, uiResultFrame: frame })[key];
        ['freeze', 'disturb', 'reflect', 'cheer', 'hammer', 'bomb', 'color'].forEach((key, index) => {
            assert.strictEqual(art.drawItem(ctx, key, 10, 20, 40), true);
            assert.deepStrictEqual(calls.pop(), [items, index % 4 * cell, Math.floor(index / 4) * cell, cell, cell, 10, 20, 40, 40]);
        });
        for (let index = 0; index < 3; index++) {
            assert.strictEqual(art.drawChest(ctx, index, 10, 20, 40), true);
            assert.deepStrictEqual(calls.pop(), [chests, index * cell, 0, cell, cell, 10, 20, 40, 40]);
        }
        assert.strictEqual(art.drawItem(ctx, 'missing', 0, 0, 40), false);
        assert.strictEqual(art.drawChest(ctx, 3, 0, 0, 40), false);
        assert.strictEqual(art.drawChest(ctx, .5, 0, 0, 40), false);
        for (const [width, height] of [[280, 220], [340, 700]]) {
            assert.strictEqual(art.drawFrame(ctx, 10, 20, width, height), true);
            const slices = calls.splice(0);
            assert.strictEqual(slices.length, 9);
            for (const args of slices) {
                assert(args[7] > 0 && args[8] > 0);
                assert(args[5] >= 10 && args[6] >= 20);
                assert(args[5] + args[7] <= 10 + width + 1e-9);
                assert(args[6] + args[8] <= 20 + height + 1e-9);
            }
            const area = slices.reduce((sum, args) => sum + args[7] * args[8], 0);
            assert(Math.abs(area - width * height) < 1e-6, 'nine slices cover frame exactly');
        }
    }
    console.log('illustration-art: atlas crops, missing art, nine-slice bounds passed');
} finally { assets.get = original; }
