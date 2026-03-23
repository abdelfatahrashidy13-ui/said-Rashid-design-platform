// api/ai.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { prompt, tool } = req.body;
  const apiKey = process.env.VITE_GOOGLE_CLOUD_API_KEY; // المفتاح اللي جبته من جوجل كلاود

  try {
    // 1. عنوان Imagen 3 الرسمي في جوجل كلاود
    const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3:generateImages?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: prompt, // الوصف اللي العميل بيكتبه
        number_of_images: 1,
        safety_setting: "BLOCK_MEDIUM_AND_ABOVE"
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(400).json({ success: false, error: data.error?.message || "فشل توليد الصورة" });
    }

    // جوجل بتبعت الصورة كـ Base64
    const base64Image = data.images[0].base64;
    res.status(200).json({ success: true, type: "base64", data: base64Image });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}
