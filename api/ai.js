export const config = { runtime: 'edge' };

const H = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: H });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: H });

  const GEMINI = process.env.GEMINI_API_KEY;
  const FAL = process.env.FAL_API_KEY;

  const debug = {
    gemini: GEMINI ? GEMINI.substring(0, 8) + '...' : 'MISSING',
    fal: FAL ? FAL.substring(0, 8) + '...' : 'MISSING'
  };

  let body;
  try { body = await req.json(); }
  catch (e) { return new Response(JSON.stringify({ error: 'Invalid JSON', debug }), { status: 400, headers: H }); }

  const { tool, prompt, imageBase64, imageUrl, operationName } = body;

  try {

    if (tool === 'test') {
      return new Response(JSON.stringify({ success: true, debug, message: 'API working!' }), { headers: H });
    }

    if (tool === 'enhance-prompt') {
      if (!GEMINI) return new Response(JSON.stringify({ error: 'GEMINI_API_KEY missing', debug }), { headers: H });
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: `Enhance this image prompt, return ONLY the result in English: "${prompt}"` }] }] })
      });
      const d = await r.json();
      return new Response(JSON.stringify({ success: true, enhanced: d.candidates?.[0]?.content?.parts?.[0]?.text || prompt }), { headers: H });
    }

    if (tool === 'imagen3') {
      if (!GEMINI) return new Response(JSON.stringify({ error: 'GEMINI_API_KEY missing', debug }), { headers: H });
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${GEMINI}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instances: [{ prompt }], parameters: { sampleCount: 1, aspectRatio: '1:1', personGeneration: 'allow_adult' } })
      });
      const d = await r.json();
      if (d.predictions?.[0]?.bytesBase64Encoded) {
        return new Response(JSON.stringify({ success: true, type: 'base64', data: d.predictions[0].bytesBase64Encoded, mimeType: 'image/png' }), { headers: H });
      }
      return new Response(JSON.stringify({ error: 'Imagen3 failed', details: d, debug }), { status: 400, headers: H });
    }

    if (tool === 'veo3') {
      if (!GEMINI) return new Response(JSON.stringify({ error: 'GEMINI_API_KEY missing', debug }), { headers: H });
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/veo-3.0-generate-preview:predictLongRunning?key=${GEMINI}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instances: [{ prompt }], parameters: { aspectRatio: '16:9', sampleCount: 1, durationSeconds: 8 } })
      });
      const d = await r.json();
      if (d.name) return new Response(JSON.stringify({ success: true, type: 'veo3_pending', operationName: d.name }), { headers: H });
      return new Response(JSON.stringify({ error: 'Veo3 failed', details: d, debug }), { status: 400, headers: H });
    }

    if (tool === 'veo3-status') {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${GEMINI}`);
      const d = await r.json();
      if (d.done && d.response?.predictions?.[0]?.bytesBase64Encoded) {
        return new Response(JSON.stringify({ success: true, done: true, type: 'base64', data: d.response.predictions[0].bytesBase64Encoded, mimeType: 'video/mp4' }), { headers: H });
      }
      return new Response(JSON.stringify({ success: true, done: false }), { headers: H });
    }

    if (tool === 'check-status') {
      if (!FAL) return new Response(JSON.stringify({ error: 'FAL_API_KEY missing', debug }), { headers: H });
      const { id, modelId } = body;
      const r = await fetch(`https://queue.fal.run/${modelId}/requests/${id}`, {
        headers: { 'Authorization': 'Key ' + FAL }
      });
      const d = await r.json();
      if (d.status === 'COMPLETED') {
        const imgUrl = d.output?.images?.[0]?.url || d.output?.image?.url;
        return new Response(JSON.stringify({ success: true, status: 'succeeded', output: [imgUrl] }), { headers: H });
      }
      return new Response(JSON.stringify({ success: true, status: 'processing' }), { headers: H });
    }

    // FAL tools
    if (!FAL) return new Response(JSON.stringify({ error: 'FAL_API_KEY missing', debug }), { status: 500, headers: H });

    const models = {
      'text-to-image':     'fal-ai/flux/schnell',
      'image-to-image':    'fal-ai/flux/dev/image-to-image',
      'remove-background': 'fal-ai/birefnet',
      'enhance-photo':     'fal-ai/clarity-upscaler',
      'upscale':           'fal-ai/esrgan',
      'face-swap':         'fal-ai/face-swap',
      'text-to-video':     'fal-ai/minimax/video-01',
      'image-to-video':    'fal-ai/minimax/video-01-live',
      'chat-editor':       'fal-ai/flux/dev/image-to-image',
      'sketch-to-art':     'fal-ai/flux/dev/image-to-image',
    };

    const modelId = models[tool] || 'fal-ai/flux/schnell';
    let input = {};

    if (tool === 'text-to-image') {
      input = { prompt, image_size: 'square_hd', num_images: 1 };
    } else if (tool === 'remove-background') {
      input = { image_url: imageUrl || ('data:image/jpeg;base64,' + imageBase64) };
    } else if (tool === 'enhance-photo' || tool === 'upscale') {
      input = { image_url: imageUrl || ('data:image/jpeg;base64,' + imageBase64) };
    } else if (tool === 'text-to-video') {
      input = { prompt };
    } else if (tool === 'image-to-video') {
      input = { prompt: prompt || 'smooth motion', image_url: imageUrl || ('data:image/jpeg;base64,' + imageBase64) };
    } else if (imageBase64 || imageUrl) {
      input = { prompt, image_url: imageUrl || ('data:image/jpeg;base64,' + imageBase64), strength: 0.75 };
    } else {
      input = { prompt, image_size: 'square_hd', num_images: 1 };
    }

    const falRes = await fetch(`https://fal.run/${modelId}`, {
      method: 'POST',
      headers: { 'Authorization': 'Key ' + FAL, 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });

    const falText = await falRes.text();
    let falData;
    try { falData = JSON.parse(falText); } catch(e) { falData = { raw: falText }; }

    if (!falRes.ok) {
      return new Response(JSON.stringify({ error: 'fal.ai error ' + falRes.status, details: falData, debug }), { status: 400, headers: H });
    }

    const imgOut = falData?.images?.[0]?.url || falData?.image?.url;
    if (imgOut) {
      return new Response(JSON.stringify({ success: true, status: 'succeeded', output: [imgOut] }), { headers: H });
    }

    if (falData?.request_id) {
      return new Response(JSON.stringify({ success: true, status: 'processing', id: falData.request_id, modelId }), { headers: H });
    }

    return new Response(JSON.stringify({ error: 'No output from fal.ai', details: falData, debug }), { status: 400, headers: H });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message, debug }), { status: 500, headers: H });
  }
}
