'use strict';
const assert = require('assert');
const sim = require('./solo-simulation');
const config = require('../../js/core/config');
const paw = require('../../js/core/tracking-paw');
const bell = require('../../js/core/color-bell');

function recipeMove(core, grid, rng) {
    let best = -Infinity, candidates = [];
    for (const move of sim.moves(core)) {
        let value = sim.priority(core, move, grid, 'goal');
        const [from, to] = move;
        if (!config.isSpecialType(core.grid[from.row][from.column]) && !config.isSpecialType(core.grid[to.row][to.column])) {
            const squares = paw.newSquares(core, from, to);
            const shapes = bell.newShapes(core, from, to);
            if (squares.length || shapes.length) {
                const copy = grid.cloneGrid(core.grid);
                grid.swapTypeInGrid(copy, from, to);
                const view = Object.create(core);
                view.grid = copy;
                // Use the real overlap/prioritization rules; this query does not mutate Core.
                const generated = view.collectWithSpecials(grid.getMatches(copy), [to, from], squares, shapes).generated;
                for (const piece of generated) {
                    if (piece.type === 105) value += core.getYarnHealth() ? 60 : 40;
                    if (piece.type === 106) value += 30;
                }
            }
        }
        if (value > best) { best = value; candidates = [move]; }
        else if (value === best) candidates.push(move);
    }
    assert(candidates.length);
    return candidates[Math.floor(rng() * candidates.length)];
}

module.exports = recipeMove;
