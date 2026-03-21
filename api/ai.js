export const config = { runtime: 'edge' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: CORS });

  const REPLICATE_KEY = process.env.REPLICATE_API_KEY;
  const GEMINI_KEY = process.env.GEMINI_API_KEY;

  const body = await req.json();
  const { tool, prompt, imageUrl, imageBase64, operationId } = body;

  // ─── MODELS MAP ───────────────────────────────────────────────
  const MODELS = {
    // Text to Image
    'text-to-image':     'black-forest-labs/flux-1.1-pro',
    'text-to-image-fast':'black-forest-labs/flux-schnell',
    // Image tools
    'remove-background': 'lucataco/remove-bg:95fcc2a26d3899cd6c2691c900465aaeff466285dab6e83fdb99c6a5d8a5d5f0',
    'remove-object':     'inpaint/lama-cleaner-lama:latest',
    'enhance-photo':     'philz1337x/clarity-upscaler:dfad41707589d68ecdccd1dfa600d55a208f9310748e44bfe35b4a6291453d5e',
    'face-swap':         'lucataco/faceswap:9a4298548422074c3f57258c5d544497a19901a0',
    'image-to-image':    'black-forest-labs/flux-1.1-pro',
    'sketch-to-art':     'jagilley/controlnet-scribble:435061a1b5a4c1e26740464bf786efdfa9cb3a3ac488595a2de23e143fdb0117',
    'style-transfer':    'black-forest-labs/flux-1.1-pro',
    'upscale':           'nightmareai/real-esrgan:42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf41610695738c1d7b',
    // Video
    'text-to-video':     'minimax/video-01',
    'image-to-video':    'minimax/video-01-live',
    // 3D
    'image-to-3d':       'stability-ai/triposr:0d5d4a1f85db6e9c0e5f8c8a8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c',
  };

  try {
    // ─── CHECK STATUS ──────────────────────────────────────────
    if (tool === 'check-status' && operationId) {
      const res = await fetch(`https://api.replicate.com/v1/predictions/${operationId}`, {
        headers: { 'Authorization': `Bearer ${REPLICATE_KEY}` }
      });
      const data = await res.json();
      return new Response(JSON.stringify({
        status: data.status,
        output: data.output,
        error: data.error,
        logs: data.logs
      }), { headers: CORS });
    }

    // ─── GEMINI TEXT ENHANCE ───────────────────────────────────
    if (tool === 'enhance-prompt') {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `You are a professional AI art prompt engineer. Enhance this prompt to be more detailed and artistic for image generation. Return ONLY the enhanced prompt, nothing else. Original: "${prompt}"` }] }]
          })
        }
      );
      const data = await res.json();
      const enhanced = data.candidates?.[0]?.content?.parts?.[0]?.text || prompt;
      return new Response(JSON.stringify({ success: true, enhanced }), { headers: CORS });
    }

    // ─── IMAGEN 3 (Google) ─────────────────────────────────────
    if (tool === 'imagen3') {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${GEMINI_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instances: [{ prompt }],
            parameters: { sampleCount: 1, aspectRatio: body.ar || '1:1', personGeneration: 'allow_adult' }
          })
        }
      );
      const data = await res.json();
      if (data.predictions?.[0]?.bytesBase64Encoded) {
        return new Response(JSON.stringify({
          success: true,
          type: 'base64',
          data: data.predictions[0].bytesBase64Encoded,
          mimeType: 'image/png'
        }), { headers: CORS });
      }
      throw new Error(JSON.stringify(data));
    }

    // ─── VEO 3 (Google) ────────────────────────────────────────
    if (tool === 'veo3') {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/veo-3.0-generate-preview:predictLongRunning?key=${GEMINI_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instances: [{ prompt }],
            parameters: { aspectRatio: '16:9', sampleCount: 1, durationSeconds: 8 }
          })
        }
      );
      const data = await res.json();
      return new Response(JSON.stringify({ success: true, type: 'veo3_pending', operationName: data.name }), { headers: CORS });
    }

    if (tool === 'veo3-status') {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${body.operationName}?key=${GEMINI_KEY}`
      );
      const data = await res.json();
      if (data.done && data.response?.predictions?.[0]?.bytesBase64Encoded) {
        return new Response(JSON.stringify({
          success: true, done: true, type: 'base64',
          data: data.response.predictions[0].bytesBase64Encoded, mimeType: 'video/mp4'
        }), { headers: CORS });
      }
      return new Response(JSON.stringify({ success: true, done: false }), { headers: CORS });
    }

    // ─── REPLICATE TOOLS ───────────────────────────────────────
    if (!REPLICATE_KEY) {
      return new Response(JSON.stringify({ error: 'REPLICATE_API_KEY not configured' }), { status: 500, headers: CORS });
    }

    let input = {};

    // Build input per tool
    if (tool === 'text-to-image' || tool === 'text-to-image-fast') {
      input = { prompt, width: 1024, height: 1024, num_outputs: 1 };
    } else if (tool === 'remove-background') {
      input = { image: imageUrl };
    } else if (tool === 'enhance-photo') {
      input = { image: imageUrl, scale_factor: 2 };
    } else if (tool === 'upscale') {
      input = { image: imageUrl, scale: 4 };
    } else if (tool === 'face-swap') {
      input = { target_image: imageUrl, source_image: body.sourceImageUrl };
    } else if (tool === 'sketch-to-art') {
      input = { image: imageUrl, prompt: prompt || 'colorful artistic illustration', num_samples: 1 };
    } else if (tool === 'image-to-image') {
      input = { prompt, image: imageUrl, strength: 0.75, num_outputs: 1 };
    } else if (tool === 'text-to-video') {
      input = { prompt, num_frames: 150 };
    } else if (tool === 'image-to-video') {
      input = { prompt: prompt || 'smooth cinematic motion', first_frame_image: imageUrl };
    } else {
      input = { prompt, image: imageUrl };
    }

    const modelId = MODELS[tool] || MODELS['text-to-image'];

    // Start prediction
    const startRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${REPLICATE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait=30'
      },
      body: JSON.stringify({ version: modelId.includes(':') ? modelId.split(':')[1] : undefined, model: modelId.includes(':') ? undefined : modelId, input })
    });

    const prediction = await startRes.json();

    if (prediction.error) throw new Error(prediction.error);

    if (prediction.status === 'succeeded') {
      return new Response(JSON.stringify({ success: true, status: 'succeeded', output: prediction.output, id: prediction.id }), { headers: CORS });
    }

    return new Response(JSON.stringify({ success: true, status: prediction.status, id: prediction.id }), { headers: CORS });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS });
  }
}
