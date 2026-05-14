import { createHash } from 'crypto';
import { ProcessArchitectureNodeLike } from './process-architecture.logic';

export const DEMO_AGENT_PREFIX = '流程AI · ';
export const DEMO_KNOWLEDGE_PREFIX = '流程知识库 · ';
export const DEMO_SKILL_NAMESPACE_PREFIX = 'process.demo.';
export const ARCHITECTURE_BINDING_DOC_NAME = '流程架构绑定说明.md';

export interface ProcessArchitectureAssetNode extends ProcessArchitectureNodeLike {
  id: number;
  name: string;
  level: number;
  sortOrder: number;
}

export interface DemoAgentSeed {
  name: string;
  description: string;
  systemPrompt: string;
  model: string;
  processArchitectureNodeIds: number[];
  node: ProcessArchitectureAssetNode;
}

export interface DemoSkillSeed {
  namespace: string;
  name: string;
  domain: string;
  subDomain: string;
  abilityName: string;
  description: string;
  content: string;
  triggerRules: string;
  toolDefinition: string;
  processArchitectureNodeIds: number[];
  node: ProcessArchitectureAssetNode;
}

export interface DemoKnowledgeBaseSeed {
  name: string;
  description: string;
  processArchitectureNodeIds: number[];
  document: {
    name: string;
    content: string;
  };
  node: ProcessArchitectureAssetNode;
}

const capabilityTemplates = [
  { suffix: '流程诊断', ability: '流程诊断', verb: '识别断点、返工和等待' },
  { suffix: 'SOP生成', ability: 'SOP生成', verb: '生成标准作业说明和检查清单' },
  { suffix: '风险快筛', ability: '风险识别', verb: '扫描异常、合规风险和交付风险' },
  { suffix: '指标复盘', ability: '指标复盘', verb: '追踪效率、质量、成本和周期指标' },
  { suffix: '知识问答', ability: '知识问答', verb: '基于制度和流程文档回答问题' },
  { suffix: '数据看板', ability: '经营看板', verb: '整理数据口径并输出看板建议' },
  { suffix: '审批助手', ability: '审批辅助', verb: '汇总审批依据、缺口和建议' },
  { suffix: '异常归因', ability: '异常归因', verb: '定位偏差原因并给出处理路径' },
];

const keywordGroups: Array<{ pattern: RegExp; domain: string; subDomain: string; hints: string[] }> = [
  { pattern: /合同|回款|线索|客户|报价|机会|LTC/i, domain: 'sales', subDomain: 'ltc', hints: ['合同', '回款', '线索', '客户', '报价', '机会'] },
  { pattern: /产品|开发|IPD|BOM|PPAP|样件|模具|研发/i, domain: 'product', subDomain: 'ipd', hints: ['产品', '开发', 'BOM', 'PPAP', '样件', '模具'] },
  { pattern: /供应商|采购|定价|寻源|物料/i, domain: 'procurement', subDomain: 'supplier', hints: ['供应商', '采购', '定价', '寻源'] },
  { pattern: /订单|交付|生产|仓储|物流|SOP|发货|对账/i, domain: 'delivery', subDomain: 'otd', hints: ['订单', '交付', '生产', '仓储', '物流', '发货'] },
  { pattern: /ITR|问题|售后|服务|客诉/i, domain: 'service', subDomain: 'itr', hints: ['ITR', '问题', '售后', '服务', '客诉'] },
  { pattern: /招聘|培训|绩效|薪酬|人事|组织|员工|HR|人力/i, domain: 'hr', subDomain: 'people', hints: ['招聘', '培训', '绩效', '薪酬', '人事', '组织'] },
  { pattern: /预算|成本|费用|报销|财务|资产|核算|薪资/i, domain: 'finance', subDomain: 'finance', hints: ['预算', '成本', '费用', '报销', '财务', '资产'] },
  { pattern: /数字化|系统|代码|数据|IT|上线|测试|需求/i, domain: 'digital', subDomain: 'it', hints: ['数字化', '系统', '代码', '数据', '上线', '测试'] },
  { pattern: /法务|审计|EHS|投资|蓝军|合规/i, domain: 'governance', subDomain: 'governance', hints: ['法务', '审计', 'EHS', '投资', '合规'] },
  { pattern: /战略|经营|计划|复盘|绩效/i, domain: 'strategy', subDomain: 'planning', hints: ['战略', '经营', '计划', '复盘', '绩效'] },
];

