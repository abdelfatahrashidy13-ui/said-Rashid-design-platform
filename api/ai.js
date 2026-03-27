export const config = { runtime: 'edge' };

const H = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

function j(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: H });
}

async function byteplusImage(prompt) {
  const response = await fetch(`${process.env.BYTEPLUS_BASE_URL}/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.BYTEPLUS_API_KEY}`
    },
    body: JSON.stringify({
      model: process.env.BYTEPLUS_MODEL,
      prompt,
      sequential_image_generation: "disabled",
      response_format: "url",
      size: "2K",
      stream: false,
      watermark: true
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'BytePlus image error');
  return data;
}

async function byteplusVideoTask(prompt, imageUrl) {
  const response = await fetch(`${process.env.BYTEPLUS_BASE_URL}/contents/generations/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.BYTEPLUS_API_KEY}`
    },
    body: JSON.stringify({
      model: process.env.BYTEPLUS_VIDEO_MODEL,
      content: [
        {
          type: "text",
          text: prompt || "At breakneck speed, drones thread through intricate obstacles or stunning natural wonders, delivering an immersive, heart-pounding flying experience. --duration 5 --camerafixed false"
        },
        {
          type: "image_url",
          image_url: { url: imageUrl }
        }
      ]
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'BytePlus video task error');
  return data;
}

async function byteplusVideoStatus(taskId) {
  const response = await fetch(`${process.env.BYTEPLUS_BASE_URL}/contents/generations/tasks/${taskId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${process.env.BYTEPLUS_API_KEY}`
    }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'BytePlus video status error');
  return data;
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: H });
  if (req.method !== 'POST') return j({ error: 'Method not allowed' }, 405);

  let body;
  try { body = await req.json(); } catch { return j({ error: 'Invalid JSON' }, 400); }

  const { tool, prompt, imageUrl, taskId } = body;
  const GEMINI = process.env.GEMINI_API_KEY;

  try {
    if (tool === 'enhance-prompt') {
      if (!GEMINI) return j({ error: 'GEMINI_API_KEY missing' }, 500);
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Enhance this generation prompt, return ONLY the enhanced prompt in English: "${prompt}"` }] }]
        })
      });
      const d = await r.json();
      return j({ success: true, enhanced: d?.candidates?.[0]?.content?.parts?.[0]?.text || prompt });
    }

    if (tool === 'imagen3' || tool === 'text-to-image' || tool === 'image-to-image' || tool === 'face-swap' || tool === 'remove-background' || tool === 'enhance-photo' || tool === 'upscale') {
      const data = await byteplusImage(prompt || 'high quality image');
      return j({ success: true, status: 'succeeded', output: [data.data?.[0]?.url] });
    }

    if (tool === 'image-to-video') {
      if (!imageUrl) return j({ error: 'imageUrl is required' }, 400);
      const data = await byteplusVideoTask(prompt, imageUrl);
      return j({ success: true, status: 'processing', taskId: data.id || data.task_id || data.data?.id || null, raw: data });
    }

    if (tool === 'video-status') {
      if (!taskId) return j({ error: 'taskId is required' }, 400);
      const data = await byteplusVideoStatus(taskId);
      const status = String(data.status || data.data?.status || '').toLowerCase();
      const maybeUrl = data.output?.video_url || data.output?.url || data.data?.output?.video_url || data.data?.output?.url || data.result?.url || null;
      if (status === 'succeeded' || maybeUrl) return j({ success: true, done: true, output: maybeUrl ? [maybeUrl] : [], raw: data });
      return j({ success: true, done: false, raw: data });
    }

    return j({ error: 'Unsupported tool' }, 400);
  } catch (err) {
    return j({ error: err.message }, 500);
  }
}
