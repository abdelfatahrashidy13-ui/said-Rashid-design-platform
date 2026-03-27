
export default async function handler(req, res) {
  try {
    const { amount, email } = req.body;

    const auth = await fetch("https://accept.paymob.com/api/auth/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.PAYMOB_API_KEY
      })
    }).then(r => r.json());

    const order = await fetch("https://accept.paymob.com/api/ecommerce/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        auth_token: auth.token,
        delivery_needed: false,
        amount_cents: amount * 100,
        currency: "EGP",
        items: []
      })
    }).then(r => r.json());

    res.json({ orderId: order.id, token: auth.token, email: email || null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
