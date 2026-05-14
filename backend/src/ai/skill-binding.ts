export function normalizeAgentSkillBindings(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [];
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const item of values) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized;
}

export function buildAgentSkillLookupClause(bindings: string[]): {
  clause: string;
  params: { skillBindings: string[] };
} | null {
  const normalized = normalizeAgentSkillBindings(bindings);
  if (normalized.length === 0) return null;

  return {
    clause: '(skill.namespace IN (:...skillBindings) OR skill.name IN (:...skillBindings))',
    params: { skillBindings: normalized },
  };
}
