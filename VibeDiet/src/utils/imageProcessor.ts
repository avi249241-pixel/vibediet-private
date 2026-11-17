import { compressImageClientSide, CompressedImageResult } from './imageCompressor.js';

export interface CompressedImagePayload {
  base64Payload: string;
  thumbnailDataUrl: string;
  width: number;
  height: number;
  byteSize: number;
}

/**
 * Downscales a browser File or DataURL to max 1280px JPEG/WebP (<250KB)
 * for ephemeral vision recognition, plus a 320px thumbnail for timeline history.
 */
export async function compressMealImageClientSide(
  sourceDataUrl: string,
  maxDimension = 1280,
  quality = 0.84
): Promise<CompressedImagePayload> {
  const result: CompressedImageResult = await compressImageClientSide(sourceDataUrl, {
    maxDimension,
    quality,
    format: 'image/jpeg',
    maxBytes: 250 * 1024,
  });

  return {
    base64Payload: result.dataUrl,
    thumbnailDataUrl: result.thumbnailDataUrl,
    width: result.width,
    height: result.height,
    byteSize: result.byteSize,
  };
}

export { compressImageClientSide };
