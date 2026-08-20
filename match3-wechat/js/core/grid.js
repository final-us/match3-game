/**
 * 三消核心网格算法
 * 移植自 pixi-game-match3 (MIT License) 的 Match3Utility.ts
 * 纯逻辑、无平台依赖：棋盘生成 / 匹配检测 / 重力下落 / 空格填充
 */

/**
 * 创建初始棋盘（避免出现预置消除）
 * @param {number} rows 行数
 * @param {number} columns 列数
 * @param {number[]} types 可用棋子类型列表
 * @returns {number[][]} 二维网格
 */
function createGrid(rows, columns, types) {
    const grid = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < columns; c++) {
            let type = getRandomType(types);
            const excludeList = [];

            // 初始创建的 grid 不能出现 3 个相同棋子相连的情况
            // 遍历顺序是从上到下、从左往右，因此只检查上方和左方
            while (matchPreviousTypes(grid, { row: r, column: c }, type)) {
                excludeList.push(type);
                type = getRandomType(types, excludeList);
            }

            if (!grid[r]) grid[r] = [];
            grid[r][c] = type;
        }
    }
    return grid;
}

/**
 * 从类型列表中随机取一个类型
 * @param {number[]} types 可用类型
 * @param {number[]} [exclude] 需要排除的类型
 */
function getRandomType(types, exclude) {
    let list = types;
    if (exclude && exclude.length) {
        list = types.filter(function (t) { return exclude.indexOf(t) === -1; });
    }
    const index = Math.floor(Math.random() * list.length);
    return list[index];
}

/** 检查某类型是否与左/上方已有棋子形成消除 */
function matchPreviousTypes(grid, position, type) {
    const horizontal1 = grid && grid[position.row] ? grid[position.row][position.column - 1] : undefined;
    const horizontal2 = grid && grid[position.row] ? grid[position.row][position.column - 2] : undefined;
    const horizontalMatch = type === horizontal1 && type === horizontal2;

    const row1 = grid && grid[position.row - 1] ? grid[position.row - 1][position.column] : undefined;
    const row2 = grid && grid[position.row - 2] ? grid[position.row - 2][position.column] : undefined;
    const verticalMatch = type === row1 && type === row2;

    return horizontalMatch || verticalMatch;
}

/**
 * 获取棋盘上所有消除组合
 * @param {number[][]} grid 棋盘
 * @param {Array<{row:number,column:number}>} [filter] 可选：只返回包含这些位置的消除
 * @param {number} [matchSize] 消除长度，默认 3
 * @returns {Array<Array<{row:number,column:number}>>}
 */
function getMatches(grid, filter, matchSize) {
    matchSize = matchSize || 3;
    const allMatches = getMatchesByOrientation(grid, matchSize, 'horizontal')
        .concat(getMatchesByOrientation(grid, matchSize, 'vertical'));

    if (!filter) return allMatches;

    const filteredMatches = [];
    for (let i = 0; i < allMatches.length; i++) {
        const match = allMatches[i];
        let valid = false;
        for (let j = 0; j < match.length; j++) {
            for (let k = 0; k < filter.length; k++) {
                if (comparePositions(match[j], filter[k])) {
                    valid = true;
                    break;
                }
            }
            if (valid) break;
        }
        if (valid) filteredMatches.push(match);
    }
    return filteredMatches;
}

/** 按方向扫描获取消除组合 */
function getMatchesByOrientation(grid, matchSize, orientation) {
    const matches = [];
    const rows = grid.length;
    const columns = grid[0].length;
    let lastType = undefined;
    let currentMatch = [];

    const primary = orientation === 'horizontal' ? rows : columns;
    const secondary = orientation === 'horizontal' ? columns : rows;

    for (let p = 0; p < primary; p++) {
        for (let s = 0; s < secondary; s++) {
            const row = orientation === 'horizontal' ? p : s;
            const column = orientation === 'horizontal' ? s : p;
            const type = grid[row][column];

            if (type && type === lastType) {
                currentMatch.push({ row: row, column: column });
            } else {
                if (currentMatch.length >= matchSize) {
                    matches.push(currentMatch);
                }
                currentMatch = [{ row: row, column: column }];
                lastType = type;
            }
        }
        if (currentMatch.length >= matchSize) {
            matches.push(currentMatch);
        }
        lastType = undefined;
        currentMatch = [];
    }
    return matches;
}

