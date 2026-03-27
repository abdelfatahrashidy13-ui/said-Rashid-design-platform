export default async function handler(req, res) {
  try {
    const { amount, email, firstName = 'User', lastName = 'AI' } = req.body;
    const auth = await fetch('https://accept.paymob.com/api/auth/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: process.env.PAYMOB_API_KEY })
    }).then(r => r.json());

    const order = await fetch('https://accept.paymob.com/api/ecommerce/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_token: auth.token,
        delivery_needed: false,
        amount_cents: Math.round(Number(amount) * 100),
        currency: 'EGP',
        items: []
      })
    }).then(r => r.json());

    const paymentKey = await fetch('https://accept.paymob.com/api/acceptance/payment_keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_token: auth.token,
        amount_cents: Math.round(Number(amount) * 100),
        expiration: 3600,
        order_id: order.id,
        billing_data: {
          apartment: 'NA',
          email: email || 'user@example.com',
          floor: 'NA',
          first_name: firstName,
          street: 'NA',
          building: 'NA',
          phone_number: '01000000000',
          shipping_method: 'NA',
          postal_code: 'NA',
          city: 'Cairo',
          country: 'EG',
          last_name: lastName,
          state: 'Cairo'
        },
        currency: 'EGP',
        integration_id: Number(process.env.PAYMOB_INTEGRATION_ID)
      })
    }).then(r => r.json());

    const iframeUrl = `https://accept.paymob.com/api/acceptance/iframes/${process.env.PAYMOB_IFRAME_ID}?payment_token=${paymentKey.token}`;
    res.json({ success: true, iframeUrl, orderId: order.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
}
