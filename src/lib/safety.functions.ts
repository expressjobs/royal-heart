import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ImageScanResult, ImageVerdict } from "@/lib/moderation";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const VISION_MODEL = "google/gemini-2.5-flash";

const VERDICTS: ImageVerdict[] = ["safe", "flagged", "prohibited"];

/** Rejects non-http(s) URLs and private/loopback hosts to prevent SSRF-style abuse. */
function isPublicHttpUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local")) return false;
  if (
    /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
    host === "::1" ||
    host === "[::1]"
  ) {
    return false;
  }
  return true;
}

const SYSTEM_PROMPT =
  "You are a strict trust-and-safety image moderator for a dating app. " +
  "Classify the image into exactly one verdict: " +
  '"prohibited" for sexual/nudity, child content, graphic violence/gore, weapons used as threats, ' +
  "hate symbols, illegal drugs, or scam/financial-solicitation imagery (QR codes asking for money, crypto wallets); " +
  '"flagged" for suggestive but non-explicit content, mild violence, or anything borderline that a moderator should review; ' +
  '"safe" otherwise. ' +
  'Respond with ONLY compact JSON: {"verdict":"safe|flagged|prohibited","categories":["..."],"reason":"one short sentence"}.';

function coerceResult(text: string): ImageScanResult {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : text) as Partial<ImageScanResult>;
    const verdict = VERDICTS.includes(parsed.verdict as ImageVerdict)
      ? (parsed.verdict as ImageVerdict)
      : "flagged";
    return {
      verdict,
      categories: Array.isArray(parsed.categories)
        ? parsed.categories.map((c) => String(c)).slice(0, 8)
        : [],
      reason: typeof parsed.reason === "string" ? parsed.reason.slice(0, 300) : "",
    };
  } catch {
    // If the model didn't return parseable JSON, fail safe to "flagged".
    return { verdict: "flagged", categories: [], reason: "Could not verify image content." };
  }
}

/**
 * Scans a shared image URL for risky or prohibited content using the Lovable
 * AI vision model. Authenticated so it is never a public/abusable endpoint.
 */
export const scanImageContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { url: string }) => {
    if (!data || typeof data.url !== "string" || !isPublicHttpUrl(data.url)) {
      throw new Error("A valid public image URL is required.");
    }
    return { url: data.url };
  })
  .handler(async ({ data }): Promise<ImageScanResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { verdict: "flagged", categories: [], reason: "Image scanning is unavailable." };
    }

    // Fetch the image ourselves (provider-side URL fetching is unreliable and
    // blocked by many hosts) so we can enforce type/size limits and pass a
    // stable base64 data URL to the model.
    let dataUrl: string;
    try {
      const imgRes = await fetch(data.url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; HeartConnectSafety/1.0)" },
        redirect: "follow",
      });
      if (!imgRes.ok) {
        return {
          verdict: "flagged",
          categories: [],
          reason: "Image could not be reached for scanning.",
        };
      }
      const contentType = (imgRes.headers.get("content-type") ?? "")
        .split(";")[0]
        .trim()
        .toLowerCase();
      if (!contentType.startsWith("image/")) {
        return {
          verdict: "flagged",
          categories: ["not_an_image"],
          reason: "Link did not return an image.",
        };
      }
      const buf = new Uint8Array(await imgRes.arrayBuffer());
      if (buf.byteLength === 0 || buf.byteLength > 10 * 1024 * 1024) {
        return { verdict: "flagged", categories: [], reason: "Image too large to scan safely." };
      }
      let binary = "";
      for (let i = 0; i < buf.byteLength; i++) binary += String.fromCharCode(buf[i]);
      dataUrl = `data:${contentType};base64,${btoa(binary)}`;
    } catch {
      return {
        verdict: "flagged",
        categories: [],
        reason: "Image could not be reached for scanning.",
      };
    }

    let res: Response;
    try {
      res = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: VISION_MODEL,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: [
                { type: "text", text: "Moderate this shared image." },
                { type: "image_url", image_url: { url: dataUrl } },
              ],
            },
          ],
          temperature: 0,
          response_format: { type: "json_object" },
        }),
      });
    } catch {
      return {
        verdict: "flagged",
        categories: [],
        reason: "Image could not be reached for scanning.",
      };
    }

    if (res.status === 429) {
      return {
        verdict: "flagged",
        categories: ["rate_limited"],
        reason: "Scanning is busy, treat with caution.",
      };
    }
    if (!res.ok) {
      return { verdict: "flagged", categories: [], reason: "Image could not be verified." };
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content ?? "";
    return coerceResult(content);
  });