/** 克隆网格 */
function cloneGrid(grid) {
    const clone = [];
    for (let r = 0; r < grid.length; r++) {
        clone.push(grid[r].slice());
    }
    return clone;
}

/** 交换网格中两个位置的棋子类型 */
function swapTypeInGrid(grid, positionA, positionB) {
    const typeA = getPieceType(grid, positionA);
    const typeB = getPieceType(grid, positionB);
    if (typeA !== undefined && typeB !== undefined) {
        setPieceType(grid, positionA, typeB);
        setPieceType(grid, positionB, typeA);
    }
}

/** 设置网格某位置的棋子类型 */
function setPieceType(grid, position, type) {
    grid[position.row][position.column] = type;
}

/** 获取网格某位置的棋子类型 */
function getPieceType(grid, position) {
    if (!grid[position.row]) return undefined;
    return grid[position.row][position.column];
}

/**
 * 重力下落：所有棋子掉落到空位
 * @param {number[][]} grid 棋盘
 * @param {Function} [blockedFn] 可选：返回 true 的位置（棋子被覆盖，锁定不下落）
 * @returns {Array<Array<{row:number,column:number}>>} 变化列表 [[from, to], ...]
 */
function applyGravity(grid, blockedFn) {
    const rows = grid.length;
    const columns = grid[0].length;
    const changes = [];

    for (let r = rows - 1; r >= 0; r--) {
        for (let c = 0; c < columns; c++) {
            let position = { row: r, column: c };

            // 被覆盖的棋子锁定（果冻/冰块），不参与下落
            if (blockedFn && blockedFn(position)) continue;

            let belowPosition = { row: r + 1, column: c };
            let hasChanged = false;

            if (!isValidPosition(grid, belowPosition)) continue;

            let belowType = getPieceType(grid, belowPosition);
            let currentType = getPieceType(grid, position);

            while (isValidPosition(grid, belowPosition) && belowType === 0 && currentType !== 0) {
                hasChanged = true;
                swapTypeInGrid(grid, position, belowPosition);
                position = { row: belowPosition.row, column: belowPosition.column };
                belowPosition.row += 1;
                currentType = getPieceType(grid, position);
                belowType = getPieceType(grid, belowPosition);
            }

            if (hasChanged) {
                changes.push([{ row: r, column: c }, { row: position.row, column: position.column }]);
            }
        }
    }
    return changes;
}

/** 判断位置是否在棋盘内 */
function isValidPosition(grid, position) {
    const rows = grid.length;
    const cols = grid[0].length;
    return position.row >= 0 && position.row < rows &&
        position.column >= 0 && position.column < cols;
}

/**
 * 用随机棋子填充所有空位
 * @returns {Array<{row:number,column:number}>} 被填充的位置列表
 */
function fillUp(grid, types) {
    const tempGrid = createGrid(grid.length, grid[0].length, types);
    const rows = grid.length;
    const columns = grid[0].length;
    const emptyPositions = [];

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < columns; c++) {
            if (!grid[r][c]) {
                grid[r][c] = tempGrid[r][c];
                emptyPositions.push({ row: r, column: c });
            }
        }
    }
    return emptyPositions;
}

/** 找出所有空位 */
function getEmptyPositions(grid) {
    const positions = [];
    const rows = grid.length;
    const columns = grid[0].length;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < columns; c++) {
            if (!grid[r][c]) {
                positions.push({ row: r, column: c });
            }
        }
    }
    return positions;
}

/** 比较两个位置是否相同 */
function comparePositions(a, b) {
    return a.row === b.row && a.column === b.column;
}

/** 判断位置列表是否包含某位置 */
function includesPosition(positions, position) {
    for (let i = 0; i < positions.length; i++) {
        if (comparePositions(positions[i], position)) return true;
    }
    return false;
}

module.exports = {
    createGrid: createGrid,
    getRandomType: getRandomType,
    getMatches: getMatches,
    cloneGrid: cloneGrid,
    swapTypeInGrid: swapTypeInGrid,
    setPieceType: setPieceType,
    getPieceType: getPieceType,
    applyGravity: applyGravity,
    isValidPosition: isValidPosition,
    fillUp: fillUp,
    getEmptyPositions: getEmptyPositions,
    comparePositions: comparePositions,
    includesPosition: includesPosition
};
