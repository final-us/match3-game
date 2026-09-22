/** Strategy prompts inspect a settled board; they never change pieces or scoring. */
const config = require('./config');

function collectGoal(level) {
    return (level.goals || []).find(function (goal) { return goal.type === 'collect'; }) || null;
}

function collectCells(core) {
    const goal = collectGoal(core.level);
    if (!goal) return [];
    const cells = [];
    for (let row = 0; row < core.grid.length; row++) {
        for (let column = 0; column < core.grid[row].length; column++) {
            if (core.grid[row][column] === goal.pieceType) cells.push({ row: row, column: column });
            if (cells.length === 3) return cells;
        }
    }
    return cells;
}

function specialPair(core) {
    if (core.processing || core.ended || core.swapFeedbackPending || core.pendingCombo ||
        (core.pendingTriggers && core.pendingTriggers.length) ||
        (core.pendingRemovals && core.pendingRemovals.length) ||
        (core.preferredGenerationPositions && core.preferredGenerationPositions.length)) return [];
    function available(row, column) {
        return core.grid[row] && config.isSpecialType(core.grid[row][column]) &&
            !core.isBlocked({ row: row, column: column });
    }
    for (let row = 0; row < core.grid.length; row++) {
        for (let column = 0; column < core.grid[row].length; column++) {
            if (!available(row, column)) continue;
            const next = available(row, column + 1) ? { row: row, column: column + 1 } :
                (available(row + 1, column) ? { row: row + 1, column: column } : null);
            if (next) return [{ row: row, column: column }, next];
        }
    }
    return [];
}

/** Only stale failure assistance is reset; unlocked levels and earned stars survive. */
function syncContentRevision(progress, level) {
    if (!level.contentRevision) return false;
    if (!progress.contentRevisions) progress.contentRevisions = {};
    const previous = progress.contentRevisions[level.id] || 'infinite-v3';
    if (previous === level.contentRevision) return false;
    if (!progress.failures) progress.failures = {};
    delete progress.failures[level.id];
    progress.contentRevisions[level.id] = level.contentRevision;
    return true;
}

module.exports = { collectGoal, collectCells, specialPair, syncContentRevision };
