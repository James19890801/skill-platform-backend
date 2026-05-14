export interface CapabilityTreeNodeInput {
  id: number;
  parentId?: number | null;
  nodeType: string;
  label: string;
  domain?: string | null;
  subDomain?: string | null;
  skillId?: number | null;
  namespace?: string | null;
  orderIndex?: number | null;
  loopPolicy?: string | null;
  conditionExpression?: string | null;
}

export interface CapabilityTreeNodeSnapshot extends CapabilityTreeNodeInput {
  children: CapabilityTreeNodeSnapshot[];
}

export function buildCapabilityTreeSnapshot(
  nodes: CapabilityTreeNodeInput[],
): CapabilityTreeNodeSnapshot[] {
  const sorted = [...nodes].sort((a, b) => {
    const orderA = Number(a.orderIndex ?? 0);
    const orderB = Number(b.orderIndex ?? 0);
    return orderA - orderB || a.label.localeCompare(b.label);
  });
  const byId = new Map<number, CapabilityTreeNodeSnapshot>();
  const roots: CapabilityTreeNodeSnapshot[] = [];

  for (const node of sorted) {
    byId.set(node.id, {
      id: node.id,
      parentId: node.parentId ?? null,
      nodeType: node.nodeType,
      label: node.label,
      domain: node.domain ?? null,
      subDomain: node.subDomain ?? null,
      skillId: node.skillId ?? null,
      namespace: node.namespace ?? null,
      orderIndex: node.orderIndex ?? 0,
      loopPolicy: node.loopPolicy ?? null,
      conditionExpression: node.conditionExpression ?? null,
      children: [],
    });
  }

  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export function collectSkillNamespacesFromSnapshot(
  snapshot: CapabilityTreeNodeSnapshot[] | unknown,
): string[] {
  if (!Array.isArray(snapshot)) return [];

  const namespaces: string[] = [];
  const seen = new Set<string>();
  const visit = (nodes: unknown[]) => {
    for (const node of nodes) {
      if (!node || typeof node !== 'object') continue;
      const record = node as Record<string, unknown>;
      const namespace = typeof record.namespace === 'string' ? record.namespace.trim() : '';
      if (namespace && !seen.has(namespace)) {
        seen.add(namespace);
        namespaces.push(namespace);
      }
      if (Array.isArray(record.children)) {
        visit(record.children);
      }
    }
  };

  visit(snapshot);
  return namespaces;
}

export function parseCapabilityTreeSnapshot(value: unknown): CapabilityTreeNodeSnapshot[] {
  if (Array.isArray(value)) return value as CapabilityTreeNodeSnapshot[];
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
