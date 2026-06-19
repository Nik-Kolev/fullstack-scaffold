const BASE_URL = 'http://localhost:8080';

// 1. Login to get an access token
const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify({ email: 'ngkolev93@gmail.com', password: '1234' }),
});
const { accessToken } = await loginRes.json();
console.log('Got token:', accessToken ? 'yes' : 'NO TOKEN - check credentials or run db:seed');

// 2. Create a checkout session
const checkoutRes = await fetch(`${BASE_URL}/api/payment/checkout`, {
	method: 'POST',
	headers: {
		'Content-Type': 'application/json',
		Authorization: `Bearer ${accessToken}`,
	},
	body: JSON.stringify({ amountTotal: 999, quantity: 1, description: 'Test Payment' }),
});
const data = await checkoutRes.json();

if (!checkoutRes.ok) {
	console.error('Checkout failed:', data);
	process.exit(1);
}

console.log('\nCheckout URL ready. Open it in your browser:\n');
console.log(data.url);
console.log('\nTest card: 4242 4242 4242 4242 | any future expiry | any CVC');
console.log('Watch Terminal 1 (server) + Terminal 2 (stripe listen) for the webhook hit.');
