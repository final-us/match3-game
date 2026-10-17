const config = require('./config');
const gridUtil = require('./grid');

function squares(core, grid, positions) {
    const found = [];
    const seen = {};
    positions.forEach(function (position) {
        for (let rowOffset = -1; rowOffset <= 0; rowOffset++) {
            for (let columnOffset = -1; columnOffset <= 0; columnOffset++) {
                const row = position.row + rowOffset;
                const column = position.column + columnOffset;
                const key = row + ':' + column;
                if (seen[key]) continue;
                seen[key] = true;
                const cells = [
                    { row: row, column: column }, { row: row, column: column + 1 },
                    { row: row + 1, column: column }, { row: row + 1, column: column + 1 }
                ];
                const type = gridUtil.getPieceType(grid, cells[0]);
                if (!config.getPieceTypeDef(type)) continue;
                if (cells.every(function (cell) {
                    return gridUtil.isValidPosition(grid, cell) && !core.isBlocked(cell) &&
                        gridUtil.getPieceType(grid, cell) === type;
                })) found.push(cells);
            }
        }
    });
    return found;
}

function newSquares(core, from, to) {
    if (!core.level.trackingPaw || core.minMatchCount !== 3) return [];
    const positions = [to, from];
    const before = squares(core, core.grid, positions);
    const swapped = gridUtil.cloneGrid(core.grid);
    gridUtil.swapTypeInGrid(swapped, from, to);
    return squares(core, swapped, positions).filter(function (square) {
        return !before.some(function (previous) {
            return gridUtil.comparePositions(square[0], previous[0]) &&
                gridUtil.getPieceType(core.grid, previous[0]) === gridUtil.getPieceType(swapped, square[0]);
        });
    });
}

function target(core, origin, excluded, yarnHit) {
    const goals = (core.level.goals || []).filter(function (goal) {
        return goal.type === 'collect' && (core.collectedCounts[goal.pieceType] || 0) < goal.target;
    });
    function alreadyHit(position, adjacent) {
        return excluded.some(function (cell) {
            const distance = Math.abs(cell.row - position.row) + Math.abs(cell.column - position.column);
            return distance === 0 || (adjacent && distance === 1 &&
                (adjacent === 'any' || !core.isBlocked(cell)));
        });
    }
    let chosen = null;
    let bestPriority = -1;
    let bestDistance = -1;
    for (let row = 0; row < core.grid.length; row++) {
        for (let column = 0; column < core.grid[row].length; column++) {
            const position = { row: row, column: column };
            const type = core.grid[row][column];
            if (!type || type === config.OBJECT_TYPES.PARCEL || core.isClosedMoonbud(position) ||
                alreadyHit(position, false)) continue;
            let priority = 0;
            if (core.isYarnRoot(position)) {
                if (yarnHit || alreadyHit(position, 'any')) continue;
                priority = 4;
            } else if (core.jellyGrid[row][column] > 0) priority = 3;
            else if (core.isYarnVine(position)) priority = 3;
            else if (core.iceGrid[row][column]) {
                if (alreadyHit(position, true)) continue;
                priority = 3;
            } else if (goals.some(function (goal) { return goal.pieceType === type; })) priority = 2;
            else if (config.isSpecialType(type)) priority = 1;
            if (priority === 0 && core.moonbudOpen && core.moonbudCells &&
                core.moonbudCells[row + ':' + column]) priority = 0.5;
            const distance = Math.abs(row - origin.row) + Math.abs(column - origin.column);
            if (priority > bestPriority || (priority === bestPriority && distance > bestDistance)) {
                chosen = position;
                bestPriority = priority;
                bestDistance = distance;
            }
        }
    }
    return chosen;
}

module.exports = { newSquares, target };
