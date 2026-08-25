const MIME_BY_EXTENSION: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  avif: 'image/avif',
  heic: 'image/heic',
  tif: 'image/tiff',
  tiff: 'image/tiff',
};

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
  'image/heic': 'heic',
  'image/tiff': 'tiff',
};

function knownExtension(name: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(name);
  const ext = match ? match[1].toLowerCase() : '';
  return MIME_BY_EXTENSION[ext] ? ext : '';
}

function isImageLike(file: File): boolean {
  if (file.type.startsWith('image/')) return true;
  if (knownExtension(file.name)) return true;
  /* Raw bitmaps from some apps arrive with neither a name nor a type. */
  return !file.type && !file.name;
}

/** Fill in whatever the source app left out, so the upload lands with the right extension. */
function withImageMetadata(file: File): File {
  const ext = knownExtension(file.name);
  if (file.type && ext) return file;

  const type = file.type || MIME_BY_EXTENSION[ext] || 'image/png';
  const name = ext ? file.name : `paste-${Date.now()}.${EXTENSION_BY_MIME[type] ?? 'png'}`;
  return new File([file], name, { type });
}

function transferredFiles(data: DataTransfer | null): File[] {
  if (!data) return [];

  const direct = Array.from(data.files);
  if (direct.length > 0) return direct;

  const fromItems: File[] = [];
  for (const item of Array.from(data.items)) {
    if (item.kind !== 'file') continue;
    const file = item.getAsFile();
    if (file) fromItems.push(file);
  }
  return fromItems;
}

/**
 * Collect image files from a paste or drop.
 *
 * Clipboards differ a lot by source: screenshots arrive as typed `image/*` blobs,
 * files copied in Finder or written by annotation tools often carry no MIME type
 * at all, so the extension has to stand in for it.
 */
export function imageFilesFromTransfer(data: DataTransfer | null): File[] {
  return transferredFiles(data).filter(isImageLike).map(withImageMetadata);
}
