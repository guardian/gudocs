import gu from '@guardian/koa-gu'
import responseTime from 'koa-response-time'
import compress from 'koa-compress'
import logger from 'koa-logger'
import koa from 'koa'
import koaBody from 'koa-body'
import koaSession from 'koa-session'

const env = process.env.NODE_ENV || 'development'

module.exports = www;

async function www() {
    await gu.init();

    const app = new koa();

    app.keys = [gu.config.secret];

    // logging
    if ('test' !== env) app.use(logger());

    // errors
    app.use(async (ctx, next) => {
        try {
            await next();
        } catch (e) {
            ctx.status = e.statusCode || e.status || 500;
            ctx.body = "internal error";
            ctx.app.emit('error', e, this);
        }
    });

    app.use(responseTime());
    app.use(compress());
    app.use(koaBody());
    app.use(koaSession(app));


    if (gu.config.base_url[gu.config.base_url.length -1] !== '/') {
        app.use(async (ctx, next) => {
            if (ctx.path === '/' || ctx.path === gu.config.base_url) {
                ctx.redirect(gu.config.base_url + '/')
            } else await next();
        })
    }

    app.use(gu.router.routes());
    app.use(gu.router.allowedMethods());

    return app;
}
