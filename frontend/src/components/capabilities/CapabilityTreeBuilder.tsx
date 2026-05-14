import React, { useEffect, useMemo } from 'react';
import { Alert, Card, Col, Empty, Row, Space, Tag, Tree, Typography } from 'antd';
import type { DataNode } from 'antd/es/tree';
import {
  ApartmentOutlined,
  BranchesOutlined,
  CheckCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { DomainLabels, SkillDomain } from '../../types';

const { Text } = Typography;

export interface CapabilitySkillOption {
  id: string;
  name: string;
  description: string;
  domain?: string;
  subDomain?: string;
  abilityName?: string;
  skillId?: number;
}

export interface CapabilityNodeSnapshot {
  id: number;
  parentId: number | null;
  nodeType: 'domain' | 'stage' | 'skill';
  label: string;
  domain?: string | null;
  subDomain?: string | null;
  skillId?: number | null;
  namespace?: string | null;
  orderIndex: number;
  loopPolicy?: unknown;
  conditionExpression?: string | null;
  children: CapabilityNodeSnapshot[];
}

interface CapabilityTreeBuilderProps {
  skills: CapabilitySkillOption[];
  selectedSkillIds: string[];
  onSkillsChange: (ids: string[]) => void;
  onSnapshotChange: (snapshot: CapabilityNodeSnapshot[]) => void;
}

function domainLabel(domain?: string) {
  return domain ? (DomainLabels[domain as SkillDomain] || domain) : '未分组';
}

function buildSnapshot(skills: CapabilitySkillOption[], selectedSkillIds: string[]): CapabilityNodeSnapshot[] {
  let nextId = 1;
  const selected = skills.filter((skill) => selectedSkillIds.includes(skill.id));
  const domains = new Map<string, CapabilityNodeSnapshot>();
  const stages = new Map<string, CapabilityNodeSnapshot>();

  for (const skill of selected) {
    const domainKey = skill.domain || 'other';
    let domainNode = domains.get(domainKey);
    if (!domainNode) {
      domainNode = {
        id: nextId++,
        parentId: null,
        nodeType: 'domain',
        label: domainLabel(domainKey),
        domain: domainKey,
        subDomain: null,
        skillId: null,
        namespace: null,
        orderIndex: domains.size,
        children: [],
      };
      domains.set(domainKey, domainNode);
    }

    const subDomainKey = `${domainKey}/${skill.subDomain || 'general'}`;
    let stageNode = stages.get(subDomainKey);
    if (!stageNode) {
      stageNode = {
        id: nextId++,
        parentId: domainNode.id,
        nodeType: 'stage',
        label: skill.subDomain || '通用能力',
        domain: domainKey,
        subDomain: skill.subDomain || 'general',
        skillId: null,
        namespace: null,
        orderIndex: domainNode.children.length,
        loopPolicy: { mode: 'sequential', maxIterations: 1 },
        children: [],
      };
      stages.set(subDomainKey, stageNode);
      domainNode.children.push(stageNode);
    }

    stageNode.children.push({
      id: nextId++,
      parentId: stageNode.id,
      nodeType: 'skill',
      label: skill.name,
      domain: domainKey,
      subDomain: skill.subDomain || 'general',
      skillId: skill.skillId || null,
      namespace: skill.id,
      orderIndex: stageNode.children.length,
      children: [],
    });
  }

  return Array.from(domains.values());
}

const CapabilityTreeBuilder: React.FC<CapabilityTreeBuilderProps> = ({
  skills,
  selectedSkillIds,
  onSkillsChange,
  onSnapshotChange,
}) => {
  const treeData = useMemo<DataNode[]>(() => {
    const domains = new Map<string, DataNode & { children: DataNode[] }>();
    const stages = new Map<string, DataNode & { children: DataNode[] }>();

    for (const skill of skills) {
      const domainKey = skill.domain || 'other';
      let domainNode = domains.get(domainKey);
      if (!domainNode) {
        domainNode = {
          key: `domain:${domainKey}`,
          title: (
            <Space size={6}>
              <ApartmentOutlined />
              <Text strong>{domainLabel(domainKey)}</Text>
            </Space>
          ),
          disableCheckbox: true,
          children: [],
        };
        domains.set(domainKey, domainNode);
      }

      const subDomain = skill.subDomain || 'general';
      const stageKey = `stage:${domainKey}:${subDomain}`;
      let stageNode = stages.get(stageKey);
      if (!stageNode) {
        stageNode = {
          key: stageKey,
          title: (
            <Space size={6}>
              <BranchesOutlined />
              <span>{subDomain}</span>
            </Space>
          ),
          disableCheckbox: true,
          children: [],
        };
        stages.set(stageKey, stageNode);
        domainNode.children.push(stageNode);
      }

      stageNode.children.push({
        key: skill.id,
        title: (
          <Space direction="vertical" size={0} style={{ lineHeight: 1.35 }}>
            <Space size={6} wrap>
              <ThunderboltOutlined style={{ color: '#2563eb' }} />
              <Text>{skill.name}</Text>
              {skill.abilityName && <Tag>{skill.abilityName}</Tag>}
            </Space>
            {skill.description && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {skill.description}
              </Text>
            )}
          </Space>
        ),
      });
    }

    return Array.from(domains.values());
  }, [skills]);

  const snapshot = useMemo(
    () => buildSnapshot(skills, selectedSkillIds),
    [skills, selectedSkillIds],
  );

  useEffect(() => {
    onSnapshotChange(snapshot);
  }, [onSnapshotChange, snapshot]);

  const selectedSkills = skills.filter((skill) => selectedSkillIds.includes(skill.id));

  return (
    <div>
      <Alert
        type="info"
        showIcon
        message="能力树会按业务域、子域和 SKU 叶子节点组织 Agent 能力。运行时优先读取叶子节点 namespace。"
        style={{ borderRadius: 10, marginBottom: 14 }}
      />
      <Row gutter={14}>
        <Col xs={24} lg={14}>
          <Card
            title={<Space><BranchesOutlined />能力树</Space>}
            size="small"
            style={{ border: '1px solid #e5e7eb', boxShadow: 'none' }}
          >
            {treeData.length > 0 ? (
              <Tree
                checkable
                selectable={false}
                defaultExpandAll
                checkedKeys={selectedSkillIds}
                onCheck={(keys) => {
                  const nextKeys = Array.isArray(keys) ? keys : keys.checked;
                  onSkillsChange(nextKeys.map(String).filter((key) => !key.includes(':')));
                }}
                treeData={treeData}
                style={{ maxHeight: 360, overflow: 'auto' }}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无可装配 SKU" />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card
            title={<Space><CheckCircleOutlined />已装配</Space>}
            size="small"
            style={{ border: '1px solid #e5e7eb', boxShadow: 'none' }}
          >
            {selectedSkills.length > 0 ? (
              <Space direction="vertical" size={10} style={{ width: '100%' }}>
                <Text type="secondary">当前 Agent 将读取 {selectedSkills.length} 个 SKU 叶子能力。</Text>
                {snapshot.map((domain) => (
                  <div key={domain.id} style={{ padding: 10, borderRadius: 10, background: '#f8fafc' }}>
                    <Text strong>{domain.label}</Text>
                    <Space direction="vertical" size={4} style={{ width: '100%', marginTop: 8 }}>
                      {domain.children.flatMap((stage) => stage.children).map((skill) => (
                        <div key={skill.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                          <Text ellipsis style={{ maxWidth: 190 }}>{skill.label}</Text>
                          <Tag color="blue">{skill.namespace}</Tag>
                        </div>
                      ))}
                    </Space>
                  </div>
                ))}
              </Space>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="先在左侧选择 SKU" />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default CapabilityTreeBuilder;
