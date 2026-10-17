// Capture actual Main/Core/Board motion after a pointer exchange; no fake hits or clocks.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const base = new URL(process.argv[2]);
assert(['127.0.0.1', 'localhost'].includes(base.hostname));
const clarity = process.argv.includes('--clarity');
const output = path.resolve(__dirname, '../assets/_incoming/new-obstacles-20261002/' + (clarity ? 'clarity' : 'motion'));

(async () => {
    fs.mkdirSync(output, { recursive: true });
    const browser = await chromium.launch({
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true
    });
    const errors = [], results = [];
    try {
        for (const width of [320, 390, 430]) {
            const page = await browser.newPage({ viewport: { width: width + 40, height: 1200 } });
            page.on('pageerror', error => errors.push(error.message));
            await page.goto(base.href + '?preview=content&obstacles=1&width=' + width);
            await page.waitForFunction(() => window.previewObstacle && previewApp.board.pieces.length === 64 &&
                !!load('js/render/assets.js').get('piece1'));
            if (clarity) await page.evaluate(() => {
                const context = document.querySelector('canvas').getContext('2d');
                const fillText = context.fillText.bind(context);
                window.moonbudFrameText = [];
                context.fillText = (text, ...args) => {
                    if (window.captureMoonbudMotion) moonbudFrameText.push(String(text));
                    return fillText(text, ...args);
                };
            });
            if (width === 390) await page.evaluate(() => {
                // Native Canvas capture avoids downloading a separate video encoder.
                const stream = document.querySelector('canvas').captureStream(30);
                window.moonbudRecordedChunks = [];
                window.moonbudRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
                moonbudRecorder.ondataavailable = event => moonbudRecordedChunks.push(event.data);
                moonbudRecorder.start();
            });
            for (const reduced of width === 320 ? [false, true] : [false]) {
                await page.locator('#obstacle-reduced').setChecked(reduced);
                for (const kind of ['moonbud', 'moonbud-closed']) {
                    await page.locator('[data-obstacle="' + kind + '"]').click();
                    const suffix = kind + '-' + width + (reduced ? '-reduced' : '');
                    await page.locator('canvas').screenshot({ path: path.join(output, suffix + '-before.png') });
                    await page.evaluate(() => {
                        window.moonbudMotionFrames = [];
                        window.captureMoonbudMotion = true;
                        const sample = () => {
                            if (!window.captureMoonbudMotion) return;
                            const b = previewApp.board;
                            moonbudMotionFrames.push({ at: performance.now(),
                                effects: b.moonbudEffects.map(effect => ({ ...effect })),
                                feedback: b.moonbudFeedback ? { ...b.moonbudFeedback } : null,
                                text: [...new Set(window.moonbudFrameText || [])],
                                visualOpen: b.visualMoonbudOpen,
                                remaining: Object.keys(b.visualMoonbuds).length,
                                processing: previewApp.core.processing });
                            window.moonbudFrameText = [];
                            requestAnimationFrame(sample);
                        };
                        requestAnimationFrame(sample);
                    });
                    const points = await page.evaluate(() => previewObstacleExchange.map(pos =>
                        previewApp.board.pieceCenter(pos.row, pos.column)));
                    const bounds = await page.locator('canvas').boundingBox();
                    await page.mouse.move(bounds.x + points[0].x, bounds.y + points[0].y);
                    await page.mouse.down();
                    await page.mouse.move(bounds.x + points[1].x, bounds.y + points[1].y, { steps: 4 });
                    await page.mouse.up();
                    if (kind === 'moonbud') {
                        await page.waitForFunction(() => previewApp.board.moonbudEffects.some(effect =>
                            effect.kind === 'collect' && effect.elapsed >= effect.duration * 0.2));
                        await page.locator('canvas').screenshot({ path: path.join(output, suffix + '-collect.png') });
                    } else if (clarity) {
                        await page.waitForFunction(() => previewApp.board.moonbudEffects.some(effect =>
                            effect.kind === 'closedHit' && effect.elapsed >= effect.duration * 0.2));
                        await page.locator('canvas').screenshot({ path: path.join(output, suffix + '-closed-hit.png') });
                    }
                    await page.waitForFunction(() => previewApp.board.moonbudEffects.some(effect =>
                        effect.kind === 'phase' && effect.elapsed >= effect.duration * 0.3));
                    await page.locator('canvas').screenshot({ path: path.join(output, suffix + '-phase.png') });
                    await page.waitForFunction(() => previewApp.core.movesLeft === 24 && !previewApp.core.processing &&
                        previewApp.board.moonbudEffects.length === 0);
                    const snapshot = await page.evaluate(() => {
                        window.captureMoonbudMotion = false;
                        const c = previewApp.core, b = previewApp.board;
                        return { frames: moonbudMotionFrames, moves: c.movesLeft, open: c.moonbudOpen,
                            remaining: c.getMoonbudsLeft(), visualOpen: b.visualMoonbudOpen,
                            visualRemaining: Object.keys(b.visualMoonbuds).length };
                    });
                    const phases = snapshot.frames.flatMap(frame => frame.effects.filter(effect => effect.kind === 'phase'));
                    const collections = snapshot.frames.flatMap(frame => frame.effects.filter(effect => effect.kind === 'collect'));
                    assert(phases.length > 2, 'phase lasts for multiple real frames');
                    assert(phases.some(effect => effect.elapsed > effect.duration * 0.25 && effect.elapsed < effect.duration * 0.85));
                    assert(phases.every(effect => effect.duration === (reduced ? 160 : 500)));
                    assert.strictEqual(snapshot.open, kind === 'moonbud-closed');
                    assert.strictEqual(snapshot.remaining, kind === 'moonbud' ? 1 : 2);
                    assert.strictEqual(snapshot.visualOpen, snapshot.open);
                    assert.strictEqual(snapshot.visualRemaining, snapshot.remaining);
                    if (kind === 'moonbud') {
                        assert(collections.length > 2, 'collection remains visible over multiple frames');
                        assert(collections.every(effect => effect.duration === (reduced ? 160 : 360)));
                        assert(snapshot.frames.filter(frame => frame.effects.some(effect => effect.kind === 'collect'))
                            .every(frame => frame.remaining === 1), 'collection starts after real hit/HUD update');
                    } else {
                        assert.strictEqual(collections.length, 0, 'closed phase never collects');
                        if (clarity) {
                            const feedbackFrames = snapshot.frames.filter(frame => frame.effects.some(effect => effect.kind === 'closedHit'));
                            assert(feedbackFrames.length > 2, 'closed real hit has visible feedback across frames');
                            assert(feedbackFrames.every(frame => frame.remaining === 2 && frame.feedback && frame.feedback.kind === 'closedHit'));
                            assert(snapshot.frames.some(frame => frame.text.some(text => /猫已消除.*花苞保留/.test(text))),
                                'real Canvas HUD explains the retained flower');
                            assert(snapshot.frames.some(frame => frame.text.includes('合')));
                            assert(snapshot.frames.some(frame => frame.text.includes('开')));
                        }
                    }
                    if (clarity) {
                        assert(snapshot.frames.some(frame => frame.text.some(text => /开放.*可收花/.test(text))));
                        assert(snapshot.frames.some(frame => frame.text.some(text => /闭合.*花苞保留/.test(text))));
                    }
                    assert(snapshot.frames.some(frame => !frame.processing && frame.effects.some(effect => effect.kind === 'phase')),
                        'visual tail continues after existing operation wait');
                    await page.locator('canvas').screenshot({ path: path.join(output, suffix + '-after.png') });
                    results.push({ width, reduced, kind, ...snapshot });
                }
            }
            if (width === 390) {
                const video = await page.evaluate(() => new Promise(resolve => {
                    moonbudRecorder.onstop = async () => {
                        const bytes = new Uint8Array(await new Blob(moonbudRecordedChunks).arrayBuffer());
                        let binary = '';
                        for (let offset = 0; offset < bytes.length; offset += 32768) {
                            binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
                        }
                        moonbudRecorder.stream.getTracks().forEach(track => track.stop());
                        resolve(btoa(binary));
                    };
                    moonbudRecorder.stop();
                }));
                fs.writeFileSync(path.join(output, clarity ? 'moonbud-clarity-390.webm' : 'moonbud-motion-390.webm'), Buffer.from(video, 'base64'));
            }
            if (clarity) {
                await page.locator('[data-obstacle="moonbud-closed"]').click();
                await page.locator('#obstacle-guide').click();
                await page.waitForFunction(() => !!previewApp.guide);
                await page.locator('canvas').screenshot({ path: path.join(output, 'moonbud-guide-' + width + '.png') });
                const confirm = await page.evaluate(() => previewApp.guideButtons.confirm);
                const bounds = await page.locator('canvas').boundingBox();
                await page.mouse.click(bounds.x + confirm.x + confirm.w / 2, bounds.y + confirm.y + confirm.h / 2);
                await page.waitForFunction(() => !previewApp.guide);
                assert.strictEqual(await page.evaluate(() => previewApp.core.movesLeft), 25);
                await page.goto(base.href + '?preview=content&obstacles=1&obstacleHud=timed-mixed&case=moonbud-closed&width=' + width);
                await page.waitForFunction(() => previewApp.core && previewApp.core.level.goals.length === 3 &&
                    previewApp.board.pieces.length === 64 && !!load('js/render/assets.js').get('piece1'));
                assert(await page.evaluate(() => previewApp.core.timeLeftMs > 0));
                await page.locator('canvas').screenshot({ path: path.join(output, 'moonbud-timed-mixed-' + width + '.png') });
            }
            await page.close();
        }
        assert.deepStrictEqual(errors, []);
        fs.writeFileSync(path.join(output, 'browser-motion-evidence.json'), JSON.stringify({ fixture: base.href,
            scenarios: results, errors, boundary: 'Real pointer exchanges and requestAnimationFrame samples. Local fixed board; no device or production-level acceptance.' }, null, 2) + '\n');
        console.log(JSON.stringify({ result: 'PASS', scenarios: results.length, widths: [320, 390, 430], errors, output }));
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
