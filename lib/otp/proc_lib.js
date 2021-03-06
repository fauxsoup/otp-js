const debug = require('debug');
const Immutable = require('immutable');

const log = debug('open-telecom:otp:proc_lib');

async function start(ctx, fun, timeout = 5000) {
    const self    = ctx.self();
    const spawned = ctx.spawn((ctx) => fun(ctx, self));

    log('spawned : %O', spawned);

    await ctx.receive(({init_ack, pid}) => {
        log('start : init_ack : %o', init_ack);
        log('start : pid : %o', pid);
        log('start : self : %o', self);
        return init_ack && Immutable.is(pid, spawned);
    }, timeout);

    const ok = true;
    return {ok, pid: spawned};
}

async function start_link(ctx, fun, timeout = 5000) {
    const self    = ctx.self();
    const spawned = ctx.spawn_link(ctx => fun(ctx, self));

    log('spawned : %O', spawned);

    await ctx.receive(({init_ack, pid}) => {
        return init_ack && Immutable.is(pid, spawned);
    }, timeout);

    const ok = true;
    return {ok, pid: spawned};
}

async function init_ack(ctx, sender) {
    const init_ack = true;
    const pid      = ctx.self();
    ctx.send(sender, {init_ack, pid});
}

module.exports = {
    start,
    start_link,
    init_ack,
};
