const DEFAULT_KNOWLEDGE_UPLOAD_LIMIT_BYTES = 80 * 1024 * 1024;

export function getKnowledgeUploadLimitBytes() {
  const value = Number(process.env.KNOWLEDGE_UPLOAD_LIMIT_BYTES);
  if (Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  return DEFAULT_KNOWLEDGE_UPLOAD_LIMIT_BYTES;
}

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const precision = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(precision)}${units[unitIndex]}`;
}

export const KNOWLEDGE_SUPPORTED_EXTENSIONS = [
  '.pdf',
  '.docx',
  '.pptx',
  '.xlsx',
  '.xls',
  '.txt',
  '.md',
  '.csv',
  '.json',
  '.html',
  '.xml',
  '.yaml',
  '.yml',
];
