/**
 * 云函数对战客户端封装
 * 用 wx.cloud.callFunction + 轮询替代 WebSocket
 */

const CLOUD_ENV = 'cloud1-d9g4pv8m8457af92a'; // 云开发环境 ID
const ROOM_ID_PATTERN = /^R[0-9a-z]{8,10}[0-9a-f]{10}$/;
let initFailure = null;

// 只提取平台数字错误码与固定分类，不保留原始消息、请求 ID 或身份字段。
function summarizeError(error) {
    const value = error || {};
    const message = typeof value.errMsg === 'string' ? value.errMsg : (typeof value.message === 'string' ? value.message : '');
    const labelledCode = message.match(/\berrCode\s*:\s*(-?\d{1,10})(?!\d)/i);
    const candidates = [value.errCode, value.code, labelledCode && labelledCode[1]];
    let code = 'NA';
    for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i];
        if ((typeof candidate === 'number' || typeof candidate === 'string') && /^-?\d{1,10}$/.test(String(candidate))) {
            code = String(candidate);
            break;
        }
    }
    let kind = 'UNKNOWN';
    if (/timeout|timed out|超时/i.test(message)) kind = 'TIMEOUT';
    else if (/permission|unauthori[sz]ed|access denied|无权限|权限不足/i.test(message)) kind = 'PERMISSION';
    else if (/quota|arrears|欠费|配额/i.test(message)) kind = 'QUOTA';
    else if (/environment|invalid env|环境/i.test(message)) kind = 'ENV';
    else if (/network|网络|offline/i.test(message)) kind = 'NETWORK';
    return { code: code, kind: kind };
}

function clientChannel() {
    try {
        const info = wx.getAccountInfoSync();
        const channel = info && info.miniProgram && info.miniProgram.envVersion;
        if (['develop', 'trial', 'release'].indexOf(channel) !== -1) return channel;
    } catch (e) { /* 老基础库无此信息时，明确标记未知。 */ }
    return 'unknown';
}

// 临时开发版诊断：只保留技术词汇，未知文本/地址/身份信息一律隐藏。
// 不直接显示原始 errMsg，避免平台错误附带 token、OpenID 或请求参数。
function safeErrorText(message) {
    const words = ('wx.cloud.callfunction cloud.callfunction callfunction request fail failed failure error ' +
        'errcode errmsg code errno network system internal unknown timeout timed out offline online ' +
        'url domain list whitelist allowlist not in invalid illegal legal blocked denied forbidden ' +
        'permission permissions unauthorized auth authentication authorization login session expired ' +
        'dns resolve resolution host hostname ip address connect connection connecting disconnected ' +
        'reset refused abort aborted cancel cancelled canceled socket ssl tls certificate cert verify ' +
        'verification handshake protocol https http secure security proxy tunnel environment env ' +
        'cloud function functions resource resources service server client sdk api access limit ' +
        'quota exceed exceeded unavailable unsupported disabled enabled missing empty null undefined ' +
        'true false unsupported operation response status bad gateway busy overload suspended ' +
        'request:fail err_failed err_connection_refused err_connection_reset err_name_not_resolved ' +
        'err_cert_authority_invalid err_ssl_protocol_error econnreset econnrefused enotfound etimedout ' +
        'eai_again epipe not found is are a an the of to for on and or with from unable cannot ' +
        'please check config configuration configure scope scopes privacy agreement authorization ' +
        'require required requires support supported version base library devtools development release').split(' ');
    const chinese = /合法域名|域名|白名单|校验|网络|请求|失败|超时|连接|拒绝|证书|权限|授权|隐私|协议|环境|云函数|云开发|未开通|未开启|已停用|已过期|未登录|未配置|不存在|不支持|不可用|无法|访问|异常|错误|初始化|服务器|系统|开发版|正式版|基础库|客户端|服务端|调用|欠费|配额|上限|解析|不在|列表|中|[\u4e00-\u9fff]/g;
    return message.slice(0, 4096)
        .replace(/\b(?:token|access_token|refresh_token|authorization|cookie|openid|unionid|appid|requestid|request_id|traceid|session_key|password|secret|nickname|email|phone)\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;|]+)/gi, '\u0001')
        .replace(/(?:https?:\/\/|wss?:\/\/)[^\s|<>]+/gi, '\u0001')
        .replace(/[A-Za-z_][A-Za-z0-9_.-]*|-?\d+(?:\.\d+)*/g, function (word) {
            return words.indexOf(word.toLowerCase()) !== -1 ? word : '\u0001';
        })
        .replace(chinese, function (word) { return word.length > 1 || word === '中' ? word : '\u0001'; })
        .replace(/[^A-Za-z\u4e00-\u9fff\u0001_:.,|()/\s-]/g, '\u0001')
        .replace(/(?:\u0001[\s:.,|()/\u0001-]*)+/g, '[隐藏] ')
        .replace(/\s+/g, ' ').trim().slice(0, 240);
}

