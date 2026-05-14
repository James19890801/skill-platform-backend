import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildProcessArchitectureSnapshot,
  collectDescendantNodeIds,
  parseProcessArchitectureBinding,
  summarizeProcessArchitectureCoverage,
} from '../src/process-architectures/process-architecture.logic';

const nodes = [
  { id: 1, parentId: null, code: 'L1', name: '公司流程架构', level: 1, sortOrder: 0 },
  { id: 2, parentId: 1, code: 'L2-01', name: '营销到线索', level: 2, sortOrder: 0 },
  { id: 3, parentId: 2, code: 'L3-01', name: '线索获取', level: 3, sortOrder: 0 },
  { id: 4, parentId: 2, code: 'L3-02', name: '线索培育', level: 3, sortOrder: 1 },
  { id: 5, parentId: 1, code: 'L2-02', name: '订单到交付', level: 2, sortOrder: 1 },
];

test('buildProcessArchitectureSnapshot keeps process hierarchy sorted by level and order', () => {
  const snapshot = buildProcessArchitectureSnapshot(nodes);

  assert.equal(snapshot.length, 1);
  assert.equal(snapshot[0].name, '公司流程架构');
  assert.deepEqual(snapshot[0].children.map((node) => node.name), ['营销到线索', '订单到交付']);
  assert.deepEqual(snapshot[0].children[0].children.map((node) => node.code), ['L3-01', 'L3-02']);
});

test('collectDescendantNodeIds includes the selected parent and every child level below it', () => {
  assert.deepEqual(collectDescendantNodeIds(nodes, 2), [2, 3, 4]);
  assert.deepEqual(collectDescendantNodeIds(nodes, 1), [1, 2, 3, 4, 5]);
});

test('parseProcessArchitectureBinding accepts JSON, arrays, numbers, and comma strings', () => {
  assert.deepEqual(parseProcessArchitectureBinding('[2, "3", "bad"]'), [2, 3]);
  assert.deepEqual(parseProcessArchitectureBinding(['4', 5]), [4, 5]);
  assert.deepEqual(parseProcessArchitectureBinding('6, 7'), [6, 7]);
  assert.deepEqual(parseProcessArchitectureBinding(8), [8]);
});

test('summarizeProcessArchitectureCoverage rolls child bindings up to the selected parent', () => {
  const summary = summarizeProcessArchitectureCoverage({
    nodes,
    selectedNodeId: 2,
    agents: [
      { id: 10, name: '线索分析 Agent', description: '识别线索质量', processArchitectureNodeIds: '[3]' },
      { id: 11, name: '培育 Agent', description: '推进客户培育', processArchitectureNodeIds: [4] },
      { id: 12, name: '交付 Agent', description: '交付执行', processArchitectureNodeIds: [5] },
    ],
    skills: [
      { id: 20, name: '线索快筛', namespace: 'lead.qualify', description: '线索评分', processArchitectureNodeIds: [3] },
      { id: 21, name: '交付复盘', namespace: 'delivery.review', description: '交付总结', processArchitectureNodeIds: [5] },
    ],
    knowledgeDocuments: [
      { id: 30, name: '线索获取流程.docx', processArchitectureNodeIds: [3] },
      { id: 31, name: '订单交付流程.docx', processArchitectureNodeIds: [5] },
    ],
  });

  assert.deepEqual(summary.selectedNodeIds, [2, 3, 4]);
  assert.deepEqual(summary.agents.map((agent) => agent.name), ['线索分析 Agent', '培育 Agent']);
  assert.deepEqual(summary.skills.map((skill) => skill.namespace), ['lead.qualify']);
  assert.deepEqual(summary.knowledgeDocuments.map((document) => document.name), ['线索获取流程.docx']);
  assert.equal(summary.agentCount, 2);
  assert.equal(summary.skillCount, 1);
  assert.equal(summary.knowledgeDocumentCount, 1);
});
