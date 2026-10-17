// Browser checks of the isolated fixture's actual Main/Core/Board, not a gameplay simulator.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const base = new URL(process.argv[2]);
assert(['127.0.0.1', 'localhost'].includes(base.hostname));
const output = path.resolve(__dirname, '../assets/_incoming/new-obstacles-20261002');

(async () => {
    fs.mkdirSync(output, { recursive: true });
    const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
    const errors = [], results = [];
    try {
        for (const width of [320, 390, 430]) {
            const page = await browser.newPage({ viewport: { width: width + 40, height: 1350 } });
            page.on('pageerror', error => errors.push(error.message));
            await page.goto(base.href + '?preview=content&obstacles=1&width=' + width);
            await page.waitForFunction(() => window.previewObstacle && previewApp.board.pieces.length === 64 && !!load('js/render/assets.js').get('piece1'));
            for (const reduced of width === 320 ? [false, true] : [false]) {
                await page.locator('#obstacle-reduced').setChecked(reduced);
                for (const kind of ['moonbud', 'moonbud-closed', 'parcel', 'parcel-ice']) {
                    await page.locator('[data-obstacle="' + kind + '"]').click();
                    const suffix = kind + '-' + width + (reduced ? '-reduced' : '');
                    await page.locator('canvas').screenshot({ path: path.join(output, suffix + '-before.png') });
                    const points = await page.evaluate(() => previewObstacleExchange.map(pos => previewApp.board.pieceCenter(pos.row, pos.column)));
                    const bounds = await page.locator('canvas').boundingBox();
                    await page.mouse.move(bounds.x + points[0].x, bounds.y + points[0].y);
                    await page.mouse.down();
                    await page.mouse.move(bounds.x + points[1].x, bounds.y + points[1].y, { steps: 4 });
                    await page.mouse.up();
                    await page.waitForFunction(() => previewApp.core.movesLeft === 24 && !previewApp.core.processing && !previewApp.core.preferredGenerationPositions.length);
                    const snapshot = await page.evaluate(() => {
                        const c = previewApp.core, b = previewApp.board;
                        return { state: previewApp.state, moves: c.movesLeft, open: c.moonbudOpen, buds: c.getMoonbudsLeft(),
                            parcels: c.parcels, delivered: c.parcelDelivered, remaining: c.getParcelsLeft(), won: c.won,
                            grid: c.grid, pieces: b.pieces.map(p => ({ row: p.row, column: p.col, type: p.type })),
                            visualBuds: b.visualMoonbuds, visualOpen: b.visualMoonbudOpen, visualDelivered: b.visualParcelDelivered,
                            events: previewObstacleEvents };
                    });
                    assert.strictEqual(snapshot.moves, 24);
                    for (const piece of snapshot.pieces) assert.strictEqual(piece.type, snapshot.grid[piece.row][piece.column]);
                    if (kind === 'moonbud') {
                        assert.strictEqual(snapshot.buds, 1);
                        assert.strictEqual(snapshot.open, false);
                        assert(snapshot.events.some(e => e.kind === 'match' && e.buds.some(p => p.row === 3 && p.column === 3)));
                    } else if (kind === 'moonbud-closed') {
                        assert.strictEqual(snapshot.buds, 2);
                        assert.strictEqual(snapshot.open, true);
                        assert(!snapshot.events.some(e => e.kind === 'match' && e.buds.length));
                    } else if (kind === 'parcel') {
                        assert.strictEqual(snapshot.remaining, 0);
                        assert.strictEqual(snapshot.delivered, 1);
                        assert.strictEqual(snapshot.won, true);
                        assert.strictEqual(snapshot.events.filter(e => e.kind === 'delivery').length, 1);
                        assert.deepStrictEqual(snapshot.events.find(e => e.kind === 'delivery').parcels.map(p => [p.row, p.column]), [[7, 3]]);
                    } else {
                        assert.strictEqual(snapshot.remaining, 1);
                        assert.strictEqual(snapshot.delivered, 0);
                        // The ice releases its retained cat; gravity moves that cat to the
                        // bottom, so the immune parcel rests one row above it.
                        assert.deepStrictEqual(snapshot.parcels.map(p => [p.row, p.column]), [[6, 3]]);
                        assert.strictEqual(snapshot.grid[6][3], 201);
                        assert.strictEqual(snapshot.won, false);
                    }
                    await page.locator('canvas').screenshot({ path: path.join(output, suffix + '-after.png') });
                    results.push({ width, reduced, kind, buds: snapshot.buds, open: snapshot.open, remaining: snapshot.remaining,
                        delivered: snapshot.delivered, won: snapshot.won, visualBuds: snapshot.visualBuds,
                        visualOpen: snapshot.visualOpen, visualDelivered: snapshot.visualDelivered });
                }
            }
            for (const kind of ['moonbud', 'parcel']) {
                await page.locator('[data-obstacle="' + kind + '"]').click();
                await page.locator('#obstacle-guide').click();
                await page.waitForFunction(() => !!previewApp.guide);
                await page.locator('canvas').screenshot({ path: path.join(output, kind + '-guide-' + width + '.png') });
                const confirm = await page.evaluate(() => previewApp.guideButtons.confirm);
                const bounds = await page.locator('canvas').boundingBox();
                await page.mouse.click(bounds.x + confirm.x + confirm.w / 2, bounds.y + confirm.y + confirm.h / 2);
                await page.waitForFunction(() => !previewApp.guide);
                assert.strictEqual(await page.evaluate(() => previewApp.core.movesLeft), 25);
            }
            await page.close();
        }
        assert.deepStrictEqual(errors, []);
        fs.writeFileSync(path.join(output, 'browser-evidence.json'), JSON.stringify({ fixture: base.href, scenarios: results, errors,
            boundary: 'Local seeded fixtures, real Main/Core/Board pointer exchange; no cloud or user saves. Not natural progression, difficulty calibration or WeChat device acceptance.' }, null, 2) + '\n');
        console.log(JSON.stringify({ result: 'PASS', scenarios: results.length, viewports: [320, 390, 430], errors, output }));
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
