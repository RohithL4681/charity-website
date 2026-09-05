/* Inline Razorpay Checkout for the donate page.
   Flow: pick amount -> POST /api/create-order -> open Razorpay modal ->
   on success verify signature via /api/verify-payment -> redirect to /thank-you/ with IDs.
   No payment secret ever touches the browser. */
(function () {
  'use strict';

  var app = document.getElementById('donate-app');
  if (!app) return;

  var options = Array.prototype.slice.call(app.querySelectorAll('.amount-option'));
  var customInput = document.getElementById('custom-amount');
  var donateBtn = document.getElementById('donate-now-btn');
  var statusEl = document.getElementById('donate-status');

  var selected = null;

  function setSelected(el) {
    selected = el;
    options.forEach(function (opt) {
      var isSel = opt === el;
      opt.setAttribute('aria-checked', isSel ? 'true' : 'false');
    });
    if (customInput) customInput.value = '';
  }

  options.forEach(function (opt) {
    opt.addEventListener('click', function () {
      setSelected(opt);
    });
  });

  if (customInput) {
    customInput.addEventListener('input', function () {
      if (customInput.value) {
        selected = null;
        options.forEach(function (opt) {
          opt.setAttribute('aria-checked', 'false');
        });
      }
    });
  }

  function setStatus(text, isError) {
    if (!statusEl) return;
    statusEl.textContent = text || '';
    statusEl.style.color = isError ? '#B91C1C' : '';
  }

  function getAmount() {
    if (selected) return Number(selected.dataset.amount);
    if (customInput) {
      var v = Number(customInput.value);
      return v > 0 ? v : 0;
    }
    return 0;
  }

  function loadCheckoutScript() {
    return new Promise(function (resolve) {
      if (window.Razorpay) return resolve();
      var script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = resolve;
      script.onerror = function () {
        setStatus('Unable to load the payment window. Please try again.', true);
      };
      document.head.appendChild(script);
    });
  }

  donateBtn.addEventListener('click', async function () {
    var amount = getAmount();
    if (!amount) {
      setStatus('Please choose an amount or enter a custom amount.', true);
      return;
    }

    donateBtn.disabled = true;
    donateBtn.textContent = 'Starting payment…';
    setStatus('');

    try {
      await loadCheckoutScript();

      var orderRes = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amount }),
      });
      var order = await orderRes.json();

      if (!orderRes.ok || !order.order_id) {
        throw new Error(order.error || 'Could not create the payment order.');
      }

      var rzp = new window.Razorpay({
        key: order.key_id,
        order_id: order.order_id,
        amount: order.amount,
        currency: order.currency,
        name: document.querySelector('.brand-name')
          ? document.querySelector('.brand-name').textContent
          : 'Donation',
        description: 'Donation to charity',
        theme: { color: '#F97316' },
        handler: async function (response) {
          try {
            var verifyRes = await fetch('/api/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            var verify = await verifyRes.json();

            var params = new URLSearchParams({
              payment_id: response.razorpay_payment_id,
              order_id: response.razorpay_order_id,
              amount: String(order.amount / 100),
            });
            var valid = verify && verify.valid;
            params.set('verified', valid ? 'yes' : 'no');
            window.location.href = '/thank-you/?' + params.toString();
          } catch (e) {
            setStatus('Payment received but confirming it failed. Contact us with your payment ID.', true);
          }
        },
        modal: {
          ondismiss: function () {
            donateBtn.disabled = false;
            donateBtn.textContent = 'Donate now';
            setStatus('Payment cancelled. You can try again anytime.', true);
          },
        },
      });

      rzp.open();
    } catch (e) {
      donateBtn.disabled = false;
      donateBtn.textContent = 'Donate now';
      setStatus(e.message || 'Something went wrong. Please try again.', true);
    }
  });
})();