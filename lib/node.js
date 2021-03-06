const debug        = require('debug');
const Immutable    = require('immutable');
const {Context}    = require('./context');
const {PID, Ref, LOCAL} = require('./types');

const log = debug('open-telecom:node');

function create_node(adapter = {}) {
    class OTPNode {
        constructor() {
            this.contexts  = Immutable.Map();
            this.registered = Immutable.Map();
            this._pids     = 0;
            this._refs     = 0;

            if (adapter.register_node) {
                setImmediate(async () => {
                    log('register_node');
                    this.node_id = await adapter.register_node(this);
                });
            }

            if (adapter.system_process) {
                this.spawn(adapter.system_process);
            }
        }

        register(ctx, name) {
            if (this.registered.has(name))
                return false;

            this.registered = this.registered.set(name, ctx.self());

            (async () => {
                await ctx.death;
                this.registered = this.registered.delete(name);
            })()

            return true;
        }

        whereis(name) {
            if (this.registered.has(name)) {
                return this.registered.get(name);
            }

            return undefined;
        }

        ref() {
            return Ref.of(LOCAL, this._refs++);
        }

        make_ref() {
            return this.ref();
        }

        spawn(fun) {
            const ctx = this.make_context();
            (async () => {
                log('spawn : begin : %o', ctx.self());
                await fun(ctx);
                log('spawn : end : %o', ctx.self());
                ctx.destroy();
            })();

            return ctx.self();
        }

        spawn_link(linked, fun) {
            const ctx = this.make_context();
            ctx.link(linked);
            (async () => {
                log('spawn_link : begin : %o', ctx.self());
                await fun(ctx);
                log('spawn_link : end : %o', ctx.self());
                ctx.destroy();
            })();

            return ctx.self();
        }

        make_context() {
            const pid = PID.of(LOCAL, this._pids++);

            log('make_context');

            const ctx   = new Context(this, pid);
            this.contexts = this.contexts.set(pid, ctx);

            return ctx;
        }

        deliver(message, tryAdapter = true) {
            let {to} = message;

            log('deliver : %o', message);

            if (!(to instanceof PID)) {
                log('deliver : whereis : %o', to);
                to = this.whereis(to);
            }

            if (to.node == LOCAL) {
                log('deliver : local : to : %o', to);
                log('deliver : local : contexts : %o', this.contexts);

                const ctx = this.contexts.get(to);

                log('deliver : local : ctx : %o', ctx);

                if (ctx)
                    ctx.deliver(message.msg);
            }

            if (tryAdapter && adapter.deliver) {
                if (adapter.externalize) {
                    message = adapter.externalize(this, message);
                }

                return adapter.deliver(message);
            }
        }

        send(to, msg) {
            log('send : to : %o', to);
            log('send : msg : %o', msg);
            this.deliver({to, msg});
        }

        destroy(pid) {
            log('destroy : %o', pid);
            this.contexts = this.contexts.delete(pid);
        }

        process_info(pid) {
            const context = this.contexts.get(pid);
            return context;
        }
    };

    return {OTPNode};
}

module.exports = {
    create_node,
    Ref,
    PID,
};
