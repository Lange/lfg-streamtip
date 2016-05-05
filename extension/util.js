'use strict';

const async = require('async');

module.exports.queryTops = function (streamtip, log, callback) {
	const now = new Date();
	/* eslint-disable camelcase */
	async.parallel({
		daily(cb) {
			streamtip.api.getAllTips({
				date_from: new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(),
				limit: 1,
				sort_by: 'amount'
			}, cb);
		},
		monthly(cb) {
			streamtip.api.getAllTips({
				date_from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
				limit: 1,
				sort_by: 'amount'
			}, cb);
		}
	}, (err, results) => {
		const ret = {daily: null, monthly: null};

		if (err) {
			log.warn('Unable to query tops from Streamtip!');
			return callback(ret);
		}

		ret.daily = results.daily.length === 1 ? results.daily[0] : null;
		ret.monthly = results.monthly.length === 1 ? results.monthly[0] : null;

		callback(ret);
	});
	/* eslint-enable camelcase */
};

module.exports.compareTops = function (tip, tops) {
	const ret = {monthly: null, daily: null};

	Object.keys(tops).forEach(period => {
		if (!tops[period] || tip.cents > tops[period].cents) {
			ret[period] = tip;
		}
	});

	return ret;
};
