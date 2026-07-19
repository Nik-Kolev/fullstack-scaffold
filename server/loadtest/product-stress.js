import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080/api';
const LOADTEST_USER_COUNT = 300;
const COLORS = ['Black', 'White', 'Red', 'Blue', 'Green'];
const SHAPES = ['Round', 'Square', 'Oval', 'Rectangle'];

// Total intended ramp across the whole test: 1 -> 2 -> 3 -> 100 -> 200 -> 300 -> 0.
// Each scenario below gets a fraction of this (40/30/20/10, matching the original
// weighted-random split), so the four scenarios TOGETHER reproduce the same total
// load as before — just split by request type so k6 can report latency per scenario
// instead of one number blending all four together.
const BASE_STAGES = [
	{ duration: '10s', target: 1 },
	{ duration: '10s', target: 2 },
	{ duration: '10s', target: 3 },
	{ duration: '30s', target: 100 },
	{ duration: '30s', target: 200 },
	{ duration: '30s', target: 300 },
	{ duration: '15s', target: 0 },
];

function scaleStages(fraction) {
	return BASE_STAGES.map(({ duration, target }) => ({
		duration,
		target: target === 0 ? 0 : Math.max(1, Math.round(target * fraction)),
	}));
}

export const options = {
	scenarios: {
		browse_list: {
			executor: 'ramping-vus',
			exec: 'browseList',
			stages: scaleStages(0.4),
		},
		browse_filtered: {
			executor: 'ramping-vus',
			exec: 'browseFiltered',
			stages: scaleStages(0.3),
		},
		direct_hit: {
			executor: 'ramping-vus',
			exec: 'hitDirect',
			stages: scaleStages(0.2),
		},
		auth_flow: {
			executor: 'ramping-vus',
			exec: 'authFlow',
			stages: scaleStages(0.1),
		},
	},
	thresholds: {
		http_req_failed: ['rate<0.01'],
		'http_req_duration{scenario:browse_list}': ['p(95)<300'],
		'http_req_duration{scenario:browse_filtered}': ['p(95)<300'],
		'http_req_duration{scenario:direct_hit}': ['p(95)<300'],
		'http_req_duration{scenario:auth_flow}': ['p(95)<800'],
	},
};

// Two distinct products — authFlow's like/unlike churn would otherwise
// invalidate the exact detail-cache entry direct_hit depends on, masking
// direct_hit's own cache-hit rate under a completely unrelated scenario's traffic.
export function setup() {
	const res = http.get(`${BASE_URL}/product?limit=2`);
	const products = res.json('products');
	return {
		directHitProductId: products[0] ? products[0].id : 1,
		authFlowProductId: products[1] ? products[1].id : 2,
	};
}

export function browseList() {
	const res = http.get(`${BASE_URL}/product?limit=10`);
	check(res, { 'list browse: 200': (r) => r.status === 200 });
	sleep(1);
}

export function browseFiltered() {
	const color = COLORS[Math.floor(Math.random() * COLORS.length)];
	const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
	const res = http.get(
		`${BASE_URL}/product?color=${color}&shape=${shape}&sortBy=price&order=asc&limit=10`,
	);
	check(res, { 'filtered browse: 200': (r) => r.status === 200 });
	sleep(1);
}

export function hitDirect(data) {
	const res = http.get(`${BASE_URL}/product/${data.directHitProductId}`);
	check(res, { 'direct hit: 200': (r) => r.status === 200 });
	sleep(1);
}

export function authFlow(data) {
	const userNum = Math.floor(Math.random() * LOADTEST_USER_COUNT) + 1;
	const loginRes = http.post(
		`${BASE_URL}/auth/login`,
		JSON.stringify({ email: `loadtest+${userNum}@test.local`, password: 'loadtest1' }),
		{ headers: { 'Content-Type': 'application/json' } },
	);
	const loggedIn = check(loginRes, { 'login: 200': (r) => r.status === 200 });
	if (!loggedIn) {
		sleep(1);
		return;
	}

	const token = loginRes.json('accessToken');
	const headers = { Authorization: `Bearer ${token}` };

	const likeRes = http.post(`${BASE_URL}/product/${data.authFlowProductId}/like`, null, {
		headers,
	});
	check(likeRes, {
		'like: 200 or 409 (already liked)': (r) => r.status === 200 || r.status === 409,
	});

	if (likeRes.status === 200) {
		const unlikeRes = http.del(`${BASE_URL}/product/${data.authFlowProductId}/like`, null, {
			headers,
		});
		check(unlikeRes, { 'unlike: 200': (r) => r.status === 200 });
	}

	sleep(1);
}
