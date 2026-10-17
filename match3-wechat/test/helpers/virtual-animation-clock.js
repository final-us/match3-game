'use strict';
// Local test clock: resolve equal deadlines together, then let promise continuations settle.
// A task boundary (rather than a fixed number of microtask ticks) preserves parallel phases.
function createClock(advance, checkpoint = () => new Promise(resolve => setImmediate(resolve))) {
    let now = 0, queue = [], tape = [];
    function wait(ms) {
        const start = now;
        tape.push({ start, duration: ms, end: start + ms });
        return new Promise(resolve => queue.push({ end: start + ms, resolve }));
    }
    async function drain(pending) {
        let done = false, failure;
        Promise.resolve(pending).then(() => { done = true; }, error => { failure = error; done = true; });
        while (!done) {
            await checkpoint();
            if (done) break;
            if (!queue.length) throw new Error('Animation promise stalled without a scheduled wait');
            const next = Math.min(...queue.map(item => item.end));
            advance(next - now);
            now = next;
            const ready = queue.filter(item => item.end === next);
            queue = queue.filter(item => item.end !== next);
            ready.forEach(item => item.resolve());
        }
        if (failure) throw failure;
    }
    function reset() {
        if (queue.length) throw new Error('Cannot reset a pending animation');
        now = 0; tape = [];
    }
    return { wait, drain, reset, get now() { return now; }, get tape() { return tape; } };
}
module.exports = createClock;
