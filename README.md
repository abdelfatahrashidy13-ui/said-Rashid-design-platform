# Said Rashid Design Platform v3
## منصة تصميم AI كاملة 

## هيكل المشروع
```
sr-platform/
├── public/
│   └── index.html        ← الموقع الكامل
├── api/
│   └── ai.js             ← API كل الأدوات
├── vercel.json           ← إعدادات Vercel
└── README.md
```

## طريقة الرفع على Vercel

### 1. ارفع على GitHub
- افتح github.com → New Repository → `said-rashid-platform`
- ارفع كل الملفات

### 2. اربط بـ Vercel
- افتح vercel.com → Add New Project → اختر الـ Repo → Deploy

### 3. أضف Environment Variables
في Vercel → Settings → Environment Variables:

```
GEMINI_API_KEY    = AIzaSy...مفتاح Gemini بتاعك...
REPLICATE_API_KEY = r8_...مفتاح Replicate...
```

### 4. مفتاح Replicate (مجاني)
- افتح replicate.com → Sign Up مجاناً
- Account Settings → API Tokens → Create Token
- أضفه في Vercel كـ REPLICATE_API_KEY

### 5. Redeploy ✅

## الأدوات الموجودة
| الأداة | الموديل | السعر |
|--------|---------|-------|
| توليد صورة | Flux 1.1 Pro | ~$0.04 |
| توليد صورة سريع | Flux Schnell | ~$0.003 |
| Imagen 3 | Google Imagen | ~$0.04 |
| إزالة خلفية | Remove BG | ~$0.001 |
| تحسين صورة | Clarity Upscaler | ~$0.05 |
| تكبير | Real-ESRGAN | ~$0.001 |
| رسم إلى فن | ControlNet | ~$0.01 |
| صورة إلى صورة | Flux | ~$0.04 |
| توليد فيديو | Minimax Video | ~$0.5 |
| صورة إلى فيديو | Minimax Live | ~$0.5 |
| Veo 3 | Google Veo 3 | ~$1-3 |

## الطرق المدمجة للدفع
- فودافون كاش: 00201122977222
- InstaPay: abdelft@instapay
- واتساب مباشر للاشتراك
