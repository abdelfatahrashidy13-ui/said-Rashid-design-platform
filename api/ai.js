import { GoogleAuth } from "google-auth-library";

const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json"
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: H });
}

async function getAccessToken() {
  if (!process.env.GCP_CLIENT_EMAIL || !process.env.GCP_PRIVATE_KEY) {
    return null;
  }

  const auth = new GoogleAuth({
    credentials: {
      client_email: process.env.GCP_CLIENT_EMAIL,
      private_key: process.env.GCP_PRIVATE_KEY?.replace(/\\n/g, "\n")
    },
    scopes: ["https://www.googleapis.com/auth/cloud-platform"]
  });

  const client = await auth.getClient();
  const token = await client.getAccessToken();
  return typeof token === "string" ? token : token?.token;
}

export const config = { runtime: "nodejs" };

export default async function handler(req) {
  if (req.method === "OPTIONS") return new Response(null, { headers: H });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const { tool, prompt, operationName, aspectRatio = "16:9", durationSeconds = 8 } = body;
  const GEMINI = process.env.GEMINI_API_KEY;

  try {
    if (tool === "test") {
      return json({ success: true, message: "API working!" });
    }

    if (tool === "enhance-prompt") {
      if (!GEMINI) return json({ error: "GEMINI_API_KEY missing" }, 500);

      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Enhance this image generation prompt, return ONLY the enhanced prompt in English: "${prompt}"`
            }]
          }]
        })
      });

      const d = await r.json();
      return json({
        success: true,
        enhanced: d.candidates?.[0]?.content?.parts?.[0]?.text || prompt
      });
    }

    if (tool === "imagen3") {
      if (!GEMINI) return json({ error: "GEMINI_API_KEY missing" }, 500);

      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${GEMINI}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: {
            sampleCount: 1,
            aspectRatio: "1:1",
            personGeneration: "allow_adult"
          }
        })
      });

      const d = await r.json();

      if (d.predictions?.[0]?.bytesBase64Encoded) {
        return json({
          success: true,
          type: "base64",
          data: d.predictions[0].bytesBase64Encoded,
          mimeType: "image/png"
        });
      }

      return json({ error: "Imagen3 failed", details: d }, 400);
    }

    if (tool === "veo3") {
      const token = await getAccessToken();
      if (!token) return json({ error: "Google Cloud credentials missing" }, 500);

      const project = process.env.GOOGLE_CLOUD_PROJECT;
      const location = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";
      const storageUri = process.env.GCS_OUTPUT_URI;
      const modelId = "veo-3.1-generate-001";

      const url =
        `https://${location}-aiplatform.googleapis.com/v1/` +
        `projects/${project}/locations/${location}/publishers/google/models/${modelId}:predictLongRunning`;

      const r = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: {
            storageUri,
            sampleCount: 1,
            aspectRatio,
            durationSeconds
          }
        })
      });

      const d = await r.json();
      if (!r.ok) return json({ error: "Veo start failed", details: d }, 400);

      return json({
        success: true,
        type: "veo3_pending",
        operationName: d.name
      });
    }

    if (tool === "veo3-status") {
      const token = await getAccessToken();
      if (!token) return json({ error: "Google Cloud credentials missing" }, 500);

      const location = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";
      const url = `https://${location}-aiplatform.googleapis.com/v1/${operationName}`;

      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const d = await r.json();
      if (!r.ok) return json({ error: "Veo status failed", details: d }, 400);

      if (!d.done) return json({ success: true, done: false });

      const samples =
        d?.response?.generateVideoResponse?.generatedSamples ||
        d?.response?.generatedSamples ||
        [];

      const videoUri =
        samples?.[0]?.video?.uri ||
        samples?.[0]?.video?.gcsUri ||
        null;

      return json({
        success: true,
        done: true,
        output: videoUri ? [videoUri] : [],
        raw: d
      });
    }

    return json({ error: "Unsupported tool" }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
