/** Development-only UI sample. No persistence, cloud calls, or wallet mutations. */
function isEnabled(api) {
    try {
        return !!api && api.getAccountInfoSync().miniProgram.envVersion === 'develop';
    } catch (error) {
        return false;
    }
}

function create() {
    return {
        tab: 'signin', offset: 0, signDay: 1, signed: false,
        taskProgress: [0, 0, 0], activity: 0, claimed: [false, false, false],
        status: 'ready', message: '', rules: false
    };
}

// Returns navigation intent; all preview rewards remain in this temporary model.
function activate(data, action) {
    if (action === 'close') {
        return 'close';
    }
    if (action === 'rules') { data.rules = !data.rules; data.offset = 0; return; }
    if (action === 'signinTab' || action === 'tasksTab') {
        data.tab = action === 'signinTab' ? 'signin' : 'tasks';
        data.rules = false; data.offset = 0; data.message = ''; return;
    }
    if (data.rules || data.status === 'loading' || data.status === 'pending') return;
    if (data.status === 'offline' || data.status === 'error') {
        if (action === 'primary') { data.status = 'ready'; data.offset = 0; data.message = '连接恢复演示 · 未调用云端'; }
        return;
    }
    if (action === 'primary') {
        if (data.tab === 'tasks') return 'play';
        if (data.signed) return;
        data.signed = true;
        data.activity = Math.min(700, data.activity + 20);
        const reward = [100, 100, 150, 100, 100, 150, 200][data.signDay - 1];
        data.message = '预览奖励：' + reward + '金币' + (data.signDay === 7 ? '＋锤子×1' : '') + '（未入账）';
    }
    const index = ['weekly0', 'weekly1', 'weekly2'].indexOf(action);
    if (index >= 0 && data.activity >= [200, 350, 500][index] && !data.claimed[index]) {
        data.claimed[index] = true;
        data.message = '预览宝箱：' + [300, 500, 1000][index] + '金币（未入账）';
    }
    const previous = ['previous0', 'previous1', 'previous2'].indexOf(action);
    if (previous >= 0 && data.previousWeek && data.previousWeek.available[previous] && !data.previousWeek.claimed[previous]) {
        data.previousWeek.claimed[previous] = true;
        data.message = '上周预览奖励：' + [300, 500, 1000][previous] + '金币（未入账）';
    }
}

module.exports = { isEnabled, create, activate };
