import encodeAvif, { init as initAvifEncode } from '@jsquash/avif/encode';
import decodeJpeg, { init as initJpegDecode } from '@jsquash/jpeg/decode';
import decodePng, { init as initPngDecode } from '@jsquash/png/decode';
import decodeWebp, { init as initWebpDecode } from '@jsquash/webp/decode';

// @ts-ignore
import avifEncWasm from '@jsquash/avif/codec/enc/avif_enc.wasm';
// @ts-ignore
import jpegDecWasm from '@jsquash/jpeg/codec/dec/mozjpeg_dec.wasm';
// @ts-ignore
import pngDecWasm from '@jsquash/png/codec/pkg/squoosh_png_bg.wasm';
// @ts-ignore
import webpDecWasm from '@jsquash/webp/codec/dec/webp_dec.wasm';

let isInitialized = false;

export async function initImageProcessor() {
    if (isInitialized) return;
    await Promise.all([
        initAvifEncode(avifEncWasm),
        initJpegDecode(jpegDecWasm),
        initPngDecode(pngDecWasm),
        initWebpDecode(webpDecWasm)
    ]);
    isInitialized = true;
}

export async function processImageToAvif(buffer: ArrayBuffer, contentType: string): Promise<ArrayBuffer> {
    await initImageProcessor();
    let imageData;
    const type = contentType.split(';')[0].trim().toLowerCase();
    
    if (type === 'image/jpeg') {
        imageData = await decodeJpeg(buffer);
    } else if (type === 'image/png') {
        imageData = await decodePng(buffer);
    } else if (type === 'image/webp') {
        imageData = await decodeWebp(buffer);
    } else if (type === 'image/avif') {
        return buffer;
    } else {
        throw new Error(`Unsupported image format for conversion: ${type}`);
    }

    const avifBuffer = await encodeAvif(imageData);
    return avifBuffer;
}
