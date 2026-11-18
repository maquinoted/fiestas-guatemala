const blobHost = 'epz8axooawqvkjsf.public.blob.vercel-storage.com';
const srcsetWidths = [400, 800, 1200];

function imageUrlParts(imageUrl: string | null | undefined) {
  if (!imageUrl) return null;
  try {
    const parsed = new URL(imageUrl, 'https://fiestasguatemala.com');
    const filename = parsed.pathname.split('/').filter(Boolean).pop();
    return { parsed, filename };
  } catch {
    return null;
  }
}

export function optimizedImageSrc(imageUrl: string | null | undefined, width = 800, quality = 70) {
  if (!imageUrl) return '/placeholder.jpg';
  const parts = imageUrlParts(imageUrl);
  if (!parts) return imageUrl;
  const { parsed, filename } = parts;

  if (parsed.hostname === blobHost && filename) {
    return `/api/image/${encodeURIComponent(decodeURIComponent(filename))}?w=${width}&q=${quality}`;
  }
  if (parsed.pathname.startsWith('/api/image/')) {
    return `${parsed.pathname}?w=${width}&q=${quality}`;
  }
  if (parsed.hostname === 'images.unsplash.com') {
    parsed.searchParams.set('w', String(width));
    parsed.searchParams.set('q', String(quality));
    parsed.searchParams.set('auto', 'format');
    parsed.searchParams.set('fit', 'crop');
    return parsed.toString();
  }
  return imageUrl;
}

export function optimizedImageSrcSet(imageUrl: string | null | undefined) {
  if (!imageUrl) return undefined;
  const parts = imageUrlParts(imageUrl);
  if (!parts) return undefined;
  const { parsed } = parts;
  if (parsed.hostname !== blobHost &&
      !parsed.pathname.startsWith('/api/image/') &&
      parsed.hostname !== 'images.unsplash.com') {
    return undefined;
  }
  return srcsetWidths.map((width) => `${optimizedImageSrc(imageUrl, width)} ${width}w`).join(', ');
}
