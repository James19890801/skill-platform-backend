import { createHash } from 'crypto';
import JSZip from 'jszip';

export type NetworkPermission = 'none' | 'allowlist' | 'all';

export interface SkillRuntimePermissions {
  network: NetworkPermission;
  domains: string[];
  filesystem: 'workspace';
  secrets: string[];
}

export interface SkillTriggerRule {
  type: 'keyword' | 'namespace' | 'manual';
  value: string;
}

export interface SkillPackageFile {
  path: string;
  name: string;
  type: 'script' | 'template' | 'reference' | 'asset' | 'data';
  content?: string;
  encoding: 'utf8' | 'base64';
  mimeType?: string;
}

export interface SkillPackage {
  id: string;
  skillId: number;
  namespace: string;
  name: string;
  version: string;
  description: string;
  domain: string;
  subDomain: string;
  abilityName: string;
  instructions: string;
  agentPrompt?: string;
  files: SkillPackageFile[];
  tools: any[];
  triggers: SkillTriggerRule[];
  dependencies: string[];
  permissions: SkillRuntimePermissions;
  maxRounds: number;
  entrypointScript?: string;
  packageHash: string;
}

export interface SkillCandidate extends SkillPackage {
  score: number;
  matchReason: 'explicit' | 'trigger' | 'text';
}

export interface ResolveSkillInput {
  input: string;
  explicitSkills?: string[];
  limit?: number;
}

export interface SkillLike {
  id: number;
  namespace: string;
  name: string;
  domain: string;
  subDomain: string;
  abilityName: string;
  description?: string | null;
  currentVersion?: string | null;
  content?: string | null;
  agentPrompt?: string | null;
  files?: string | null;
  toolDefinition?: string | null;
  manifest?: string | null;
  runtimePolicy?: string | null;
  triggerRules?: string | null;
}

export interface ParsedSkillPackageDraft {
  namespace: string;
  name: string;
  domain: string;
  subDomain: string;
  abilityName: string;
  description: string;
  currentVersion: string;
  content: string;
  files: SkillPackageFile[];
  manifest: string;
  runtimePolicy?: string;
  triggerRules?: string;
}

const DEFAULT_MAX_ROUNDS = 15;

export function buildSkillPackage(skill: SkillLike): SkillPackage {
  const manifest = parseObject(skill.manifest) ?? {};
  const runtime = parseObject(manifest.runtime) ?? {};
  const runtimePolicy = parseObject(skill.runtimePolicy) ?? {};
  const explicitPermissions = parseObject(runtime.permissions) ?? parseObject(runtimePolicy.permissions);
  const instructions = pickString(manifest.instructions, skill.content, skill.agentPrompt);

  if (!instructions.trim()) {
    throw new Error(`Skill ${skill.namespace} 缺少可执行说明，请补充 content 或 agentPrompt`);
  }

  const pkgWithoutHash = {
    id: pickString(manifest.id, skill.namespace),
    skillId: skill.id,
    namespace: skill.namespace,
    name: skill.name,
    version: pickString(manifest.version, skill.currentVersion, '1.0.0'),
    description: pickString(manifest.description, skill.description),
    domain: skill.domain,
    subDomain: skill.subDomain,
    abilityName: skill.abilityName,
    instructions,
    agentPrompt: skill.agentPrompt || undefined,
    files: normalizeFiles([...parseArray(manifest.files), ...parseArray(skill.files)]),
    tools: normalizeTools([...parseArray(manifest.tools), ...parseToolDefinitions(skill.toolDefinition)]),
    triggers: normalizeTriggers([...parseArray(manifest.triggers), ...parseArray(skill.triggerRules)]),
    dependencies: normalizeStringList(manifest.dependencies),
    permissions: normalizePermissions(explicitPermissions),
    maxRounds: normalizePositiveInt(runtime.maxRounds ?? runtimePolicy.maxRounds, DEFAULT_MAX_ROUNDS),
    entrypointScript: pickString(runtime.entrypointScript, runtimePolicy.entrypointScript),
  };

  return {
    ...pkgWithoutHash,
    packageHash: sha256(stableStringify(pkgWithoutHash)),
  };
}

