import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
export default async function handler(req, res) {
  try {
    const adminSecret = req.headers['x-admin-secret'];
    if (adminSecret !== process.env.ADMIN_SECRET) return res.status(401).json({ error: 'Unauthorized' });
    const { data: profiles } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    const { data: generations } = await supabase.from('generations').select('*').order('created_at', { ascending: false }).limit(20);
    const totalUsers = profiles?.length || 0;
    const paidUsers = (profiles || []).filter(p => p.plan && p.plan !== 'free').length;
    const totalCredits = (profiles || []).reduce((sum, p) => sum + (p.credits || 0), 0);
    const totalReferrals = (profiles || []).filter(p => p.referred_by).length;
    res.json({ totalUsers, paidUsers, totalCredits, totalReferrals, latestUsers: (profiles || []).slice(0,10), latestGenerations: generations || [] });
  } catch (err) { res.status(500).json({ error: err.message }); }
}
