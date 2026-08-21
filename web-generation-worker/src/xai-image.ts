import { XAI_API_HOST, isXaiSafetyBlock, requireXaiBaseUrl, rewriteXaiDownloadUrl, xaiErrorMessage, xaiProxyHost } from "./xai-video";

export const GROK_IMAGINE_IMAGE_MODEL = "grok-imagine-image-2.0";
export const GROK_IMAGE_MAX_INPUTS = 3;
export const GROK_IMAGE_QUALITY = "medium";

export function isGrokImageModel(model: unknown): boolean {
  return typeof model === "string" && model.startsWith("grok-imagine-image");
}

export function xaiImageGenerateUrl(baseUrl: string): string {
  return `${requireXaiBaseUrl(baseUrl)}/v1/images/generations`;
}

export function xaiImageEditUrl(baseUrl: string): string {
  return `${requireXaiBaseUrl(baseUrl)}/v1/images/edits`;
}

export function mapGrokImageResolution(imageSize: string): { resolution: "1k" | "2k"; clamped: boolean } {
  if (imageSize === "1K" || imageSize === "1k") return { resolution: "1k", clamped: false };
  return { resolution: "2k", clamped: imageSize === "4K" || imageSize === "4k" };
}

export type GrokImagePart = { mimeType: string; data: string };

export function clampGrokImageParts<T>(parts: T[]): { parts: T[]; clamped: boolean } {
  if (parts.length <= GROK_IMAGE_MAX_INPUTS) return { parts, clamped: false };
  return { parts: parts.slice(0, GROK_IMAGE_MAX_INPUTS), clamped: true };
}

function dataUri(part: GrokImagePart): string {
  const mime = part.mimeType || "image/jpeg";
  return `data:${mime};base64,${part.data}`;
}

function imagePayload(part: GrokImagePart): { url: string; type: "image_url" } {
  return { url: dataUri(part), type: "image_url" };
}

export function buildXaiImageGenerateBody(input: {
  model?: string;
  prompt: string;
  aspectRatio: string;
  resolution: "1k" | "2k";
}): Record<string, unknown> {
  return {
    model: input.model || GROK_IMAGINE_IMAGE_MODEL,
    prompt: input.prompt,
    n: 1,
    aspect_ratio: input.aspectRatio,
    resolution: input.resolution,
    quality: GROK_IMAGE_QUALITY,
    response_format: "b64_json",
  };
}

export function buildXaiImageEditBody(input: {
  model?: string;
  prompt: string;
  aspectRatio: string;
  resolution: "1k" | "2k";
  images: GrokImagePart[];
}): Record<string, unknown> {
  const images = clampGrokImageParts(input.images).parts;
  const image = images.length === 1 ? imagePayload(images[0]) : images.map(imagePayload);
  return {
    model: input.model || GROK_IMAGINE_IMAGE_MODEL,
    prompt: input.prompt,
    n: 1,
    aspect_ratio: input.aspectRatio,
    resolution: input.resolution,
    quality: GROK_IMAGE_QUALITY,
    response_format: "b64_json",
    image,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function extractXaiImageBase64(payload: Record<string, unknown>): string {
  const data = payload.data;
  if (Array.isArray(data)) {
    const first = asRecord(data[0]);
    const b64 = first?.b64_json;
    if (typeof b64 === "string" && b64.trim()) return b64.trim();
  }
  const direct = payload.b64_json;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  return "";
}

export function extractXaiImageUrl(payload: Record<string, unknown>): string {
  const data = payload.data;
  if (Array.isArray(data)) {
    const first = asRecord(data[0]);
    if (typeof first?.url === "string" && first.url.trim()) return first.url.trim();
  }
  if (typeof payload.url === "string" && payload.url.trim()) return payload.url.trim();
  return "";
}

export function rewriteXaiImageDownloadUrl(imageUrl: string, baseUrl: string): string {
  return rewriteXaiDownloadUrl(imageUrl, baseUrl);
}

export function xaiImageErrorMessage(payload: Record<string, unknown>): string {
  return xaiErrorMessage(payload) === "Video generation failed"
    ? (xaiErrorMessage({ ...payload, message: payload.message || "Image generation failed" }))
    : xaiErrorMessage(payload);
}

export function isXaiImageSafetyBlock(payload: Record<string, unknown>, message: string): boolean {
  if (payload.respect_moderation === false) return true;
  return isXaiSafetyBlock(payload, message);
}

export { xaiProxyHost, XAI_API_HOST };