export function resolveSkillCandidates(
  packages: SkillPackage[],
  input: ResolveSkillInput,
): SkillCandidate[] {
  const query = input.input.toLowerCase();
  const explicit = new Set((input.explicitSkills ?? []).map((value) => value.toLowerCase()));
  const limit = input.limit ?? 5;

  return packages
    .map((pkg) => scorePackage(pkg, query, explicit))
    .filter((candidate): candidate is SkillCandidate => candidate !== null)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export function buildSkillWorkspaceId(skillId: number, executionId: number, threadId?: string): string {
  const suffix = sanitizeSegment(threadId || 'standalone');
  return `skill_${skillId}_exec_${executionId}_${suffix}`;
}

export async function buildSkillPackageZip(skill: SkillPackage | SkillLike): Promise<Buffer> {
  const pkg = isSkillPackage(skill) ? skill : buildSkillPackage(skill);
  const zip = new JSZip();

  zip.file('SKILL.md', pkg.instructions);
  zip.file('skill.json', JSON.stringify(toPackageManifest(pkg), null, 2));

  for (const file of pkg.files) {
    const path = normalizeBundleFilePath(file);
    zip.file(path, fileContentToBuffer(file));
  }

  return zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

export async function parseSkillPackageZip(
  buffer: Buffer,
  fallback: { namespace?: string; name?: string } = {},
): Promise<ParsedSkillPackageDraft> {
  const zip = await JSZip.loadAsync(buffer);
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  const skillEntry = findZipEntry(entries, 'SKILL.md');

  if (!skillEntry) {
    throw new Error('Skill zip 包缺少根目录 SKILL.md');
  }

  const manifestEntry = findZipEntry(entries, 'skill.json') ?? findZipEntry(entries, 'manifest.json');
  const rawManifest = manifestEntry ? await manifestEntry.async('string') : '{}';
  const manifest = parseObject(rawManifest) ?? {};
  const content = await skillEntry.async('string');
  const namespace = pickString(manifest.namespace, manifest.id, fallback.namespace, `uploaded.${Date.now()}`);
  const name = pickString(manifest.name, fallback.name, namespace.split('.').pop(), '上传 Skill');
  const files: SkillPackageFile[] = [];

  for (const entry of entries) {
    if (isReservedBundlePath(entry.name)) continue;
    const path = sanitizePath(entry.name);
    const fileBuffer = await entry.async('nodebuffer');
    files.push({
      path,
      name: path.split('/').pop() || path,
      type: inferFileTypeFromPath(path),
      content: fileBuffer.toString('base64'),
      encoding: 'base64',
    });
  }

  const normalizedManifest = {
    ...manifest,
    id: pickString(manifest.id, namespace),
    namespace,
    name,
    description: pickString(manifest.description),
    version: pickString(manifest.version, '1.0.0'),
    entrypoint: 'SKILL.md',
    files: files.map(toManifestFile),
  };

  return {
    namespace,
    name,
    domain: pickString(manifest.domain, 'other'),
    subDomain: pickString(manifest.subDomain, 'miscellaneous'),
    abilityName: pickString(manifest.abilityName, name),
    description: pickString(manifest.description),
    currentVersion: pickString(manifest.version, '1.0.0'),
    content,
    files,
    manifest: JSON.stringify(normalizedManifest, null, 2),
    runtimePolicy: manifest.runtime ? JSON.stringify(manifest.runtime, null, 2) : undefined,
    triggerRules: manifest.triggers ? JSON.stringify(parseArray(manifest.triggers)) : undefined,
  };
}

function scorePackage(
  pkg: SkillPackage,
  query: string,
  explicit: Set<string>,
): SkillCandidate | null {
  const ids = [pkg.id, pkg.namespace, pkg.name].map((value) => value.toLowerCase());
  if (ids.some((value) => explicit.has(value) || query.includes(value))) {
    return { ...pkg, score: 10_000, matchReason: 'explicit' };
  }

  let score = 0;
  for (const trigger of pkg.triggers) {
    if (trigger.value && query.includes(trigger.value.toLowerCase())) {
      score += 500;
    }
  }
  if (score > 0) {
    return { ...pkg, score, matchReason: 'trigger' };
  }

  const searchable = [
    pkg.name,
    pkg.description,
    pkg.domain,
    pkg.subDomain,
    pkg.abilityName,
    pkg.namespace,
  ].join(' ').toLowerCase();

  for (const token of tokenize(query)) {
    if (searchable.includes(token)) {
      score += token.length > 1 ? 10 : 1;
    }
  }

  return score > 0 ? { ...pkg, score, matchReason: 'text' } : null;
}

function normalizeFiles(files: unknown[]): SkillPackageFile[] {
  return files
    .filter((file): file is Record<string, unknown> => isRecord(file))
    .map((file) => {
      const rawPath = pickString(file.path, file.name, 'file.txt');
      const path = sanitizePath(rawPath);
      return {
        path,
        name: path.split('/').pop() || path,
        type: normalizeFileType(pickString(file.type, 'reference')),
        content: pickString(file.content, file.description) || undefined,
        encoding: pickString(file.encoding, 'utf8') === 'base64' ? 'base64' : 'utf8',
        mimeType: pickString(file.mimeType, file.mime) || undefined,
      };
    });
}

export function normalizeToolDefinitionList(raw: string | null | undefined): any[] {
  return normalizeTools(parseToolDefinitions(raw));
}

function normalizeTools(tools: unknown[]): any[] {
  return tools
    .flatMap((tool) => Array.isArray(tool) ? normalizeTools(tool) : [normalizeToolDefinition(tool)])
    .filter((tool): tool is any => tool !== null);
}

function normalizeToolDefinition(tool: unknown): any | null {
  if (!isRecord(tool)) return null;

  if (isRecord(tool.function)) {
    const name = pickString(tool.function.name);
    if (!name) return null;

    return {
      type: 'function',
      function: {
        name,
        description: pickString(tool.function.description, tool.description, name),
        parameters: normalizeToolParameters(tool.function.parameters),
      },
    };
  }

  const legacyName = pickString(tool.name);
  if (!legacyName) return null;

  return {
    type: 'function',
    function: {
      name: legacyName,
      description: pickString(tool.description, legacyName),
      parameters: normalizeToolParameters(tool.parameters),
    },
  };
}

function normalizeToolParameters(value: unknown): Record<string, unknown> {
  if (isRecord(value)) return value;
  return {
    type: 'object',
    properties: {},
    required: [],
  };
}

function normalizeTriggers(triggers: unknown[]): SkillTriggerRule[] {
  const normalized = triggers
    .filter((trigger): trigger is Record<string, unknown> => isRecord(trigger))
    .map((trigger) => {
      const value = pickString(trigger.value, trigger.keyword, trigger.namespace);
      if (!value) return null;
      return {
        type: normalizeTriggerType(pickString(trigger.type, 'keyword')),
        value,
      };
    })
    .filter((trigger): trigger is SkillTriggerRule => trigger !== null);

  return normalized.length > 0 ? normalized : [{ type: 'manual', value: '' }];
}

function normalizePermissions(value: unknown): SkillRuntimePermissions {
  const permissions = isRecord(value) ? value : {};
  const network = pickString(permissions.network, 'none') as NetworkPermission;
  return {
    network: network === 'all' || network === 'allowlist' ? network : 'none',
    domains: normalizeStringList(permissions.domains),
    filesystem: 'workspace',
    secrets: normalizeStringList(permissions.secrets),
  };
}

function normalizeFileType(value: string): SkillPackageFile['type'] {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'script' || normalized === 'scripts') {
    return 'script';
  }
  if (normalized === 'template' || normalized === 'templates') {
    return 'template';
  }
  if (normalized === 'asset' || normalized === 'assets') {
    return 'asset';
  }
  if (normalized === 'data' || normalized === 'datasets') {
    return 'data';
  }
  return 'reference';
}

function inferFileTypeFromPath(path: string): SkillPackageFile['type'] {
  const folder = path.split('/')[0] || '';
  return normalizeFileType(folder);
}

function normalizeTriggerType(value: string): SkillTriggerRule['type'] {
  if (value === 'namespace' || value === 'manual') {
    return value;
  }
  return 'keyword';
}

function parseToolDefinitions(raw: string | null | undefined): unknown[] {
  const parsed = parseJson(raw);
  if (!parsed) return [];
  return Array.isArray(parsed) ? parsed : [parsed];
}

function parseArray(value: unknown): unknown[] {
  const parsed = typeof value === 'string' ? parseJson(value) : value;
  return Array.isArray(parsed) ? parsed : [];
}

function parseObject(value: unknown): Record<string, unknown> | null {
  const parsed = typeof value === 'string' ? parseJson(value) : value;
  return isRecord(parsed) ? parsed : null;
}

function parseJson(value: string | null | undefined): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeStringList(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [];
  return values.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function normalizePositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function pickString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return '';
}

function tokenize(value: string): string[] {
  return value
    .split(/[^\p{Letter}\p{Number}]+/u)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
}

function sanitizePath(value: string): string {
  return value
    .replace(/\\/g, '/')
    .split('/')
    .filter((segment) => segment && segment !== '.' && segment !== '..')
    .map(sanitizeSegment)
    .join('/') || 'file.txt';
}

function sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 96);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSkillPackage(value: SkillPackage | SkillLike): value is SkillPackage {
  return isRecord(value) && typeof value.packageHash === 'string' && Array.isArray(value.files);
}

