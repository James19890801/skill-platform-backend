import { createHash } from 'crypto';

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

function normalizeTools(tools: unknown[]): any[] {
  return tools
    .flatMap((tool) => Array.isArray(tool) ? tool : [tool])
    .filter((tool) => isRecord(tool) && isRecord(tool.function) && typeof tool.function.name === 'string');
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
  if (value === 'script' || value === 'template' || value === 'asset' || value === 'data') {
    return value;
  }
  return 'reference';
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
