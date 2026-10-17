const config = require('./config');
const gridUtil = require('./grid');

const SHAPES = [
    [[0, 0], [0, 1], [1, 1], [1, 2]],
    [[0, 1], [0, 2], [1, 0], [1, 1]],
    [[0, 1], [1, 0], [1, 1], [2, 0]],
    [[0, 0], [1, 0], [1, 1], [2, 1]]
];

function shapes(core, grid, positions) {
    const found = [];
    const seen = {};
    positions.forEach(function (position) {
        SHAPES.forEach(function (shape, index) {
            shape.forEach(function (offset) {
                const row = position.row - offset[0];
                const column = position.column - offset[1];
                const key = row + ':' + column + ':' + index;
                if (seen[key]) return;
                seen[key] = true;
                const cells = shape.map(function (cell) {
                    return { row: row + cell[0], column: column + cell[1] };
                });
                const type = gridUtil.getPieceType(grid, cells[0]);
                if (!config.getPieceTypeDef(type)) return;
                if (cells.every(function (cell) {
                    return gridUtil.isValidPosition(grid, cell) && !core.isBlocked(cell) &&
                        gridUtil.getPieceType(grid, cell) === type;
                })) found.push(cells);
            });
        });
    });
    return found;
}

function newShapes(core, from, to) {
    if (!core.level.colorBell || core.minMatchCount !== 3) return [];
    const positions = [to, from];
    const before = shapes(core, core.grid, positions);
    const swapped = gridUtil.cloneGrid(core.grid);
    gridUtil.swapTypeInGrid(swapped, from, to);
    return shapes(core, swapped, positions).filter(function (shape) {
        return !before.some(function (previous) {
            return shape.every(function (cell) { return gridUtil.includesPosition(previous, cell); }) &&
                gridUtil.getPieceType(core.grid, previous[0]) === gridUtil.getPieceType(swapped, shape[0]);
        });
    });
}

function dye(core, origin, type, excluded, radius) {
    const changes = [];
    const positions = core.yarnNeighbors(origin);
    if (radius) {
        positions.length = 0;
        for (let row = origin.row - radius; row <= origin.row + radius; row++) {
            for (let column = origin.column - radius; column <= origin.column + radius; column++) {
                const position = { row: row, column: column };
                if (gridUtil.isValidPosition(core.grid, position)) positions.push(position);
            }
        }
    }
    positions.forEach(function (position) {
        if (core.isBlocked(position) || gridUtil.includesPosition(excluded, position)) return;
        const previousType = gridUtil.getPieceType(core.grid, position);
        if (!config.getPieceTypeDef(previousType) || previousType === type) return;
        gridUtil.setPieceType(core.grid, position, type);
        changes.push({ row: position.row, column: position.column, previousType: previousType, type: type });
    });
    return changes;
}

module.exports = { newShapes, dye };
