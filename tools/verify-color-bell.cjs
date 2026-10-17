const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const base = new URL(process.argv[2]);
assert(['127.0.0.1', 'localhost'].includes(base.hostname));
const output = path.resolve(__dirname, '../assets/_incoming/new-specials-20260930');

(async function () {
    fs.mkdirSync(output, { recursive: true });
    const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
    const errors = [];
    const summaries = [];
    try {
        for (const width of [320, 390, 430]) {
            const page = await browser.newPage({ viewport: { width: width + 40, height: 1400 } });
            page.on('pageerror', error => errors.push(error.message));
            await page.goto(base.href + '?preview=content&specials=1&width=' + width + '&level=3');
            await page.waitForFunction(() => window.previewBell && previewApp.guideButtons &&
                !!load('js/render/assets.js').get('piece1'));
            async function confirm() {
                while (await page.evaluate(() => !!previewApp.guide)) {
                    const button = await page.evaluate(() => previewApp.guideButtons.confirm);
                    const canvas = await page.locator('canvas').boundingBox();
                    await page.mouse.click(canvas.x + button.x + button.w / 2, canvas.y + button.y + button.h / 2);
                    await page.waitForTimeout(40);
                }
            }
            for (const level of [3, 5]) {
                await page.locator('#level').selectOption(String(level));
                await page.locator('#start-content').click();
                await page.waitForTimeout(60);
                const intro = await page.evaluate(() => ({ guide: previewApp.guide.key, grid: previewApp.core.grid,
                    initial: previewApp.core.level.initialSpecials[0], paused: previewApp.core.timerPaused }));
                assert.strictEqual(intro.guide, level === 3 ? 'tracking_paw' : 'color_bell');
                assert.strictEqual(intro.grid[intro.initial.row][intro.initial.column], level === 3 ? 105 : 106);
                assert(intro.paused);
                await page.locator('canvas').screenshot({ path: path.join(output, 'intro-' + level + '-' + width + '.png') });
                await confirm();
                assert.strictEqual(await page.evaluate(() => previewApp.core.timerPaused), false);
                await page.locator('canvas').screenshot({ path: path.join(output, 'level-' + level + '-' + width + '.png') });
                summaries.push({ width, level, guide: intro.guide, guaranteed: intro.initial.type });
            }
            async function exchange() {
                const points = await page.evaluate(() => previewPawExchange.map(position =>
                    previewApp.board.pieceCenter(position.row, position.column)));
                const canvas = await page.locator('canvas').boundingBox();
                await page.mouse.move(canvas.x + points[0].x, canvas.y + points[0].y);
                await page.mouse.down();
                await page.mouse.move(canvas.x + points[1].x, canvas.y + points[1].y, { steps: 4 });
                await page.mouse.up();
            }
            if (width === 390) await page.evaluate(() => {
                const stream = document.querySelector('canvas').captureStream(30);
                const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
                window.bellRecording = { recorder, chunks: [], stream };
                recorder.ondataavailable = event => bellRecording.chunks.push(event.data);
                recorder.start();
            });
            for (const kind of ['create', 'dye', 'rocket', 'ball', 'blocked', 'chain']) {
                await page.locator('[data-bell="' + kind + '"]').click();
                const movesBefore = await page.evaluate(() => previewApp.core.movesLeft);
                if (width === 390 || kind === 'create') await page.locator('canvas').screenshot({ path: path.join(output, kind + '-before-' + width + '.png') });
                await exchange();
                await page.waitForFunction(moves => previewApp.core.movesLeft === moves, movesBefore - 1);
                if (width === 390 && kind !== 'create') {
                    await page.waitForFunction(() => previewApp.board.specialEffects.some(effect =>
                        effect.type === 106 && effect.life / effect.maxLife >= 0.25 && effect.life / effect.maxLife < 0.75));
                    await page.locator('canvas').screenshot({ path: path.join(output, kind + '-wave-' + width + '.png') });
                }
                await page.waitForFunction(() => previewBellEvents.length && !previewApp.core.processing);
                const result = await page.evaluate(() => ({ events: previewBellEvents, grid: previewApp.core.grid,
                    moves: previewApp.core.movesLeft, guide: previewApp.guide,
                    visual: previewApp.board.pieces.map(piece => ({ row: piece.row, column: piece.col, type: piece.type })) }));
                assert.strictEqual(result.moves, movesBefore - 1);
                assert.strictEqual(result.guide, null);
                assert.strictEqual(result.visual.length, 64);
                result.visual.forEach(piece => assert.strictEqual(piece.type, result.grid[piece.row][piece.column]));
                const first = result.events[0];
                if (kind === 'create') {
                    assert.deepStrictEqual(first.data.generated, [{ pos: { row: 4, column: 4 }, type: 106, baseType: 4 }]);
                    assert(result.grid.some(row => row.includes(106)));
                } else {
                    const trigger = first.data.triggeredSpecials.find(item => item.type === 106);
                    assert(trigger);
                    assert.strictEqual(trigger.color, kind === 'chain' ? 2 : 3);
                    if (kind === 'dye') {
                        assert.strictEqual(first.data.removed.length, 1);
                        assert.strictEqual(first.data.colorChanges.length, 3);
                        assert.deepStrictEqual(first.collected, {});
                    }
                    if (kind === 'rocket' || kind === 'ball') {
                        assert(result.events[1].data.generated.some(item => item.type === (kind === 'rocket' ? 101 : 104)));
                    }
                    if (kind === 'blocked') {
                        assert(!first.data.colorChanges.some(item => item.column === 4 && [3, 5].includes(item.row)));
                    }
                    if (kind === 'chain') assert(first.data.triggeredSpecials.some(item => item.type === 105));
                }
                if (width === 390) await page.locator('canvas').screenshot({ path: path.join(output, kind + '-after-' + width + '.png') });
                summaries.push({ width, case: kind, changes: first.data.colorChanges.length,
                    generated: result.events.flatMap(event => event.data.generated.map(item => item.type)), moves: result.moves });
            }
            if (width === 320) {
                await page.locator('#paw-reduced').check();
                await page.locator('[data-bell="rocket"]').click();
                await exchange();
                await page.waitForFunction(() => previewBellEvents.length && !previewApp.core.processing);
                assert.strictEqual(await page.evaluate(() => previewApp.board.particles.length), 0);
                await page.locator('canvas').screenshot({ path: path.join(output, 'reduced-after-320.png') });
            }
            if (width === 390) {
                const recording = await page.evaluate(async () => {
                    const recorder = bellRecording.recorder;
                    await new Promise(resolve => { recorder.onstop = resolve; recorder.stop(); });
                    bellRecording.stream.getTracks().forEach(track => track.stop());
                    const buffer = await new Blob(bellRecording.chunks, { type: 'video/webm' }).arrayBuffer();
                    return Array.from(new Uint8Array(buffer));
                });
                fs.writeFileSync(path.join(output, 'color-bell-demo.webm'), Buffer.from(recording));
            }
            await page.close();
        }
        assert.deepStrictEqual(errors, []);
        fs.writeFileSync(path.join(output, 'runtime-summary.json'), JSON.stringify(summaries, null, 2));
        console.log(JSON.stringify({ result: 'PASS', pointerCases: 18, introCases: 6, reduced: true, errors: errors, output: output }));
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
