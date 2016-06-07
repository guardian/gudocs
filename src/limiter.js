import gu from 'koa-gu'
import Bottleneck from 'bottleneck'
import { _ } from 'lodash'

var limiters = [];
var timeout;

function logLimiters() {
    var statuses = limiters.map(({name, limiter}) => `${name}: ${limiter.nbQueued()} queued`);
    gu.log.info('Limiters - ' + statuses.join(', '));

    var queueSizes = limiters.map(l => l.limiter.nbQueued());
    timeout = _.sum(queueSizes) > 0 ? setTimeout(logLimiters, 20000) : undefined;
}

export default function createLimiter(name, ms) {
    var limiter = new Bottleneck(1, ms);
    limiters.push({name, limiter});

    function schedule(priority, fn, ...args) {
        if (!timeout) timeout = setTimeout(logLimiters, 20000);
        return limiter.schedulePriority(priority, fn, ...args);
    }

    return {
        'normal': schedule.bind(null, 1),
        'high': schedule.bind(null, 0)
    };
}
