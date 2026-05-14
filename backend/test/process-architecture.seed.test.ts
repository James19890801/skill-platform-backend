import { strict as assert } from 'assert';
import test from 'node:test';
import {
  defaultProcessArchitectureNodes,
  defaultProcessArchitectureTree,
} from '../src/process-architectures/default-process-architecture';
import {
  buildDemoAgentSeeds,
  buildDemoKnowledgeBaseSeeds,
  buildDemoSkillSeeds,
  getBindableProcessNodes,
  pickProcessNodeForText,
} from '../src/process-architectures/process-architecture-assets';
import { buildProcessArchitectureSnapshot } from '../src/process-architectures/process-architecture.logic';

test('default process architecture preset contains the imported company hierarchy', () => {
  assert.equal(defaultProcessArchitectureTree.name, '真实流程架构');
  assert.equal(defaultProcessArchitectureNodes.length, 311);

  const levelCounts = defaultProcessArchitectureNodes.reduce<Record<number, number>>((counts, node) => {
    counts[node.level] = (counts[node.level] || 0) + 1;
    return counts;
  }, {});

  assert.deepEqual(levelCounts, {
    1: 11,
    2: 28,
    3: 152,
    4: 103,
    5: 17,
  });

  const snapshot = buildProcessArchitectureSnapshot(defaultProcessArchitectureNodes);
  assert.equal(snapshot.length, 11);
  assert.equal(snapshot[0].name, 'DSTE战略规划到执行');
  assert.ok(snapshot.some((node) => node.name === 'LTC线索到回款'));
});

test('process architecture demo assets are generated only for L3 and below', () => {
  const bindableNodes = getBindableProcessNodes(defaultProcessArchitectureNodes);
  const agents = buildDemoAgentSeeds(bindableNodes);
  const skills = buildDemoSkillSeeds(bindableNodes);
  const knowledgeBases = buildDemoKnowledgeBaseSeeds(bindableNodes);

  assert.equal(agents.length, 30);
  assert.equal(skills.length, 60);
  assert.equal(knowledgeBases.length, 60);
  assert.ok(bindableNodes.every((node) => node.level >= 3));
  assert.ok([...agents, ...skills, ...knowledgeBases].every((item) => item.processArchitectureNodeIds.every((id) => {
    const node = bindableNodes.find((candidate) => candidate.id === id);
    return Boolean(node && node.level >= 3);
  })));

  assert.match(skills[0].namespace, /^process\.demo\./);
  assert.ok(knowledgeBases[0].document.content.includes(knowledgeBases[0].node.name));
});

test('existing assets can be matched onto an L3 process node by business text', () => {
  const bindableNodes = getBindableProcessNodes(defaultProcessArchitectureNodes);

  assert.match(pickProcessNodeForText(bindableNodes, '合同风控和回款跟进').name, /合同|回款|LTC|线索|客户/);
  assert.match(pickProcessNodeForText(bindableNodes, '招聘培训和绩效管理').name, /招聘|培训|绩效|组织|人力/);
  assert.match(pickProcessNodeForText(bindableNodes, '预算成本费用报销').name, /预算|成本|费用|财务/);
});
