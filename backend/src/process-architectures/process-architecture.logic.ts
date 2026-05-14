export interface ProcessArchitectureNodeLike {
  id: number;
  parentId?: number | null;
  code?: string | null;
  name: string;
  level?: number | null;
  sortOrder?: number | null;
  description?: string | null;
}

export interface ProcessArchitectureNodeSnapshot extends ProcessArchitectureNodeLike {
  parentId: number | null;
  code: string | null;
  level: number;
  sortOrder: number;
  description: string | null;
  children: ProcessArchitectureNodeSnapshot[];
}

export interface ProcessArchitectureBoundItem {
  id: number;
  name: string;
  description?: string | null;
  namespace?: string | null;
  processArchitectureNodeIds?: unknown;
  [key: string]: unknown;
}

export interface ProcessArchitectureCoverageInput {
  nodes: ProcessArchitectureNodeLike[];
  selectedNodeId?: number | null;
  agents: ProcessArchitectureBoundItem[];
  skills: ProcessArchitectureBoundItem[];
  knowledgeDocuments?: ProcessArchitectureBoundItem[];
}

export interface ProcessArchitectureNodeCoverage {
  nodeId: number;
  directAgentCount: number;
  directSkillCount: number;
  directKnowledgeDocumentCount: number;
  agentCount: number;
  skillCount: number;
  knowledgeDocumentCount: number;
}

export interface ProcessArchitectureCoverageSummary {
  selectedNodeId: number | null;
  selectedNodeIds: number[];
  selectedNode: ProcessArchitectureNodeLike | null;
  agents: ProcessArchitectureBoundItem[];
  skills: ProcessArchitectureBoundItem[];
  knowledgeDocuments: ProcessArchitectureBoundItem[];
  agentCount: number;
  skillCount: number;
  knowledgeDocumentCount: number;
  nodeCoverage: ProcessArchitectureNodeCoverage[];
}

export function parseProcessArchitectureBinding(value: unknown): number[] {
  const rawValues = normalizeBindingValue(value);
  const seen = new Set<number>();
  const ids: number[] = [];

  for (const raw of rawValues) {
    const numeric = typeof raw === 'number' ? raw : Number(String(raw).trim());
    if (!Number.isInteger(numeric) || numeric <= 0 || seen.has(numeric)) continue;
    seen.add(numeric);
    ids.push(numeric);
  }

  return ids;
}

export function serializeProcessArchitectureBinding(value: unknown): string {
  return JSON.stringify(parseProcessArchitectureBinding(value));
}

export function buildProcessArchitectureSnapshot(
  nodes: ProcessArchitectureNodeLike[],
): ProcessArchitectureNodeSnapshot[] {
  const sorted = [...nodes].sort((a, b) => {
    const levelDiff = Number(a.level ?? 1) - Number(b.level ?? 1);
    if (levelDiff !== 0) return levelDiff;
    const orderDiff = Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0);
    return orderDiff || a.name.localeCompare(b.name, 'zh-Hans-CN');
  });

  const byId = new Map<number, ProcessArchitectureNodeSnapshot>();
  const roots: ProcessArchitectureNodeSnapshot[] = [];

  for (const node of sorted) {
    byId.set(node.id, {
      id: node.id,
      parentId: node.parentId ?? null,
      code: node.code ?? null,
      name: node.name,
      level: Number(node.level ?? 1),
      sortOrder: Number(node.sortOrder ?? 0),
      description: node.description ?? null,
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

export function collectDescendantNodeIds(
  nodes: ProcessArchitectureNodeLike[],
  selectedNodeId: number,
): number[] {
  const childIdsByParent = new Map<number, number[]>();
  for (const node of nodes) {
    if (!node.parentId) continue;
    const siblings = childIdsByParent.get(node.parentId) || [];
    siblings.push(node.id);
    childIdsByParent.set(node.parentId, siblings);
  }

  const result: number[] = [];
  const visit = (nodeId: number) => {
    result.push(nodeId);
    for (const childId of childIdsByParent.get(nodeId) || []) {
      visit(childId);
    }
  };

  visit(selectedNodeId);
  return result;
}

export function summarizeProcessArchitectureCoverage(
  input: ProcessArchitectureCoverageInput,
): ProcessArchitectureCoverageSummary {
  const selectedNodeId = input.selectedNodeId ?? null;
  const selectedNodeIds = selectedNodeId
    ? collectDescendantNodeIds(input.nodes, selectedNodeId)
    : input.nodes.map((node) => node.id);
  const selectedNodeSet = new Set(selectedNodeIds);
  const selectedNode = selectedNodeId
    ? input.nodes.find((node) => node.id === selectedNodeId) || null
    : null;

  const agents = selectedNodeId
    ? input.agents.filter((agent) => itemMatchesAnyNode(agent, selectedNodeSet))
    : input.agents;
  const skills = selectedNodeId
    ? input.skills.filter((skill) => itemMatchesAnyNode(skill, selectedNodeSet))
    : input.skills;
  const knowledgeDocuments = selectedNodeId
    ? (input.knowledgeDocuments || []).filter((document) => itemMatchesAnyNode(document, selectedNodeSet))
    : (input.knowledgeDocuments || []);

  return {
    selectedNodeId,
    selectedNodeIds,
    selectedNode,
    agents: agents.map(withParsedBinding),
    skills: skills.map(withParsedBinding),
    knowledgeDocuments: knowledgeDocuments.map(withParsedBinding),
    agentCount: agents.length,
    skillCount: skills.length,
    knowledgeDocumentCount: knowledgeDocuments.length,
    nodeCoverage: buildNodeCoverage(input.nodes, input.agents, input.skills, input.knowledgeDocuments || []),
  };
}

function buildNodeCoverage(
  nodes: ProcessArchitectureNodeLike[],
  agents: ProcessArchitectureBoundItem[],
  skills: ProcessArchitectureBoundItem[],
  knowledgeDocuments: ProcessArchitectureBoundItem[],
): ProcessArchitectureNodeCoverage[] {
  return nodes.map((node) => {
    const descendants = new Set(collectDescendantNodeIds(nodes, node.id));
    const direct = new Set([node.id]);
    return {
      nodeId: node.id,
      directAgentCount: agents.filter((agent) => itemMatchesAnyNode(agent, direct)).length,
      directSkillCount: skills.filter((skill) => itemMatchesAnyNode(skill, direct)).length,
      directKnowledgeDocumentCount: knowledgeDocuments.filter((document) => itemMatchesAnyNode(document, direct)).length,
      agentCount: agents.filter((agent) => itemMatchesAnyNode(agent, descendants)).length,
      skillCount: skills.filter((skill) => itemMatchesAnyNode(skill, descendants)).length,
      knowledgeDocumentCount: knowledgeDocuments.filter((document) => itemMatchesAnyNode(document, descendants)).length,
    };
  });
}

function normalizeBindingValue(value: unknown): unknown[] {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'number') return [value];
  if (typeof value !== 'string') return [];

  const trimmed = value.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return trimmed.split(/[,\s，]+/).filter(Boolean);
}

function itemMatchesAnyNode(item: ProcessArchitectureBoundItem, nodeIds: Set<number>): boolean {
  return parseProcessArchitectureBinding(item.processArchitectureNodeIds).some((id) => nodeIds.has(id));
}

function withParsedBinding<T extends ProcessArchitectureBoundItem>(item: T): T {
  return {
    ...item,
    processArchitectureNodeIds: parseProcessArchitectureBinding(item.processArchitectureNodeIds),
  };
}
