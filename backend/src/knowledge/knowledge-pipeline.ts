import JSZip from 'jszip';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import * as XLSX from 'xlsx';

export interface ChunkTextOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeTextChunk {
  index: number;
  content: string;
  metadata: Record<string, unknown>;
}

export interface RankableKnowledgeChunk {
  id: number;
  content: string;
  embedding: number[];
}

export interface RankedKnowledgeChunk extends RankableKnowledgeChunk {
  score: number;
}

const DEFAULT_CHUNK_SIZE = 1000;
const DEFAULT_CHUNK_OVERLAP = 180;
const TEXT_EXTENSIONS = /\.(txt|md|markdown|csv|json|yaml|yml|xml|html|htm|log|sql|py|js|ts|tsx|jsx|css)$/i;

export function chunkText(text: string, options: ChunkTextOptions = {}): KnowledgeTextChunk[] {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const chunkSize = Math.max(32, options.chunkSize ?? DEFAULT_CHUNK_SIZE);
  const chunkOverlap = Math.min(Math.max(0, options.chunkOverlap ?? DEFAULT_CHUNK_OVERLAP), Math.floor(chunkSize / 2));
  const chunks: KnowledgeTextChunk[] = [];
  let start = 0;

  while (start < normalized.length) {
    const targetEnd = Math.min(start + chunkSize, normalized.length);
    const end = findChunkEnd(normalized, start, targetEnd, chunkSize);
    const content = normalized.slice(start, end).trim();

    if (content) {
      chunks.push({
        index: chunks.length,
        content,
        metadata: {
          ...(options.metadata ?? {}),
          start,
          end,
        },
      });
    }

    if (end >= normalized.length) break;
    start = Math.max(end - chunkOverlap, start + 1);
  }

  return chunks;
}

export async function extractTextFromDocument(
  buffer: Buffer,
  filename: string,
  mimeType = '',
): Promise<string> {
  const lowerName = filename.toLowerCase();
  const type = mimeType.toLowerCase();

  if (type.includes('pdf') || lowerName.endsWith('.pdf')) {
    const parsed = await pdfParse(buffer);
    return normalizeText(parsed.text);
  }

  if (type.includes('wordprocessingml') || lowerName.endsWith('.docx')) {
    const result = await mammoth.extractRawText({ buffer });
    return normalizeText(result.value);
  }

  if (type.includes('presentationml') || lowerName.endsWith('.pptx')) {
    return extractPptxText(buffer);
  }

  if (
    type.includes('spreadsheet') ||
    type.includes('excel') ||
    lowerName.endsWith('.xlsx') ||
    lowerName.endsWith('.xls')
  ) {
    return extractWorkbookText(buffer);
  }

  if (type.startsWith('text/') || TEXT_EXTENSIONS.test(lowerName)) {
    return normalizeText(buffer.toString('utf8'));
  }

  return normalizeText(buffer.toString('utf8'));
}

export function rankKnowledgeChunks<T extends RankableKnowledgeChunk>(
  chunks: T[],
  queryEmbedding: number[],
  topK = 5,
): Array<T & { score: number }> {
  return chunks
    .map((chunk) => ({
      ...chunk,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }))
    .filter((chunk) => Number.isFinite(chunk.score))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, topK));
}

export function cosineSimilarity(left: number[], right: number[]): number {
  const length = Math.min(left.length, right.length);
  if (length === 0) return 0;

  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  for (let i = 0; i < length; i += 1) {
    const a = left[i] || 0;
    const b = right[i] || 0;
    dot += a * b;
    leftNorm += a * a;
    rightNorm += b * b;
  }

  if (leftNorm === 0 || rightNorm === 0) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

async function extractPptxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const slideNames = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const texts: string[] = [];

  for (const slideName of slideNames) {
    const entry = zip.file(slideName);
    if (!entry) continue;

    const xml = await entry.async('string');
    const slideText = [...xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)]
      .map((match) => decodeXml(match[1]))
      .filter(Boolean)
      .join('\n');

    if (slideText) {
      texts.push(slideText);
    }
  }

  return normalizeText(texts.join('\n\n'));
}

function extractWorkbookText(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sections = workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
    return `### ${sheetName}\n${csv}`;
  });

  return normalizeText(sections.join('\n\n'));
}

function findChunkEnd(text: string, start: number, targetEnd: number, chunkSize: number): number {
  if (targetEnd >= text.length) return text.length;

  const windowStart = Math.max(start + Math.floor(chunkSize * 0.55), start);
  const candidates = ['\n\n', '\n', '。', '！', '？', '；', ';', '.', ',', ' '];

  for (const separator of candidates) {
    const index = text.lastIndexOf(separator, targetEnd);
    if (index >= windowStart) {
      return index + separator.length;
    }
  }

  return targetEnd;
}

function normalizeText(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}
