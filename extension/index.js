'use strict';

const EventEmitter = require('events');
const Streamtip = require('streamtip');
const util = require('./util');

const emitter = new EventEmitter();

module.exports = function (nodecg) {
	// Check that config is present and valid
	if (!nodecg.bundleConfig) {
		throw new Error('No config found in cfg/lfg-streamtip.json, aborting!');
	} else if (typeof nodecg.bundleConfig.clientId !== 'string') {
		throw new Error('StreamTip clientId not present in config! Should be a string. Aborting.');
	} else if (typeof nodecg.bundleConfig.accessToken !== 'string') {
		throw new Error('StreamTip accessToken not present in config! Should be a string. Aborting.');
	}

	const streamtip = new Streamtip({
		clientId: nodecg.bundleConfig.clientId,
		accessToken: nodecg.bundleConfig.accessToken
	});
	const tops = nodecg.Replicant('tops', {defaultValue: {monthly: {}, daily: {}}});

	// Get what Streamtip believes is current tops, overwrite our own only if they are larger
	// Reason for this is streams may run over the 'day' boundary, and we don't want to lose current top
	// if NodeCG should be restarted
	util.queryTops(streamtip, nodecg.log, stTops => {
		Object.keys(tops.value).forEach(period => {
			if (stTops[period] !== null && stTops[period].cents > tops.value[period].cents) {
				tops.value[period] = stTops[period];
			}
		});
	});

	streamtip.on('connected', () => {
		nodecg.log.info('Connected to StreamTip');
	});

	streamtip.on('authenticated', () => {
		// Now authenticated, we can expect tip alerts to come through
		nodecg.log.info('Authenticated with StreamTip');
	});

	streamtip.on('authenticationFailed', () => {
		// ClientID or Access Token was rejected
		nodecg.log.error('Authentication failed!');
	});

	streamtip.on('newTip', tip => {
		// We got a new tip.
		// 'tip' is an object which matches the description given on the Streamtip API page
		const newTops = util.compareTops(tip, tops.value);
		let top = null;
		Object.keys(newTops).forEach(period => {
			if (newTops[period] !== null) {
				tops.value[period] = newTops[period];
				top = top ? top : period; // Don't touch top if it's already set
			}
		});
		tip.top = top;

		emitter.emit('tip', tip);
		nodecg.sendMessage('tip', tip);
	});

	streamtip.on('error', err => {
		// An unexpected error occurred
		nodecg.log.error('Error! %s', err.message);
	});

	emitter.resetPeriod = function (period) {
		tops.value[period] = {};
	};

	nodecg.listenFor('resetPeriod', emitter.resetPeriod);

	return emitter;
};
