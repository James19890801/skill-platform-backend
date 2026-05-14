import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Segmented,
  Select,
  Space,
  Spin,
  Statistic,
  Tag,
  Tooltip,
  Tree,
  Typography,
  message,
} from 'antd';
import {
  ApartmentOutlined,
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  PlusOutlined,
  ReloadOutlined,
  RobotOutlined,
  SearchOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import {
  ProcessArchitectureCoverageDTO,
  ProcessArchitectureNodeDTO,
  ProcessArchitectureNodeSnapshot,
  processArchitectureApi,
} from '../../services/api';

const { Paragraph, Text, Title } = Typography;

type AbilityFilter = 'all' | 'agents' | 'skills' | 'knowledge';

interface FlatNode extends ProcessArchitectureNodeDTO {
  titlePath: string;
}

function flattenSnapshot(nodes: ProcessArchitectureNodeSnapshot[], parentPath = ''): FlatNode[] {
  return nodes.flatMap((node) => {
    const title = [node.code, node.name].filter(Boolean).join(' · ');
    const titlePath = parentPath ? `${parentPath} / ${title}` : title;
    return [
      { ...node, treeId: 0, titlePath },
      ...flattenSnapshot(node.children || [], titlePath),
    ];
  });
}

function getNodeTitle(node?: ProcessArchitectureNodeDTO | null) {
  if (!node) return '全部流程架构';
  return [node.code, node.name].filter(Boolean).join(' · ');
}

const ProcessArchitectureView: React.FC = () => {
  const navigate = useNavigate();
  const [coverage, setCoverage] = useState<ProcessArchitectureCoverageDTO | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingNode, setSavingNode] = useState(false);
  const [nodeModalOpen, setNodeModalOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<ProcessArchitectureNodeDTO | null>(null);
  const [searchText, setSearchText] = useState('');
  const [abilityFilter, setAbilityFilter] = useState<AbilityFilter>('all');
  const [nodeForm] = Form.useForm();

  const loadCoverage = async (nodeId = selectedNodeId) => {
    setLoading(true);
    try {
      const data = await processArchitectureApi.getCoverage({ nodeId });
      setCoverage(data);
    } catch (error: any) {
      message.error(error?.response?.data?.message || '流程架构加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCoverage(null);
  }, []);

  const nodeCoverageById = useMemo(() => {
    const map = new Map<number, { agentCount: number; skillCount: number; knowledgeDocumentCount: number }>();
    (coverage?.nodeCoverage || []).forEach((item) => {
      map.set(item.nodeId, {
        agentCount: item.agentCount,
        skillCount: item.skillCount,
        knowledgeDocumentCount: item.knowledgeDocumentCount,
      });
    });
    return map;
  }, [coverage?.nodeCoverage]);

  const flatNodes = useMemo(() => flattenSnapshot(coverage?.snapshot || []), [coverage?.snapshot]);

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return coverage?.nodes.find((node) => node.id === selectedNodeId) || null;
  }, [coverage?.nodes, selectedNodeId]);

  const treeData = useMemo(() => {
    const convert = (nodes: ProcessArchitectureNodeSnapshot[]): any[] =>
      nodes.map((node) => {
        const stats = nodeCoverageById.get(node.id);
        const title = (
          <div className="process-tree-title">
            <div>
              <Text strong>{node.name}</Text>
              {node.code && <Text type="secondary"> {node.code}</Text>}
            </div>
            <Space size={4}>
              <Tag color="blue">{stats?.agentCount || 0} A</Tag>
              <Tag color="green">{stats?.skillCount || 0} S</Tag>
              <Tag color="purple">{stats?.knowledgeDocumentCount || 0} K</Tag>
            </Space>
          </div>
        );
        return {
          key: String(node.id),
          title,
          children: convert(node.children || []),
        };
      });
    return convert(coverage?.snapshot || []);
  }, [coverage?.snapshot, nodeCoverageById]);

  const filteredAgents = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return (coverage?.agents || []).filter((agent) => {
      if (abilityFilter === 'skills') return false;
      if (!q) return true;
      return agent.name.toLowerCase().includes(q) || (agent.description || '').toLowerCase().includes(q);
    });
  }, [abilityFilter, coverage?.agents, searchText]);

  const filteredSkills = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return (coverage?.skills || []).filter((skill) => {
      if (abilityFilter === 'agents') return false;
      if (!q) return true;
      return (
        skill.name.toLowerCase().includes(q) ||
        (skill.description || '').toLowerCase().includes(q) ||
        (skill.namespace || '').toLowerCase().includes(q)
      );
    });
  }, [abilityFilter, coverage?.skills, searchText]);

  const filteredKnowledgeDocuments = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return (coverage?.knowledgeDocuments || []).filter((document) => {
      if (abilityFilter === 'agents' || abilityFilter === 'skills') return false;
      if (!q) return true;
      return document.name.toLowerCase().includes(q);
    });
  }, [abilityFilter, coverage?.knowledgeDocuments, searchText]);

  const openAddNode = () => {
    const parent = selectedNode;
    setEditingNode(null);
    nodeForm.setFieldsValue({
      parentId: parent?.id,
      level: parent ? parent.level + 1 : 1,
      sortOrder: 0,
    });
    setNodeModalOpen(true);
  };

  const openEditNode = () => {
    if (!selectedNode) return;
    setEditingNode(selectedNode);
    nodeForm.setFieldsValue({
      code: selectedNode.code,
      name: selectedNode.name,
      parentId: selectedNode.parentId,
      level: selectedNode.level,
      sortOrder: selectedNode.sortOrder,
      description: selectedNode.description,
    });
    setNodeModalOpen(true);
  };

  const saveNode = async () => {
    if (!coverage?.tree.id) return;
    try {
      const values = await nodeForm.validateFields();
      setSavingNode(true);
      if (editingNode) {
        await processArchitectureApi.updateNode(coverage.tree.id, editingNode.id, values);
        message.success('节点已更新');
      } else {
        await processArchitectureApi.createNode(coverage.tree.id, values);
        message.success('节点已新增');
      }
      setNodeModalOpen(false);
      nodeForm.resetFields();
      await loadCoverage(selectedNodeId);
    } catch (error: any) {
      if (!error?.errorFields) {
        message.error(error?.response?.data?.message || '保存失败，请确认已登录');
      }
    } finally {
      setSavingNode(false);
    }
  };

  const deleteSelectedNode = async () => {
    if (!coverage?.tree.id || !selectedNodeId) return;
    try {
      await processArchitectureApi.deleteNode(coverage.tree.id, selectedNodeId);
      message.success('节点已删除');
      setSelectedNodeId(null);
      await loadCoverage(null);
    } catch (error: any) {
      message.error(error?.response?.data?.message || '删除失败，请确认已登录');
    }
  };

  const selectNode = (keys: React.Key[]) => {
    const next = keys[0] ? Number(keys[0]) : null;
    setSelectedNodeId(next);
    loadCoverage(next);
  };

  const renderAgentCard = (agent: ProcessArchitectureCoverageDTO['agents'][number]) => (
    <Tooltip key={agent.id} title={agent.description || '暂无描述'} placement="top">
      <div className="process-ability-card" onClick={() => navigate(`/agents/edit/${agent.id}`)} role="button" tabIndex={0}>
        <div className="process-ability-icon agent"><RobotOutlined /></div>
        <div className="process-ability-body">
          <strong>{agent.name}</strong>
          <span>{agent.model || '未配置模型'}</span>
          <Paragraph ellipsis={{ rows: 2 }}>{agent.description || '暂无描述'}</Paragraph>
        </div>
      </div>
    </Tooltip>
  );

  const renderSkillCard = (skill: ProcessArchitectureCoverageDTO['skills'][number]) => (
    <Tooltip key={skill.id} title={skill.description || '暂无描述'} placement="top">
      <div className="process-ability-card" onClick={() => navigate(`/skills/${skill.id}`)} role="button" tabIndex={0}>
        <div className="process-ability-icon skill"><ThunderboltOutlined /></div>
        <div className="process-ability-body">
          <strong>{skill.name}</strong>
          <span>{skill.namespace || skill.abilityName || 'Skill'}</span>
          <Paragraph ellipsis={{ rows: 2 }}>{skill.description || '暂无描述'}</Paragraph>
        </div>
      </div>
    </Tooltip>
  );

  const renderKnowledgeDocumentCard = (document: ProcessArchitectureCoverageDTO['knowledgeDocuments'][number]) => (
    <Tooltip key={document.id} title={document.name} placement="top">
      <div className="process-ability-card" onClick={() => navigate('/knowledge')} role="button" tabIndex={0}>
        <div className="process-ability-icon knowledge"><FileTextOutlined /></div>
        <div className="process-ability-body">
          <strong>{document.name}</strong>
          <span>{document.status === 'indexed' ? `${document.chunkCount || 0} 个切片` : document.status || '未索引'}</span>
          <Paragraph ellipsis={{ rows: 2 }}>已绑定到流程架构，可作为该节点问答知识来源。</Paragraph>
        </div>
      </div>
    </Tooltip>
  );

  if (loading && !coverage) {
    return (
      <div className="process-architecture-loading">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="process-architecture-shell">
      <section className="process-architecture-header">
        <div>
          <div className="section-kicker">Process Architecture</div>
          <Title level={3}>流程架构</Title>
          <Text type="secondary">{coverage?.tree.name || '本地流程架构'} · {getNodeTitle(selectedNode)}</Text>
        </div>
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={() => loadCoverage(selectedNodeId)} />
          <Button icon={<PlusOutlined />} type="primary" onClick={openAddNode}>新增节点</Button>
        </Space>
      </section>

      <Row gutter={[16, 16]} className="process-stats">
        <Col xs={12} md={6}>
          <Card size="small"><Statistic title="架构节点" value={coverage?.nodes.length || 0} prefix={<ApartmentOutlined />} /></Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small"><Statistic title="Agent" value={coverage?.agentCount || 0} prefix={<RobotOutlined />} /></Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small"><Statistic title="Skill" value={coverage?.skillCount || 0} prefix={<ThunderboltOutlined />} /></Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small"><Statistic title="知识文档" value={coverage?.knowledgeDocumentCount || 0} prefix={<FileTextOutlined />} /></Card>
        </Col>
      </Row>

      <div className="process-architecture-grid">
        <Card className="process-tree-panel" title="架构导航">
          <Space style={{ marginBottom: 12 }} wrap>
            <Button
              type={selectedNodeId ? 'default' : 'primary'}
              onClick={() => {
                setSelectedNodeId(null);
                loadCoverage(null);
              }}
            >
              全部架构
            </Button>
            <Button icon={<EditOutlined />} disabled={!selectedNode} onClick={openEditNode} />
            <Popconfirm
              title="删除该节点及其子节点？"
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
              disabled={!selectedNode}
              onConfirm={deleteSelectedNode}
            >
              <Button icon={<DeleteOutlined />} danger disabled={!selectedNode} />
            </Popconfirm>
          </Space>
          {treeData.length ? (
            <Tree
              key={`${coverage?.tree.id}-${coverage?.nodes.length}`}
              selectedKeys={selectedNodeId ? [String(selectedNodeId)] : []}
              onSelect={selectNode}
              treeData={treeData}
              defaultExpandAll
            />
          ) : (
            <Empty description="暂无流程节点" />
          )}
        </Card>

        <Card className="process-ability-panel">
          <div className="process-ability-toolbar">
            <div>
              <div className="section-kicker">AI Capability Coverage</div>
              <h2>{getNodeTitle(selectedNode)}</h2>
              <Text type="secondary">当前筛选 {filteredAgents.length} 个 Agent，{filteredSkills.length} 个 Skill，{filteredKnowledgeDocuments.length} 份知识文档</Text>
            </div>
            <Space wrap>
              <Input
                prefix={<SearchOutlined />}
                placeholder="搜索 Agent 或 Skill"
                allowClear
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
              />
              <Segmented
                value={abilityFilter}
                onChange={(value) => setAbilityFilter(value as AbilityFilter)}
                options={[
                  { label: '全部', value: 'all' },
                  { label: 'Agent', value: 'agents' },
                  { label: 'Skill', value: 'skills' },
                  { label: '知识', value: 'knowledge' },
                ]}
              />
            </Space>
          </div>

          <div className="process-ability-columns">
            {abilityFilter !== 'skills' && (
              <section>
                <div className="process-column-title"><RobotOutlined /> Agents</div>
                {filteredAgents.length ? filteredAgents.map(renderAgentCard) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无 Agent" />}
              </section>
            )}
            {abilityFilter !== 'agents' && abilityFilter !== 'knowledge' && (
              <section>
                <div className="process-column-title"><ThunderboltOutlined /> Skills</div>
                {filteredSkills.length ? filteredSkills.map(renderSkillCard) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无 Skill" />}
              </section>
            )}
            {abilityFilter !== 'agents' && abilityFilter !== 'skills' && (
              <section>
                <div className="process-column-title"><FileTextOutlined /> 知识文档</div>
                {filteredKnowledgeDocuments.length ? filteredKnowledgeDocuments.map(renderKnowledgeDocumentCard) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无知识文档" />}
              </section>
            )}
          </div>
        </Card>
      </div>

      <Modal
        title={editingNode ? '编辑流程节点' : '新增流程节点'}
        open={nodeModalOpen}
        onCancel={() => setNodeModalOpen(false)}
        onOk={saveNode}
        confirmLoading={savingNode}
        okText="保存"
        cancelText="取消"
      >
        <Form form={nodeForm} layout="vertical">
          <Form.Item name="name" label="节点名称" rules={[{ required: true, message: '请输入节点名称' }]}>
            <Input placeholder="例如：线索获取" />
          </Form.Item>
          <Form.Item name="code" label="节点编码">
            <Input placeholder="例如：L3-01" />
          </Form.Item>
          <Form.Item name="parentId" label="上级节点">
            <Select allowClear placeholder="作为根节点">
              {flatNodes
                .filter((node) => node.id !== editingNode?.id)
                .map((node) => (
                  <Select.Option key={node.id} value={node.id}>{node.titlePath}</Select.Option>
                ))}
            </Select>
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="level" label="层级">
                <InputNumber min={1} max={8} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="sortOrder" label="排序">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ProcessArchitectureView;
