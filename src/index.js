var responseTime = require('koa-response-time');
var compress = require('koa-compress');
var logger = require('koa-logger');
var koa = require('koa');
var koaBody = require('koa-body');
var koaSession = require('koa-session');
var path = require('path');
var env = process.env.NODE_ENV || 'development';

module.exports = www;

function www(opts) {
    var app = koa();
    var gu = require('koa-gu').init(path.resolve(__dirname, '..'));
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
    app.use(gu.router.routes());
    app.use(gu.router.allowedMethods());

    return app;
}
