const FALLBACK_FILENAME = '未命名文件';
const READABLE_UNICODE_RE = /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/u;
const CONTROL_RE = /[\u0000-\u001f\u007f]/g;

export function normalizeUploadedFilename(originalName?: string): string {
  const safeName = sanitizeFilename(originalName);
  const decoded = decodeLatin1Utf8(safeName);

  if (shouldUseDecodedName(safeName, decoded)) {
    return sanitizeFilename(decoded);
  }

  return safeName;
}

function sanitizeFilename(value?: string): string {
  const cleaned = String(value || FALLBACK_FILENAME)
    .replace(CONTROL_RE, '')
    .split(/[\\/]/)
    .pop()
    ?.trim();

  return cleaned || FALLBACK_FILENAME;
}

function decodeLatin1Utf8(value: string): string {
  try {
    return Buffer.from(value, 'latin1').toString('utf8');
  } catch {
    return value;
  }
}

function shouldUseDecodedName(raw: string, decoded: string): boolean {
  if (!decoded || decoded === raw || decoded.includes('\uFFFD')) return false;
  if (READABLE_UNICODE_RE.test(raw)) return false;
  if (READABLE_UNICODE_RE.test(decoded)) return true;

  return mojibakeScore(decoded) + 2 < mojibakeScore(raw);
}

function mojibakeScore(value: string): number {
  let score = 0;

  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code >= 0x80 && code <= 0x9f) score += 3;
  }

  const matches = value.match(/[ÃÂâæçåèéäöü]/g);
  return score + (matches?.length || 0);
}
