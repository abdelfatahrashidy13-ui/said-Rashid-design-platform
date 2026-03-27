# SAIDRASHIDY AI - Complete Project

## الجديد في هذه النسخة
- تسجيل دخول بالبريد وكلمة المرور
- تسجيل دخول باستخدام Google عبر Supabase OAuth
- ملف إعداد واحد: `public/config.js`
- Dashboard + Explore + Admin + APIs
- Referral system
- Supabase SQL جاهز

## الإعداد السريع
1. ارفع المشروع على GitHub.
2. اربطه مع Vercel.
3. انسخ `public/config.example.js` إلى `public/config.js`.
4. ضع قيم:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
5. نفذ ملف `supabase.sql` داخل Supabase SQL Editor.
6. في Supabase:
   - Authentication -> Providers -> Google -> Enable
7. في Google Cloud Console أنشئ OAuth Client نوع Web Application.
8. أضف Redirect URI بهذا الشكل:
   - `https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback`
9. انسخ `Client ID` و `Client Secret` إلى إعدادات Google Provider داخل Supabase.
10. داخل Supabase Authentication -> URL Configuration أضف:
   - Site URL: رابط موقعك
   - Redirect URLs: `https://your-domain.com/login?auth=callback`

## ملاحظات
- لا تترك `config.example.js` فقط؛ أنشئ `config.js` الحقيقي.
- صفحة Explore الآن تحتاج سياسة القراءة العامة الموجودة في `supabase.sql`.
- عند التسجيل بجوجل أو البريد سيتم إنشاء profile تلقائيًا من خلال trigger.
