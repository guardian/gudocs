import gu from '@guardian/koa-gu'
import Bottleneck from 'bottleneck'

const  _ = require('lodash');
const limiters = [];

var timeout;

function logLimiters() {
    const statuses = limiters.map(({name, limiter}) => `${name}: ${limiter.queued()} queued`);
    gu.log.info('Limiters - ' + statuses.join(', '));

    const queueSizes = limiters.map(l => l.limiter.queued());
    timeout = _.sum(queueSizes) > 0 ? setTimeout(logLimiters, 5000) : undefined;
}

export default function createLimiter(name, ms) {
    const limiter = new Bottleneck({maxConcurrent: 1, minTime: ms});
    limiters.push({name, limiter});

    function schedule(priority, fn, ...args) {
        if (!timeout) timeout = setTimeout(logLimiters, 5000);
        return limiter.schedule({priority}, fn, ...args);
    }

    return {
        'normal': schedule.bind(null, 1),
        'high': schedule.bind(null, 0)
    };
}