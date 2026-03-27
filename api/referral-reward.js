import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    if (!profile.referred_by) return res.json({ success: true, message: 'No referral found' });
    const { data: inviter } = await supabase.from('profiles').select('*').eq('referral_code', profile.referred_by).single();
    if (!inviter) return res.status(404).json({ error: 'Inviter not found' });
    await supabase.from('profiles').update({ credits: (inviter.credits || 0) + 20, referral_credits_earned: (inviter.referral_credits_earned || 0) + 20 }).eq('id', inviter.id);
    await supabase.from('profiles').update({ credits: (profile.credits || 0) + 10, referred_by: null }).eq('id', profile.id);
    res.json({ success: true, message: 'Referral reward applied' });
  } catch (err) { res.status(500).json({ error: err.message }); }
}
