/**
 * Image compression utility
 * Compresses images before upload to optimize bandwidth
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxSizeMB?: number;
}

const DEFAULT_OPTIONS: CompressionOptions = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.8,
  maxSizeMB: 2
};

/**
 * Compresses an image file
 * @param file - The image file to compress
 * @param options - Compression options
 * @returns Promise<File> - The compressed file
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Only compress images
  if (!file.type.startsWith('image/')) {
    return file;
  }

  // Skip GIFs to preserve animation
  if (file.type === 'image/gif') {
    return file;
  }

  // Skip if already small enough
  const maxSizeBytes = (opts.maxSizeMB || 2) * 1024 * 1024;
  if (file.size <= maxSizeBytes) {
    console.log(`[ImageCompression] File already small (${formatSize(file.size)}), skipping compression`);
    return file;
  }

  console.log(`[ImageCompression] Compressing ${file.name} (${formatSize(file.size)})`);

  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Canvas context not available'));
      return;
    }

    img.onload = () => {
      URL.revokeObjectURL(img.src);

      // Calculate new dimensions maintaining aspect ratio
      let { width, height } = img;
      const maxW = opts.maxWidth || 1920;
      const maxH = opts.maxHeight || 1920;

      if (width > maxW) {
        height = (height * maxW) / width;
        width = maxW;
      }

      if (height > maxH) {
        width = (width * maxH) / height;
        height = maxH;
      }

      canvas.width = width;
      canvas.height = height;

      // Draw with high quality
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to blob
      const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const quality = outputType === 'image/png' ? undefined : opts.quality;

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to compress image'));
            return;
          }

          // If compressed is larger, return original
          if (blob.size >= file.size) {
            console.log(`[ImageCompression] Compressed larger than original, using original`);
            resolve(file);
            return;
          }

          const compressedFile = new File([blob], file.name, {
            type: outputType,
            lastModified: Date.now()
          });

          const savings = ((1 - blob.size / file.size) * 100).toFixed(1);
          console.log(
            `[ImageCompression] Compressed: ${formatSize(file.size)} → ${formatSize(blob.size)} (${savings}% saved)`
          );

          resolve(compressedFile);
        },
        outputType,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      console.warn('[ImageCompression] Failed to load image, using original');
      resolve(file);
    };

    img.src = URL.createObjectURL(file);
  });
}

/**
 * Format file size for display
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Check if a file is an image that can be compressed
 */
export function isCompressibleImage(file: File): boolean {
  return (
    file.type.startsWith('image/') &&
    file.type !== 'image/gif' &&
    file.type !== 'image/svg+xml'
  );
}
