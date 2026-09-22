'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'match3-wechat/js/core');
const destination = path.join(root, 'match3-wechat/cloudfunctions/battle/daily-engine');
const files = ['daily-challenge.js', 'daily-v1/config.js', 'daily-v1/grid.js', 'daily-v1/game-core.js'];
const checkOnly = process.argv.includes('--check');

for (const relative of files) {
    const from = path.join(source, relative);
    const to = path.join(destination, relative);
    let expected = fs.readFileSync(from);
    if (relative === 'daily-v1/grid.js') {
        expected = Buffer.from(expected.toString().replace('../../../THIRD_PARTY_NOTICES.txt', '../../THIRD_PARTY_NOTICES.txt'));
    }
    if (!checkOnly) {
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.writeFileSync(to, expected);
    }
    if (!fs.existsSync(to) || !expected.equals(fs.readFileSync(to))) {
        throw new Error('daily engine sync mismatch: ' + relative);
    }
}
console.log(checkOnly ? 'daily engine verified: ' + files.length + ' files' : 'daily engine synchronized: ' + files.length + ' files');
