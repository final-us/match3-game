'use strict';

const config = require('./core/config');

module.exports = function specialTriggerDelays(data, reduceEffects) {
    const triggered = data.triggeredSpecials || [];
    const pawArrival = (reduceEffects ? 200 : 560) * 0.64;
    const samePosition = (first, second) => first.row === second.row && first.column === second.column;
    const paths = triggered.map((source, from) => triggered.map((item, to) => {
        if (from === to) return 0;
        if (item.after) return samePosition(source, item.after) ?
            (item.after.phase === 'impact' ? pawArrival : (reduceEffects ? 60 : 160)) : Infinity;
        return module.exports.hitTime(source, item, 0, reduceEffects);
    }));
    for (let via = 0; via < triggered.length; via++) {
        for (let from = 0; from < triggered.length; from++) {
            for (let to = 0; to < triggered.length; to++) {
                paths[from][to] = Math.min(paths[from][to], paths[from][via] + paths[via][to]);
            }
        }
    }
    const combo = data.specialCombo ? [data.specialCombo.first, data.specialCombo.second] : [];
    const roots = [];
    const order = triggered.map((item, index) => {
        if (!item.after && combo.some(source => samePosition(source, item))) roots.push(index);
        const removedIndex = (data.removed || []).findIndex(position => samePosition(position, item));
        return { index, rank: removedIndex < 0 ? Infinity : removedIndex, item };
    }).sort((first, second) => first.rank - second.rank ||
        first.item.row - second.item.row || first.item.column - second.item.column);
    for (const { index, item } of order) {
        if (item.after || roots.some(root => Number.isFinite(paths[root][index]))) continue;
        if (!triggered.some((source, other) => Number.isFinite(paths[other][index]) &&
            !Number.isFinite(paths[index][other]))) roots.push(index);
    }
    return triggered.map((item, index) => {
        const delay = Math.min(...roots.map(root => paths[root][index]));
        if (!Number.isFinite(delay)) throw new Error('Unreachable special trigger dependency');
        return delay;
    });
};

module.exports.hitTime = function (source, position, delay, reduceEffects) {
    const origin = source.effectOrigin || source;
    const rowDistance = Math.abs(origin.row - position.row);
    const columnDistance = Math.abs(origin.column - position.column);
    if (source.type === config.SPECIAL_TYPES.TRACKING_PAW) {
        if (rowDistance + columnDistance <= 1) return delay;
        const impacts = source.pawTargets || (source.target ? [source] : []);
        if (impacts.some(impact => impact.target.row === position.row && impact.target.column === position.column)) {
            return delay + (reduceEffects ? 200 : 560) * 0.64;
        }
    } else if (source.hitTargets ? source.hitTargets.some(target => target.row === position.row && target.column === position.column) :
        (source.type === config.SPECIAL_TYPES.H_ROCKET && rowDistance === 0) ||
        (source.type === config.SPECIAL_TYPES.V_ROCKET && columnDistance === 0) ||
        (source.type === config.SPECIAL_TYPES.BOMB && rowDistance <= 1 && columnDistance <= 1) ||
        source.type === config.SPECIAL_TYPES.COLOR_BALL) return delay;
    return Infinity;
};
