// Vercel serverless function: verifies the Razorpay payment signature.
// Uses the Key Secret from the environment to compute the expected
// HMAC-SHA256 and compares it with the signature returned to the browser.

const crypto = require('crypto');

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    return json(res, 500, { error: 'Server is not configured for payments.' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  } catch (e) {
    return json(res, 400, { error: 'Invalid request body.' });
  }

  const orderId = String(body.razorpay_order_id || '');
  const paymentId = String(body.razorpay_payment_id || '');
  const signature = String(body.razorpay_signature || '');

  if (!orderId || !paymentId || !signature) {
    return json(res, 400, { error: 'Missing payment details.' });
  }

  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(orderId + '|' + paymentId)
    .digest('hex');

  const valid = expected === signature;
  json(res, 200, { valid: valid, order_id: orderId, payment_id: paymentId });
};