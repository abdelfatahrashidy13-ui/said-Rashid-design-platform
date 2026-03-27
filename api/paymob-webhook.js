
export default async function handler(req, res) {
  const event = req.body;
  // اربط هنا تحديث Supabase بعد نجاح الدفع
  return res.json({ received: true, event });
}