function developmentDetails(error) {
    const codes = [];
    const messages = [];
    const seen = [];
    const queue = [{ value: error, depth: 0 }];
    function addCode(value) {
        if ((typeof value === 'number' || typeof value === 'string') && /^-?\d{1,10}$/.test(String(value))) {
            const code = String(value);
            if (codes.indexOf(code) === -1 && codes.length < 6) codes.push(code);
        }
    }
    while (queue.length && seen.length < 4) {
        const item = queue.shift();
        const value = item.value;
        if (!value || typeof value !== 'object' || seen.indexOf(value) !== -1) continue;
        seen.push(value);
        ['errCode', 'code', 'errno'].forEach(function (key) { addCode(value[key]); });
        ['errMsg', 'message'].forEach(function (key) {
            if (typeof value[key] !== 'string') return;
            const message = value[key].slice(0, 4096);
            const labelled = /\b(?:errCode|code|errno)\s*[:=]\s*(-?\d{1,10})(?![\w.])/gi;
            let match;
            while ((match = labelled.exec(message))) addCode(match[1]);
            const safe = safeErrorText(message);
            if (safe && messages.indexOf(safe) === -1 && messages.length < 2) messages.push(safe);
        });
        if (item.depth < 2) ['cause', 'error', 'details'].forEach(function (key) {
            queue.push({ value: value[key], depth: item.depth + 1 });
        });
    }
    return { codes: codes.join(','), text: messages.join(' | ').slice(0, 320) };
}

function callFailure(error, stage, initialization) {
    const channel = clientChannel();
    const diagnostic = {
        stage: stage,
        error: summarizeError(error),
        init: initialization,
        channel: channel
    };
    if (channel === 'develop') diagnostic.details = developmentDetails(error);
    return { battleDiagnostic: diagnostic };
}

function describeCreateFailure(error, service) {
    const channels = { develop: '开发版', trial: '体验版', release: '正式版', unknown: '未知' };
    if (service) {
        const codes = { '身份校验失败': 'IDENTITY', '服务异常': 'SERVICE', '未知操作': 'ACTION' };
        const code = error && Object.prototype.hasOwnProperty.call(codes, error.err) ? codes[error.err] : 'RESPONSE';
        return '诊断：D1/SERVER/' + code + '\n版本：' + channels[clientChannel()] + '\n服务器已返回，请将此提示截图反馈。';
    }
    const diagnostic = error && error.battleDiagnostic;
    const stage = diagnostic && diagnostic.stage === 'SDK' ? 'SDK' : 'CALL';
    const summary = diagnostic ? diagnostic.error : summarizeError(error);
    const channel = diagnostic ? diagnostic.channel : clientChannel();
    const details = diagnostic && channel === 'develop' && clientChannel() === 'develop' && diagnostic.details;
    let text = '诊断：' + (details ? 'D2/' : 'D1/') + stage + '/' + summary.code + '/' + summary.kind + '\n版本：' + channels[channel];
    if (diagnostic && diagnostic.init) {
        text += '\n初始化：' + diagnostic.init.code + '/' + diagnostic.init.kind;
    }
    if (details) {
        text += '\n错误链：' + (details.codes || '无数字码');
        text += '\n脱敏说明：' + (details.text || '平台未提供文字说明');
    }
    return text + '\n请将此提示截图反馈；错误分类仅供排查。';
}

function describeDailyFailure(error, service) {
    if (service) {
        const message = error && typeof error.err === 'string' ? error.err : '';
        if (message === '未知操作') return '每日挑战暂未开放';
        if (message === '身份校验失败' || message === '挑战身份不符') return '登录状态已失效，请重新进入游戏';
        if (message === '每日挑战开局过于频繁') return '操作过于频繁，请稍后再试';
        if (message === '挑战已过期') return '本次挑战已过期，请重新开始';
        if (message === '服务异常') return '每日挑战服务暂时不可用，请稍后重试';
        return '暂时无法连接每日挑战，请稍后重试';
    }
    const diagnostic = error && error.battleDiagnostic;
    const stage = diagnostic && diagnostic.stage;
    const summary = diagnostic ? diagnostic.error : summarizeError(error);
    if (stage === 'SDK') return '当前微信版本暂不支持每日挑战';
    if (summary.kind === 'TIMEOUT') return '连接超时，请稍后重试';
    if (summary.kind === 'NETWORK') return '网络连接失败，请检查网络后重试';
    return '暂时无法连接每日挑战，请稍后重试';
}

function isValidRoomId(value) {
    return typeof value === 'string' && ROOM_ID_PATTERN.test(value);
}

function init() {
    initFailure = null;
    if (typeof wx !== 'undefined' && wx.cloud) {
        try {
            wx.cloud.init({ env: CLOUD_ENV });
        } catch (e) {
            initFailure = summarizeError(e);
        }
    }
}

/**
 * 调用 battle 云函数
 * @param {string} action create/join/configureItems/ready/syncScore/useItem/leave/query
 * @param {object} data 附加参数
 * @returns {Promise<object>} 云函数返回的 result
 */
function call(action, data, options) {
    return new Promise(function (resolve, reject) {
        if (typeof wx === 'undefined' || !wx.cloud) {
            reject(callFailure(null, 'SDK', initFailure));
            return;
        }
        const payload = Object.assign({ action: action }, data || {});
        const initialization = initFailure;
        let settled = false;
        let timer = null;
        function finish(failed, value) {
            if (settled) return;
            settled = true;
            if (timer !== null) clearTimeout(timer);
            if (failed) reject(callFailure(value, 'CALL', initialization));
            else resolve(value || {});
        }
        if (options && Number.isFinite(options.timeoutMs) && options.timeoutMs > 0) {
            timer = setTimeout(function () {
                finish(true, { errMsg: 'request timeout' });
            }, options.timeoutMs);
        }
        try {
            wx.cloud.callFunction({
                name: 'battle',
                data: payload,
                success: function (res) {
                    finish(false, res && res.result);
                },
                fail: function (err) {
                    finish(true, err);
                }
            });
        } catch (error) {
            finish(true, error);
        }
    });
}

module.exports = {
    CLOUD_ENV: CLOUD_ENV,
    isValidRoomId: isValidRoomId,
    init: init,
    describeCreateFailure: describeCreateFailure,
    describeDailyFailure: describeDailyFailure,
    call: call
};
