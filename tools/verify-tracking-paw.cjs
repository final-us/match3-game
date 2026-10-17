const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const base = new URL(process.argv[2]);
assert(['127.0.0.1', 'localhost'].includes(base.hostname));
const output = path.resolve(__dirname, '../assets/_incoming/tracking-paw-20260930');

(async function () {
    fs.mkdirSync(output, { recursive: true });
    const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
    const errors = [];
    const summaries = [];
    try {
        for (const width of [320, 390, 430]) {
            const page = await browser.newPage({ viewport: { width: width + 40, height: 1300 } });
            page.on('pageerror', error => errors.push(error.message));
            await page.goto(base.href + '?preview=content&paw=1&width=' + width);
            await page.waitForFunction(() => window.previewPaw && previewApp.board.pieces.length === 64 &&
                !!load('js/render/assets.js').get('piece1'));
            if (width === 390) await page.evaluate(() => {
                const stream = document.querySelector('canvas').captureStream(30);
                const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
                window.pawRecording = { recorder, chunks: [], stream };
                recorder.ondataavailable = event => pawRecording.chunks.push(event.data);
                recorder.start();
            });
            async function exchange() {
                const points = await page.evaluate(() => previewPawExchange.map(position =>
                    previewApp.board.pieceCenter(position.row, position.column)));
                const canvas = await page.locator('canvas').boundingBox();
                await page.mouse.move(canvas.x + points[0].x, canvas.y + points[0].y);
                await page.mouse.down();
                await page.mouse.move(canvas.x + points[1].x, canvas.y + points[1].y, { steps: 4 });
                await page.mouse.up();
            }
            for (const kind of ['create', 'jelly', 'ice', 'yarn', 'collect', 'chain']) {
                await page.locator('[data-paw="' + kind + '"]').click();
                assert.strictEqual(await page.evaluate(() => previewApp.core.movesLeft), 25);
                if (width === 390 || kind === 'create') await page.locator('canvas').screenshot({ path: path.join(output, kind + '-before-' + width + '.png') });
                await exchange();
                await page.waitForFunction(() => previewApp.core.movesLeft === 24);
                if (width === 390 && kind !== 'create') {
                    await page.waitForFunction(() => previewApp.board.specialEffects.some(effect =>
                        effect.type === 105 && effect.life / effect.maxLife >= 0.38 && effect.life / effect.maxLife < 0.7));
                    await page.locator('canvas').screenshot({ path: path.join(output, kind + '-flight-' + width + '.png') });
                }
                await page.waitForFunction(() => previewPawEvent && !previewApp.core.processing &&
                    !previewApp.core.preferredGenerationPositions.length);
                const result = await page.evaluate(() => ({
                    case: previewPawCase, event: previewPawEvent, moves: previewApp.core.movesLeft,
                    grid: previewApp.core.grid, health: previewApp.core.getYarnHealth(),
                    effects: previewApp.board.specialEffects.length, guide: previewApp.guide,
                    visual: previewApp.board.pieces.map(piece => ({ row: piece.row, column: piece.col, type: piece.type }))
                }));
                assert.strictEqual(result.moves, 24);
                assert.strictEqual(result.guide, null);
                assert.strictEqual(result.visual.length, 64);
                for (const piece of result.visual) assert.strictEqual(piece.type, result.grid[piece.row][piece.column]);
                if (kind === 'create') {
                    assert.deepStrictEqual(result.event.generated, [{ pos: { row: 4, column: 3 }, type: 105, baseType: 4 }]);
                    assert(result.grid.some(row => row.includes(105)));
                    assert.strictEqual(result.event.triggeredSpecials.length, 0);
                } else {
                    const trigger = result.event.triggeredSpecials.find(item => item.type === 105);
                    assert(trigger && trigger.target);
                    if (['jelly', 'ice', 'yarn', 'chain'].includes(kind)) assert.deepStrictEqual(trigger.target, { row: 1, column: 6 });
                    if (kind === 'jelly') assert(result.event.jellyHits.some(item => item.row === 1 && item.column === 6));
                    if (kind === 'ice') assert(result.event.iceHits.some(item => item.row === 1 && item.column === 6));
                    if (kind === 'yarn') assert.strictEqual(result.health, 2);
                    if (kind === 'chain') assert(result.event.triggeredSpecials.some(item => item.type === 101));
                }
                if (width === 390) await page.locator('canvas').screenshot({ path: path.join(output, kind + '-after-' + width + '.png') });
                summaries.push({ width, case: kind, target: result.event.triggeredSpecials.find(item => item.type === 105)?.target,
                    generated: result.event.generated.length, moves: result.moves });
            }
            if (width === 320) {
                await page.locator('#paw-reduced').check();
                await page.locator('[data-paw="ice"]').click();
                await exchange();
                await page.waitForFunction(() => previewPawEvent && !previewApp.core.processing);
                assert.strictEqual(await page.evaluate(() => previewApp.board.particles.length), 0);
                await page.locator('canvas').screenshot({ path: path.join(output, 'reduced-after-320.png') });
            }
            if (width === 390) {
                const bytes = await page.evaluate(() => new Promise(resolve => {
                    pawRecording.recorder.onstop = async () => {
                        const buffer = await new Blob(pawRecording.chunks, { type: 'video/webm' }).arrayBuffer();
                        pawRecording.stream.getTracks().forEach(track => track.stop());
                        resolve(Array.from(new Uint8Array(buffer)));
                    };
                    pawRecording.recorder.stop();
                }));
                fs.writeFileSync(path.join(output, 'tracking-paw-demo.webm'), Buffer.from(bytes));
            }
            await page.close();
        }
        assert.deepStrictEqual(errors, []);
        fs.writeFileSync(path.join(output, 'runtime-evidence.json'), JSON.stringify({ summaries, errors }, null, 2));
        console.log('追踪猫爪实际Canvas：18例真实指针合成/触发、三档屏宽、减弱动效、视觉与逻辑同步 PASS');
        console.log(output);
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
