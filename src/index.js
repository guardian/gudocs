import gu from '@guardian/koa-gu'
import responseTime from 'koa-response-time'
import compress from 'koa-compress'
import logger from 'koa-logger'
import koa from 'koa'
import koaBody from 'koa-body'
import koaSession from 'koa-session'
import path from 'path'

var env = process.env.NODE_ENV || 'development'

module.exports = www;

function www(opts) {
    gu.init();
    var app = koa();

    app.keys = [gu.config.secret];

    // logging
    if ('test' != env) app.use(logger());

    // errors
    app.use(function* (next) {
        this.err = function(msg) {};
        yield next;
    });

    app.use(function* (next) {
        try {
            yield next;
        } catch (e) {
            this.status = e.status || 500;
            this.body = "internal error";
            this.app.emit('error', e, this);
        }
    });

    app.use(responseTime());
    app.use(compress());
    app.use(koaBody());
    app.use(koaSession(app));


    if (gu.config.base_url[gu.config.base_url.length -1] !== '/') {
        app.use(function*(next) {
            if (this.path === '/' || this.path === gu.config.base_url) {
                this.redirect(gu.config.base_url + '/')
            } else yield* next;
        })
    }

    app.use(gu.router.routes());
    app.use(gu.router.allowedMethods());

    return app;
}
