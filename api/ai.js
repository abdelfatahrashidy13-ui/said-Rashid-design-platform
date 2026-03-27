
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
  const TOGETHER = process.env.TOGETHER_API_KEY;

  const debug = {
    gemini: GEMINI ? GEMINI.substring(0, 8) + '...' : 'MISSING',
    together: TOGETHER ? TOGETHER.substring(0, 8) + '...' : 'MISSING'
  };

  let body;
  try { body = await req.json(); }
  catch (e) { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: H }); }

  const { tool, prompt, operationName } = body;

  try {
    if (tool === 'test') {
      return new Response(JSON.stringify({ success: true, debug, message: 'API working!' }), { headers: H });
    }

    if (tool === 'enhance-prompt') {
      if (!GEMINI) return new Response(JSON.stringify({ error: 'GEMINI_API_KEY missing' }), { status: 500, headers: H });
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Enhance this image generation prompt, return ONLY the enhanced prompt in English: "${prompt}"`
            }]
          }]
        })
      });
      const d = await r.json();
      return new Response(JSON.stringify({ success: true, enhanced: d.candidates?.[0]?.content?.parts?.[0]?.text || prompt }), { headers: H });
    }

    if (tool === 'imagen3') {
      if (!GEMINI) return new Response(JSON.stringify({ error: 'GEMINI_API_KEY missing' }), { status: 500, headers: H });
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${GEMINI}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: { sampleCount: 1, aspectRatio: body.ar || '1:1', personGeneration: 'allow_adult' }
        })
      });
      const d = await r.json();
      if (d.predictions?.[0]?.bytesBase64Encoded) {
        return new Response(JSON.stringify({ success: true, type: 'base64', data: d.predictions[0].bytesBase64Encoded, mimeType: 'image/png' }), { headers: H });
      }
      return new Response(JSON.stringify({ error: 'Imagen3 failed', details: d }), { status: 400, headers: H });
    }

    if (tool === 'veo3') {
      if (!GEMINI) return new Response(JSON.stringify({ error: 'GEMINI_API_KEY missing' }), { status: 500, headers: H });
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/veo-3.0-generate-preview:predictLongRunning?key=${GEMINI}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instances: [{ prompt }], parameters: { aspectRatio: '16:9', sampleCount: 1, durationSeconds: 8 } })
      });
      const d = await r.json();
      if (d.name) return new Response(JSON.stringify({ success: true, type: 'veo3_pending', operationName: d.name }), { headers: H });
      return new Response(JSON.stringify({ error: 'Veo3 failed', details: d }), { status: 400, headers: H });
    }

    if (tool === 'veo3-status') {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${GEMINI}`);
      const d = await r.json();
      if (d.done && d.response?.predictions?.[0]?.bytesBase64Encoded) {
        return new Response(JSON.stringify({ success: true, done: true, type: 'base64', data: d.response.predictions[0].bytesBase64Encoded, mimeType: 'video/mp4' }), { headers: H });
      }
      return new Response(JSON.stringify({ success: true, done: false }), { headers: H });
    }

    if (!TOGETHER) return new Response(JSON.stringify({ error: 'TOGETHER_API_KEY missing', debug }), { status: 500, headers: H });

    let finalPrompt = prompt || 'beautiful artistic image, high quality';
    if (tool === 'enhance-photo') finalPrompt = `ultra high quality, 8k detailed version: ${prompt}`;
    if (tool === 'sketch-to-art') finalPrompt = `colorful artistic painting, detailed illustration: ${prompt}`;
    if (tool === 'remove-background') finalPrompt = `${prompt}, transparent background, isolated object`;
    if (tool === 'face-swap') finalPrompt = `portrait photo, professional, ${prompt}`;
    if (tool === 'upscale') finalPrompt = `ultra high resolution, 8k, highly detailed: ${prompt}`;

    const res = await fetch('https://api.together.xyz/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + TOGETHER,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'black-forest-labs/FLUX.1-schnell-Free',
        prompt: finalPrompt,
        width: 1024,
        height: 1024,
        steps: 4,
        n: 1,
        response_format: 'url'
      })
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch(e) { data = { raw: text }; }

    if (!res.ok) {
      return new Response(JSON.stringify({ error: 'Together AI error ' + res.status, details: data, debug }), { status: 400, headers: H });
    }

    const imgUrl = data?.data?.[0]?.url;
    if (imgUrl) {
      return new Response(JSON.stringify({ success: true, status: 'succeeded', output: [imgUrl] }), { headers: H });
    }

    const b64 = data?.data?.[0]?.b64_json;
    if (b64) {
      return new Response(JSON.stringify({ success: true, type: 'base64', data: b64, mimeType: 'image/png' }), { headers: H });
    }

    return new Response(JSON.stringify({ error: 'No output', details: data, debug }), { status: 400, headers: H });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message, debug }), { status: 500, headers: H });
  }
}