function toPackageManifest(pkg: SkillPackage): Record<string, unknown> {
  return {
    schemaVersion: 'skill-package/v1',
    id: pkg.id,
    namespace: pkg.namespace,
    name: pkg.name,
    version: pkg.version,
    description: pkg.description,
    domain: pkg.domain,
    subDomain: pkg.subDomain,
    abilityName: pkg.abilityName,
    entrypoint: 'SKILL.md',
    packageHash: pkg.packageHash,
    triggers: pkg.triggers,
    dependencies: pkg.dependencies,
    permissions: pkg.permissions,
    maxRounds: pkg.maxRounds,
    files: pkg.files.map(toManifestFile),
  };
}

function toManifestFile(file: SkillPackageFile): Record<string, unknown> {
  return {
    path: file.path,
    name: file.name,
    type: file.type,
    encoding: file.encoding,
    mimeType: file.mimeType,
  };
}

function normalizeBundleFilePath(file: SkillPackageFile): string {
  const path = sanitizePath(file.path);
  return isReservedBundlePath(path) ? `references/${sanitizeSegment(file.name || path)}` : path;
}

function fileContentToBuffer(file: SkillPackageFile): Buffer {
  const content = file.content ?? '';
  if (file.encoding === 'base64') {
    return Buffer.from(stripDataUrlPrefix(content), 'base64');
  }
  return Buffer.from(content, 'utf8');
}

function stripDataUrlPrefix(value: string): string {
  const marker = ';base64,';
  const markerIndex = value.indexOf(marker);
  if (markerIndex >= 0) {
    return value.slice(markerIndex + marker.length);
  }
  return value;
}

function findZipEntry(entries: JSZip.JSZipObject[], path: string): JSZip.JSZipObject | undefined {
  const normalized = path.toLowerCase();
  return entries.find((entry) => entry.name.replace(/\\/g, '/').toLowerCase() === normalized);
}

function isReservedBundlePath(path: string): boolean {
  const normalized = sanitizePath(path).toLowerCase();
  return normalized === 'skill.md' || normalized === 'skill.json' || normalized === 'manifest.json';
}