export function getBindableProcessNodes(nodes: ProcessArchitectureNodeLike[]): ProcessArchitectureAssetNode[] {
  return nodes
    .filter((node) => Number(node.level ?? 1) >= 3)
    .map((node) => ({
      ...node,
      id: node.id,
      name: node.name,
      level: Number(node.level ?? 1),
      sortOrder: Number(node.sortOrder ?? 0),
    }))
    .sort((a, b) => a.level - b.level || a.sortOrder - b.sortOrder || a.id - b.id);
}

export function pickProcessNodeForText(
  nodes: ProcessArchitectureAssetNode[],
  text: string,
  fallbackIndex = 0,
): ProcessArchitectureAssetNode {
  if (nodes.length === 0) {
    throw new Error('No bindable process architecture nodes available');
  }

  const normalized = text.toLowerCase();
  let best = nodes[Math.abs(fallbackIndex) % nodes.length];
  let bestScore = -1;

  for (const node of nodes) {
    const nodeText = `${node.code || ''} ${node.name}`.toLowerCase();
    let score = 0;
    for (const group of keywordGroups) {
      if (group.pattern.test(normalized)) {
        score += group.hints.filter((hint) => nodeText.includes(hint.toLowerCase())).length * 8;
        if (group.pattern.test(nodeText)) score += 5;
      }
    }
    for (const term of tokenizeBusinessText(normalized)) {
      if (nodeText.includes(term)) score += term.length;
    }
    if (score > bestScore) {
      best = node;
      bestScore = score;
    }
  }

  return bestScore > 0 ? best : nodes[Math.abs(hashToNumber(text) + fallbackIndex) % nodes.length];
}

export function buildDemoAgentSeeds(nodes: ProcessArchitectureAssetNode[], count = 30): DemoAgentSeed[] {
  return nodes.slice(0, count).map((node, index) => ({
    name: `${DEMO_AGENT_PREFIX}${node.name}助手`,
    description: `面向「${node.name}」的流程协同 Agent，辅助完成资料检查、节点推进、风险提醒和复盘输出。`,
    systemPrompt: [
      `你是「${node.name}」流程 Agent。`,
      '围绕该流程节点识别输入、输出、角色、风险、指标和待办。',
      '回答时优先使用绑定知识库和流程架构上下文，输出简洁的行动建议。',
    ].join('\n'),
    model: 'qwen-plus',
    processArchitectureNodeIds: [node.id],
    node,
  }));
}

export function buildDemoSkillSeeds(nodes: ProcessArchitectureAssetNode[], count = 60): DemoSkillSeed[] {
  return Array.from({ length: Math.min(count, nodes.length) }, (_, index) => {
    const node = nodes[index];
    const template = capabilityTemplates[index % capabilityTemplates.length];
    const classification = classifyNode(node);
    const namespace = `${DEMO_SKILL_NAMESPACE_PREFIX}node${node.id}.${slugify(template.ability)}`;
    return {
      namespace,
      name: `${node.name}${template.suffix}`,
      domain: classification.domain,
      subDomain: classification.subDomain,
      abilityName: template.ability,
      description: `针对「${node.name}」${template.verb}，沉淀为可被 Agent 调用的轻量业务 Skill。`,
      content: [
        `# ${node.name}${template.suffix}`,
        '',
        `## 适用流程`,
        `${node.code ? `${node.code} ` : ''}${node.name}`,
        '',
        '## 执行要点',
        `1. 明确当前流程节点的输入、输出、责任人和完成标准。`,
        `2. ${template.verb}，并标注证据来源。`,
        '3. 输出结构化结论、风险等级、下一步动作和需要人工确认的事项。',
      ].join('\n'),
      triggerRules: JSON.stringify([
        { type: 'keyword', value: node.name },
        { type: 'keyword', value: template.ability },
      ]),
      toolDefinition: JSON.stringify({
        type: 'function',
        function: {
          name: namespace.replace(/\./g, '_'),
          description: `执行${node.name}${template.suffix}`,
          parameters: {
            type: 'object',
            properties: {
              context: { type: 'string', description: '流程背景、业务数据或待处理问题' },
            },
            required: ['context'],
          },
        },
      }),
      processArchitectureNodeIds: [node.id],
      node,
    };
  });
}

