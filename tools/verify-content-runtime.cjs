// Local-only runtime acceptance against preview-level-entry.cjs?preview=content.
// Real Main/Core/Board/Canvas, memory saves, no WeChat/cloud account or requests.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const base = new URL(process.argv[2]);
const verifyWin = process.argv.includes('--win');
assert(['127.0.0.1', 'localhost'].includes(base.hostname), 'Only local fixtures are allowed');
const output = path.resolve(__dirname, '../assets/_incoming/moon-ui-runtime/screens');

(async () => {
    fs.mkdirSync(output, { recursive: true });
    const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
    const errors = [];
    try {
        const page = await browser.newPage();
        page.on('pageerror', error => errors.push(error.message));
        async function dismissGuide() {
            while (await page.evaluate(() => !!previewApp.guide)) {
                const button = await page.evaluate(() => previewApp.guideButtons && previewApp.guideButtons.confirm);
                if (!button) { await page.waitForTimeout(30); continue; }
                const canvas = await page.locator('canvas').boundingBox();
                await page.mouse.click(canvas.x + button.x + button.w / 2, canvas.y + button.y + button.h / 2);
                await page.waitForTimeout(30);
            }
        }
        const summaries = [];
        const cases = verifyWin ? [[375, 812, 1]] : [[320, 568, 6], [375, 812, 11], [430, 932, 20], [320, 568, 1]];
        for (const [width, height, level] of cases) {
            await page.setViewportSize({ width: width + 24, height: height + 330 });
            await page.goto(base.href + '?preview=content&width=' + width);
            await page.waitForFunction(() => window.previewApp && previewApp.board && previewApp.guideButtons);
            await page.evaluate(level => previewStart(level), level);
            await page.waitForTimeout(100);
            await page.locator('canvas').screenshot({ path: path.join(output, 'content-live-start-' + level + '-' + width + '.png') });
            let actions = 0;
            while (await page.evaluate(() => previewApp.state === 'playing')) {
                await dismissGuide();
                if (!await page.evaluate(() => previewApp.state === 'playing')) break;
                const move = await page.evaluate(preferScore => {
                    const core = previewApp.core, board = previewApp.board;
                    const candidates = [];
                    const gridUtil = load('js/core/grid.js');
                    const config = load('js/core/config.js');
                    for (let r = 0; r < core.grid.length; r++) for (let c = 0; c < core.grid[r].length; c++) {
                        const from = { row: r, column: c };
                        for (const to of [{ row: r, column: c + 1 }, { row: r + 1, column: c }]) {
                            if (to.row >= core.grid.length || to.column >= core.grid[0].length) continue;
                            if (!core.isBlocked(from) && !core.isBlocked(to) && core.validateMove(from, to)) {
                                const move = { from: board.pieceCenter(r, c), to: board.pieceCenter(to.row, to.column), priority: 0 };
                                if (!preferScore) return move;
                                const a = core.grid[r][c], b = core.grid[to.row][to.column];
                                if (config.isSpecialType(a) && config.isSpecialType(b)) move.priority = 100;
                                else if (a === 104 || b === 104) move.priority = 70;
                                else if (config.isSpecialType(a) || config.isSpecialType(b)) move.priority = 20;
                                else {
                                    const copy = gridUtil.cloneGrid(core.grid);
                                    gridUtil.swapTypeInGrid(copy, from, to);
                                    move.priority = gridUtil.getMatches(copy).reduce((n, group) => n + group.length * group.length, 0);
                                }
                                candidates.push(move);
                            }
                        }
                    }
                    return candidates.sort((a, b) => b.priority - a.priority)[0] || null;
                }, verifyWin);
                assert(move, 'Settled board has no legal exchange');
                const before = await page.evaluate(() => previewApp.core.movesLeft);
                const canvas = await page.locator('canvas').boundingBox();
                await page.mouse.move(canvas.x + move.from.x, canvas.y + move.from.y);
                await page.mouse.down();
                await page.mouse.move(canvas.x + move.to.x, canvas.y + move.to.y, { steps: 4 });
                await page.mouse.up();
                await page.waitForFunction(before => previewApp.core.movesLeft < before || previewApp.state === 'result', before, { timeout: 5000 }).catch(async error => {
                    console.error('Pointer diagnostic:', await page.evaluate(() => ({
                        state: previewApp.state, guide: previewApp.guide, processing: previewApp.core.processing,
                        pending: previewApp.core.preferredGenerationPositions, moves: previewApp.core.movesLeft,
                        touch: previewApp.board.touchStartGrid, button: previewApp.guideButtons
                    })), errors);
                    await page.locator('canvas').screenshot({ path: path.join(output, 'content-runtime-failure.png') });
                    throw error;
                });
                await page.waitForFunction(() => {
                    const core = previewApp.core;
                    return !core.processing && !core.swapFeedbackPending && !core.preferredGenerationPositions.length;
                });
                if (++actions > 45) throw new Error('Run did not terminate within the level move budget');
            }
            const summary = await page.evaluate(() => ({
                level: previewApp.core.level.id, result: previewApp.result,
                maxCascade: previewApp.core.maxCascade, specialComboCount: previewApp.core.specialComboCount,
                unlocked: previewApp.progress.unlockedLevel, collected: previewApp.core.collectedCounts,
                guide: previewApp.guide
            }));
            assert(summary.result, 'Real Main should render a result after completing the run');
            assert.strictEqual(summary.result.maxCascade, summary.maxCascade);
            assert.strictEqual(summary.result.specialComboCount, summary.specialComboCount);
            assert.strictEqual(summary.unlocked, 42);
            assert.strictEqual(summary.guide, null);
            assert(summary.maxCascade >= 1);
            if (verifyWin) assert(summary.result.win, 'Score-focused legal exchanges should exercise actual win flow');
            await page.locator('canvas').screenshot({ path: path.join(output, 'content-live-result-' + level + '-' + width + '.png') });
            summaries.push({ width, level, actions, win: summary.result.win, collected: summary.collected, maxCascade: summary.maxCascade, specialComboCount: summary.specialComboCount });
            console.log(JSON.stringify(summaries[summaries.length - 1]));
        }
        assert.deepStrictEqual(errors, [], 'Browser runtime errors');
        console.log('Content runtime: real pointer exchanges, guide close, natural results, stats and old progress PASS');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
