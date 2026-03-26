export default async function handler(req, res) {
  return res.json({
    totalUsers: 10,
    paidUsers: 2,
    totalCredits: 500,
    totalReferrals: 3
  });
}