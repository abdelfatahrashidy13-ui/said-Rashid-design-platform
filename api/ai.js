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

  const FAL_KEY = process.env.FAL_API_KEY;
  const GEMINI_KEY = process.env.GEMINI_API_KEY;

  const body = await req.json();
  const { tool, prompt, imageUrl, imageBase64, operationName } = body;

  try {

    // ── ENHANCE PROMPT (Gemini) ──────────────────────────────
    if (tool === 'enhance-prompt') {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: `You are a professional AI art prompt engineer. Enhance this prompt to be more detailed, vivid and artistic for image generation. Return ONLY the enhanced prompt in English, nothing else. Original: "${prompt}"` }]
            }]
          })
        }
      );
      const data = await res.json();
      const enhanced = data.candidates?.[0]?.content?.parts?.[0]?.text || prompt;
      return new Response(JSON.stringify({ success: true, enhanced }), { headers: CORS });
    }

    // ── IMAGEN 3 (Google) ────────────────────────────────────
    if (tool === 'imagen3') {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${GEMINI_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instances: [{ prompt }],
            parameters: {
              sampleCount: 1,
              aspectRatio: body.ar || '1:1',
              personGeneration: 'allow_adult'
            }
          })
        }
      );
      const data = await res.json();
      if (data.predictions?.[0]?.bytesBase64Encoded) {
        return new Response(JSON.stringify({
          success: true, type: 'base64',
          data: data.predictions[0].bytesBase64Encoded,
          mimeType: 'image/png'
        }), { headers: CORS });
      }
      throw new Error(data.error?.message || 'Imagen3 failed');
    }

    // ── VEO 3 START (Google) ─────────────────────────────────
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
      if (data.name) {
        return new Response(JSON.stringify({
          success: true, type: 'veo3_pending', operationName: data.name
        }), { headers: CORS });
      }
      throw new Error('Veo3 failed to start');
    }

    // ── VEO 3 STATUS ─────────────────────────────────────────
    if (tool === 'veo3-status') {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${GEMINI_KEY}`
      );
      const data = await res.json();
      if (data.done && data.response?.predictions?.[0]?.bytesBase64Encoded) {
        return new Response(JSON.stringify({
          success: true, done: true, type: 'base64',
          data: data.response.predictions[0].bytesBase64Encoded,
          mimeType: 'video/mp4'
        }), { headers: CORS });
      }
      return new Response(JSON.stringify({ success: true, done: false }), { headers: CORS });
    }

    // ── FAL.AI TOOLS ─────────────────────────────────────────
    if (!FAL_KEY) {
      return new Response(JSON.stringify({ error: 'FAL_API_KEY not configured' }), { status: 500, headers: CORS });
    }

    // Map tools to fal.ai models
    const FAL_MODELS = {
      'text-to-image':      'fal-ai/flux/schnell',
      'text-to-image-pro':  'fal-ai/flux-pro/v1.1',
      'image-to-image':     'fal-ai/flux/dev/image-to-image',
      'remove-background':  'fal-ai/birefnet',
      'enhance-photo':      'fal-ai/clarity-upscaler',
      'upscale':            'fal-ai/esrgan',
      'face-swap':          'fal-ai/face-swap',
      'sketch-to-art':      'fal-ai/controlnet-union/canny',
      'text-to-video':      'fal-ai/minimax-video/image-to-video',
      'image-to-video':     'fal-ai/minimax-video/image-to-video',
      'chat-editor':        'fal-ai/flux/dev/image-to-image',
    };

    const modelId = FAL_MODELS[tool] || FAL_MODELS['text-to-image'];

    // Build input
    let input = {};
    if (tool === 'text-to-image' || tool === 'text-to-image-pro') {
      input = { prompt, image_size: 'square_hd', num_images: 1, enable_safety_checker: false };
    } else if (tool === 'remove-background') {
      input = { image_url: imageUrl || `data:image/jpeg;base64,${imageBase64}` };
    } else if (tool === 'enhance-photo' || tool === 'upscale') {
      input = { image_url: imageUrl || `data:image/jpeg;base64,${imageBase64}`, scale: 2 };
    } else if (tool === 'face-swap') {
      input = {
        base_image_url: imageUrl || `data:image/jpeg;base64,${imageBase64}`,
        swap_image_url: body.sourceImageUrl || imageUrl || `data:image/jpeg;base64,${imageBase64}`
      };
    } else if (tool === 'text-to-video') {
      input = { prompt, num_frames: 150 };
    } else if (tool === 'image-to-video') {
      input = {
        prompt: prompt || 'smooth cinematic motion',
        image_url: imageUrl || `data:image/jpeg;base64,${imageBase64}`
      };
    } else if (imageBase64 || imageUrl) {
      input = {
        prompt,
        image_url: imageUrl || `data:image/jpeg;base64,${imageBase64}`,
        strength: 0.75
      };
    } else {
      input = { prompt, image_size: 'square_hd', num_images: 1 };
    }

    // Submit to fal.ai
    const submitRes = await fetch(`https://queue.fal.run/${modelId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ input })
    });

    const submitData = await submitRes.json();

    if (submitData.error) throw new Error(submitData.error);

    // If result is immediate
    if (submitData.images?.[0]?.url || submitData.image?.url) {
      const url = submitData.images?.[0]?.url || submitData.image?.url;
      return new Response(JSON.stringify({
        success: true, status: 'succeeded',
        output: [url]
      }), { headers: CORS });
    }

    // If queued - return request_id for polling
    if (submitData.request_id) {
      return new Response(JSON.stringify({
        success: true,
        status: 'processing',
        id: submitData.request_id,
        modelId
      }), { headers: CORS });
    }

    return new Response(JSON.stringify({ error: 'Unknown response from fal.ai', details: submitData }), { status: 400, headers: CORS });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS });
  }
}