export function buildDemoKnowledgeBaseSeeds(nodes: ProcessArchitectureAssetNode[], count = 60): DemoKnowledgeBaseSeed[] {
  return Array.from({ length: Math.min(count, nodes.length) }, (_, index) => {
    const node = nodes[index];
    const documentName = `${node.name}流程说明.md`;
    const content = buildKnowledgeContent(node, index);
    return {
      name: `${DEMO_KNOWLEDGE_PREFIX}${node.name}`,
      description: `覆盖「${node.name}」的制度、SOP、FAQ 和关键检查项。`,
      processArchitectureNodeIds: [node.id],
      document: { name: documentName, content },
      node,
    };
  });
}

export function buildArchitectureBindingDocument(
  knowledgeBaseName: string,
  node: ProcessArchitectureAssetNode,
): DemoKnowledgeBaseSeed['document'] {
  return {
    name: ARCHITECTURE_BINDING_DOC_NAME,
    content: [
      `# ${knowledgeBaseName}流程架构绑定说明`,
      '',
      `该知识库已归类到「${node.code ? `${node.code} ` : ''}${node.name}」。`,
      '后续上传的制度、SOP、模板和问答资料可继续绑定到同一流程节点或其下级节点。',
    ].join('\n'),
  };
}

export function createDeterministicEmbedding(text: string, dimensions = 384): number[] {
  const vector = new Array(dimensions).fill(0);
  const tokens = tokenizeBusinessText(text).length ? tokenizeBusinessText(text) : Array.from(text);
  for (const token of tokens) {
    const index = Math.abs(hashToNumber(token)) % dimensions;
    vector[index] += 1;
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return norm > 0 ? vector.map((value) => value / norm) : vector;
}

function buildKnowledgeContent(node: ProcessArchitectureAssetNode, index: number) {
  const template = capabilityTemplates[index % capabilityTemplates.length];
  return [
    `# ${node.name}流程知识`,
    '',
    `## 流程定位`,
    `「${node.name}」是公司流程架构中的 L${node.level} 节点，用于承接业务活动、角色协同和结果交付。`,
    '',
    '## 关键资料',
    '- 流程说明：输入、输出、角色、触发条件和完成标准。',
    '- 操作清单：关键步骤、检查项、异常处理和审批依据。',
    '- 管控要求：周期、质量、成本、风险和合规要求。',
    '',
    '## AI 使用方式',
    `可调用「${node.name}${template.suffix}」能力，围绕资料完整性、流程风险和改进动作输出建议。`,
  ].join('\n');
}

function classifyNode(node: ProcessArchitectureAssetNode) {
  const text = `${node.code || ''} ${node.name}`;
  return keywordGroups.find((group) => group.pattern.test(text)) || {
    domain: 'process',
    subDomain: 'operation',
  };
}

function tokenizeBusinessText(text: string) {
  const tokens = new Set<string>();
  for (const match of text.matchAll(/[a-z0-9][a-z0-9_.-]{1,}/gi)) tokens.add(match[0].toLowerCase());
  for (const match of text.matchAll(/[\p{Script=Han}]{2,}/gu)) {
    const value = match[0];
    tokens.add(value);
    for (let i = 0; i < value.length - 1; i += 1) tokens.add(value.slice(i, i + 2));
  }
  return Array.from(tokens);
}

function slugify(value: string) {
  const digest = createHash('sha1').update(value).digest('hex').slice(0, 8);
  return `ability${digest}`;
}

function hashToNumber(value: string) {
  const digest = createHash('sha1').update(value).digest('hex').slice(0, 8);
  return Number.parseInt(digest, 16);
}
