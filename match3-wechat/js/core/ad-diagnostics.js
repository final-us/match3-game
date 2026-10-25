/** 开发环境的有界内存观测，不持久化、不上报。 */
module.exports = function (getStore) {
    let sequence = 0, active = false, latest = null;
    const lines = [];
    function detectEnvironment() {
        const store = getStore();
        if (!store) return false;
        let channel;
        try { channel = store.getAccountInfoSync().miniProgram.envVersion; } catch (error) {}
        if (channel === 'release' || channel === 'trial') return false;
        if (channel === 'develop') return true;
        try { return store.getDeviceInfo().platform === 'devtools'; } catch (error) { return false; }
    }
    function record(request, stage, code) {
        if (!active) return;
        if (stage === 'show_call') request.presentedAt = Date.now();
        lines.push('D2 #' + request.id + ' ' + Math.max(0, Date.now() - request.start) + 'ms ' +
            request.label + ' ' + stage + '/' + (code == null ? '-' : code));
        if (lines.length > 40) lines.shift();
    }
    return {
        enabled: function () { return active; },
        request: function (placement) {
            active = detectEnvironment();
            if (!active) lines.length = 0;
            const request = { id: ++sequence, start: Date.now(), label:
                ['revive', 'heart_refill', 'shop_item', 'solo_item', 'solo_result'].indexOf(placement) >= 0 ? placement : 'unknown' };
            latest = request;
            record(request, 'request');
            return request;
        },
        record: record,
        getLines: function () {
            if (!active) return [];
            const c = latest && latest.context;
            if (!c) return lines.slice();
            const gap = key => Number.isFinite(latest.presentedAt) && Number.isFinite(c[key])
                ? Math.round(latest.presentedAt-c[key])+'ms' : '-';
            const prefix = 'D2 ctx #'+latest.id+' ';
            return [prefix+'music='+(c.music===true?1:0)+' sfx='+(c.sfx===true?1:0)+' audio='+gap('audioPausedAt'),
                prefix+'modal S='+gap('modalSuccessAt')+' C='+gap('modalCompleteAt')+' toast='+gap('toastAt')]
                .concat(lines.slice(-38));
        }
    };
};
