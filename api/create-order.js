// Vercel serverless function: creates a Razorpay order.
// The Key Secret is read from process.env.RAZORPAY_KEY_SECRET (set in Vercel),
// so it is never exposed to the browser.
//
// Expected request body (JSON): { amount (INR, number) }
// Response: { key_id, order_id, amount, currency } or { error }

const MIN_AMOUNT = 10; // INR
const MAX_AMOUNT = 100000; // INR

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return json(res, 500, {
      error: 'Server is not configured for payments. Please contact the site owner.',
    });
  }

  let amount;
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    amount = Number(body.amount);
  } catch (e) {
    return json(res, 400, { error: 'Invalid request body.' });
  }

  // Validate amount server-side (never trust the client).
  if (!Number.isFinite(amount)) {
    return json(res, 400, { error: 'Please enter a valid amount.' });
  }
  if (amount < MIN_AMOUNT) {
    return json(res, 400, { error: 'Minimum donation is ₹' + MIN_AMOUNT + '.' });
  }
  if (amount > MAX_AMOUNT) {
    return json(res, 400, { error: 'Maximum donation is ₹' + MAX_AMOUNT + '. Please contact us for larger gifts.' });
  }

  const amountInPaise = Math.round(amount * 100);

  try {
    const auth = Buffer.from(keyId + ':' + keySecret).toString('base64');
    const rpRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + auth,
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: 'INR',
        receipt: 'don_' + Date.now(),
        notes: { via: 'brighthope-website' },
      }),
    });

    const data = await rpRes.json();
    if (!rpRes.ok || !data.id) {
      console.error('Razorpay order creation failed:', rpRes.status, JSON.stringify(data));
      return json(res, 502, {
        error: 'Payment gateway could not create the order. Please try again in a moment.',
      });
    }

    return json(res, 200, {
      key_id: keyId,
      order_id: data.id,
      amount: data.amount,
      currency: data.currency,
    });
  } catch (e) {
    console.error('create-order error:', e && e.message);
    return json(res, 500, {
      error: 'Something went wrong while starting your donation. Please try again.',
    });
  }
};