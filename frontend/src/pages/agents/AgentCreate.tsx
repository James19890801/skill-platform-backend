/**
 * AgentCreate - 创建 Agent 页面
 * 配置 Agent 的模型、Skills、知识库、记忆等
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Card,
  Form,
  Input,
  Select,
  Switch,
  Button,
  Typography,
  Space,
  Divider,
  message,
  Steps,
  Row,
  Col,
  Tag,
  Checkbox,
  Empty,
  Upload,
  Avatar,
  Alert,
  Modal,
  Tooltip,
  Tabs,
} from 'antd';
import { useAuthStore } from '../../stores/useAuthStore';
import {
  RobotOutlined,
  SaveOutlined,
  PlayCircleOutlined,
  FolderOutlined,
  UploadOutlined,
  ApiOutlined,
  CodeOutlined,
  DeleteOutlined,
  LinkOutlined,
  ShoppingOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { SkillDomain, DomainLabels } from '../../types';
import { LlmModel, McpServerConfig, llmApi, knowledgeApi, mcpApi } from '../../services/api';
import CapabilityTreeBuilder, {
  CapabilityNodeSnapshot,
  CapabilitySkillOption,
} from '../../components/capabilities/CapabilityTreeBuilder';
import ProcessArchitectureSelector from '../../components/process-architecture/ProcessArchitectureSelector';
import {
  AGENT_ICON_LIBRARY,
  DEFAULT_AGENT_ICON,
  getAgentAvatarSrc,
  getAgentAvatarStyle,
  renderAgentAvatarContent,
} from '../../utils/agentAvatars';

const { Title, Text } = Typography;

interface AgentCreateProps {
  editId?: number;
  initialData?: {
    id: number;
    name: string;
    description?: string;
    model: string;
    systemPrompt?: string;
    skills: string[];
    capabilityTreeId?: number | null;
    capabilityTreeSnapshot?: CapabilityNodeSnapshot[];
    processArchitectureNodeIds?: number[];
    knowledgeBases: string[];
    mcpServers?: McpServerConfig[];
    memoryEnabled: boolean;
    temperature: number;
    maxTokens?: number;
    status: string;
    avatar?: string;
  };
}

const AgentCreate: React.FC<AgentCreateProps> = ({ editId, initialData }) => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const selectedSkillIds = (Form.useWatch('skills', form) || []) as string[];
  const selectedMcpServers = (Form.useWatch('mcpServers', form) || []) as McpServerConfig[];
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [selectedSubDomain, setSelectedSubDomain] = useState<string | null>(null);
  const [availableSkills, setAvailableSkills] = useState<CapabilitySkillOption[]>([]);
  const [availableModels, setAvailableModels] = useState<LlmModel[]>([]);
  const [availableKnowledgeBases, setAvailableKnowledgeBases] = useState<Array<{ id: number; name: string; documentCount: number }>>([]);
  const [mcpMarketplace, setMcpMarketplace] = useState<McpServerConfig[]>([]);
  const [mcpJsonOpen, setMcpJsonOpen] = useState(false);
  const [mcpJson, setMcpJson] = useState('');
  const [mcpParsing, setMcpParsing] = useState(false);
  const [avatar, setAvatar] = useState<string>(DEFAULT_AGENT_ICON);

  // 从后端加载 Skills 列表
  useEffect(() => {
    const loadSkills = async () => {
      try {
        const apiBaseUrl = import.meta.env.VITE_API_URL || 'https://skill-platform-backend-production.up.railway.app/api';
        const res = await fetch(`${apiBaseUrl}/skills?limit=200`);
        const json = await res.json();
        if (json.success && json.data?.items) {
          setAvailableSkills(
            json.data.items.map((s: any) => ({
              id: s.namespace || `skill-${s.id}`,
              skillId: s.id,
              name: s.name,
              description: s.description || '',
              domain: s.domain,
              subDomain: s.subDomain,
              abilityName: s.abilityName,
            }))
          );
        }
      } catch (e) {
        // 加载失败时使用空列表
        console.warn('Failed to load skills:', e);
      }
    };
    loadSkills();
  }, []);

  useEffect(() => {
    llmApi.listModels()
      .then((data) => setAvailableModels(data.filter((model) => model.capability === 'chat')))
      .catch(() => setAvailableModels([
        { code: 'qwen-plus', model: 'qwen-plus', label: '通义千问 Plus', capability: 'chat', enabled: true },
      ]));

    knowledgeApi.list()
      .then((data) => setAvailableKnowledgeBases(data.map((kb) => ({
        id: kb.id,
        name: kb.name,
        documentCount: kb.documentCount || 0,
      }))))
      .catch(() => setAvailableKnowledgeBases([]));

    mcpApi.marketplace()
      .then((data) => setMcpMarketplace(data.items || []))
      .catch(() => setMcpMarketplace([]));
  }, []);

  // 编辑模式：回填已有数据
  useEffect(() => {
    if (editId && initialData) {
      form.setFieldsValue({
        name: initialData.name,
        description: initialData.description || '',
        model: initialData.model,
        systemPrompt: initialData.systemPrompt || '',
        skills: initialData.skills || [],
        capabilityTreeId: initialData.capabilityTreeId || null,
        capabilityTreeSnapshot: initialData.capabilityTreeSnapshot || [],
        processArchitectureNodeIds: initialData.processArchitectureNodeIds || [],
        knowledgeBases: initialData.knowledgeBases || [],
        mcpServers: initialData.mcpServers || [],
        memoryEnabled: initialData.memoryEnabled,
        temperature: initialData.temperature,
        maxTokens: initialData.maxTokens || 2048,
      });
      setAvatar((initialData as any).avatar || DEFAULT_AGENT_ICON);
    }
  }, [editId, initialData, form]);

  const readAvatarFile = (file: File): false => {
    const reader = new FileReader();
    reader.onload = () => {
      setAvatar(String(reader.result || DEFAULT_AGENT_ICON));
      message.success('头像已上传');
    };
    reader.onerror = () => message.error('头像读取失败');
    reader.readAsDataURL(file);
    return false;
  };

  const handleFinish = async (values: any) => {
    setLoading(true);
    try {
      const apiBaseUrl = import.meta.env.VITE_API_URL || 'https://skill-platform-backend-production.up.railway.app/api';
      const token = useAuthStore.getState().token;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const body = JSON.stringify({
        name: values.name,
        description: values.description,
        model: values.model,
        avatar,
        systemPrompt: values.systemPrompt,
        skills: form.getFieldValue('skills') || [],
        capabilityTreeId: form.getFieldValue('capabilityTreeId') || null,
        capabilityTreeSnapshot: form.getFieldValue('capabilityTreeSnapshot') || [],
        processArchitectureNodeIds: form.getFieldValue('processArchitectureNodeIds') || [],
        knowledgeBases: values.knowledgeBases || [],
        mcpServers: form.getFieldValue('mcpServers') || [],
        memoryEnabled: values.memoryEnabled,
        temperature: values.temperature,
        maxTokens: values.maxTokens,
      });

      const url = editId ? `${apiBaseUrl}/agents/${editId}` : `${apiBaseUrl}/agents`;
      const method = editId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers,
        body,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `${editId ? '保存' : '创建'}失败: ${res.status}`);
      }
      message.success(editId ? 'Agent 保存成功！' : 'Agent 创建成功！');
      navigate('/dashboard');
    } catch (error: any) {
      message.error(error.message || 'Agent 操作失败');
    } finally {
      setLoading(false);
    }
  };

  const setMcpServers = (servers: McpServerConfig[]) => {
    form.setFieldValue('mcpServers', servers);
  };

  const addMcpServer = (server: McpServerConfig) => {
    const current = (form.getFieldValue('mcpServers') || []) as McpServerConfig[];
    const exists = current.some((item) => (item.id || item.name) === (server.id || server.name));
    if (exists) {
      message.info('这个 MCP 已经添加过了');
      return;
    }
    setMcpServers([...current, { ...server, source: server.source || 'marketplace' }]);
  };

  const removeMcpServer = (server: McpServerConfig) => {
    const current = (form.getFieldValue('mcpServers') || []) as McpServerConfig[];
    setMcpServers(current.filter((item) => (item.id || item.name) !== (server.id || server.name)));
  };

  const applyMcpJson = async () => {
    if (!mcpJson.trim()) {
      message.warning('请先粘贴 MCP JSON 配置');
      return;
    }
    setMcpParsing(true);
    try {
      const result = await mcpApi.normalize({ json: mcpJson });
      const current = (form.getFieldValue('mcpServers') || []) as McpServerConfig[];
      const merged = [...current];
      for (const server of result.servers || []) {
        const key = server.id || server.name;
        const idx = merged.findIndex((item) => (item.id || item.name) === key);
        if (idx >= 0) merged[idx] = server;
        else merged.push(server);
      }
      setMcpServers(merged);
      setMcpJsonOpen(false);
      message.success(`已导入 ${result.servers.length} 个 MCP Server`);
    } catch (error: any) {
      message.error(error?.response?.data?.message || error.message || 'MCP JSON 解析失败');
    } finally {
      setMcpParsing(false);
    }
  };

  const getMcpEndpoint = (server: McpServerConfig) => {
    if (server.transport === 'stdio') {
      return [server.command, ...(server.args || [])].filter(Boolean).join(' ');
    }
    return server.url || '';
  };

  const handleCapabilitySkillsChange = useCallback((ids: string[]) => {
    form.setFieldValue('skills', ids);
  }, [form]);

  const handleCapabilitySnapshotChange = useCallback((snapshot: CapabilityNodeSnapshot[]) => {
    form.setFieldValue('capabilityTreeSnapshot', snapshot);
  }, [form]);

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
      <Title level={3} style={{ textAlign: 'center', marginBottom: 24 }}>
        <RobotOutlined style={{ marginRight: 8, color: '#6366f1' }} />
        {editId ? '编辑 Agent' : '创建新 Agent'}
      </Title>

      {/* 步骤条 */}
      <Steps
        current={currentStep}
        onChange={setCurrentStep}
        style={{ marginBottom: 32 }}
        items={[
          { title: '基础配置', description: '名称和模型' },
          { title: '能力配置', description: 'Skills、知识库和 MCP' },
          { title: '高级设置', description: '记忆和参数' },
        ]}
      />

      <Card style={{ borderRadius: 12 }}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleFinish}
          initialValues={{
            model: availableModels[0]?.code || 'qwen-plus',
            memoryEnabled: true,
            temperature: 0.7,
            mcpServers: [],
            skills: [],
            capabilityTreeSnapshot: [],
            processArchitectureNodeIds: [],
          }}
        >
          {/* Step 1: 基础配置 */}
          <div style={{ display: currentStep === 0 ? 'block' : 'none' }}>
            <>
              <Form.Item
                name="name"
                label="Agent 名称"
                rules={[{ required: true, message: '请输入 Agent 名称' }]}
              >
                <Input placeholder="例如：流程分析助手" size="large" />
              </Form.Item>

              <Form.Item
                name="description"
                label="描述"
                rules={[{ required: true, message: '请输入描述' }]}
              >
                <Input.TextArea
                  placeholder="描述这个 Agent 的主要功能和用途"
                  rows={3}
                />
              </Form.Item>

              <Form.Item
                name="processArchitectureNodeIds"
                label="流程架构"
                rules={[{ required: true, message: '请选择流程架构' }]}
              >
                <ProcessArchitectureSelector placeholder="选择这个 Agent 覆盖的流程节点" />
              </Form.Item>

              <Form.Item label="头像">
                <Space align="start" size={16}>
                  <Avatar
                    size={64}
                    src={getAgentAvatarSrc(avatar)}
                    style={getAgentAvatarStyle(avatar)}
                  >
                    {renderAgentAvatarContent(avatar, 'AI')}
                  </Avatar>
                  <Space direction="vertical" style={{ flex: 1 }}>
                    <Upload beforeUpload={readAvatarFile} showUploadList={false} accept="image/*">
                      <Button icon={<UploadOutlined />}>上传本地图片</Button>
                    </Upload>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      也可以选择 30 个平台内置 AI 主题图标
                    </Text>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 36px)', gap: 8, maxWidth: 260 }}>
                      {AGENT_ICON_LIBRARY.map((icon) => (
                        <button
                          key={icon.token}
                          type="button"
                          onClick={() => setAvatar(icon.token)}
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            border: avatar === icon.token ? '2px solid #2563eb' : '1px solid #d7dde7',
                            background: icon.background,
                            color: '#fff',
                            fontSize: 18,
                            lineHeight: '32px',
                            cursor: 'pointer',
                            boxShadow: avatar === icon.token
                              ? `0 0 0 3px ${icon.accent}, 0 10px 22px rgba(15, 23, 42, 0.16)`
                              : '0 6px 14px rgba(15, 23, 42, 0.10)',
                            transition: 'transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease',
                          }}
                          title={icon.label}
                          aria-label={icon.label}
                        >
                          {icon.glyph}
                        </button>
                      ))}
                    </div>
                  </Space>
                </Space>
              </Form.Item>

              <Form.Item
                name="model"
                label="模型选择"
                rules={[{ required: true }]}
              >
                <Select
                  size="large"
                  options={availableModels.map((model) => ({
                    value: model.code,
                    label: model.label,
                  }))}
                />
              </Form.Item>

              <Form.Item
                name="systemPrompt"
                label="系统提示词"
              >
                <Input.TextArea
                  placeholder="定义 Agent 的角色和行为准则..."
                  rows={4}
                />
              </Form.Item>

              <Divider />

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div>
                    <Title level={5} style={{ margin: 0 }}>
                      <ApiOutlined style={{ color: '#2563eb', marginRight: 8 }} />
                      MCP Server
                    </Title>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      从市场添加，或粘贴 Claude / Cursor 风格的 mcpServers JSON。
                    </Text>
                  </div>
                  <Button icon={<CodeOutlined />} onClick={() => setMcpJsonOpen(true)}>
                    粘贴 JSON
                  </Button>
                </div>

                <Alert
                  type="info"
                  showIcon
                  icon={<SafetyCertificateOutlined />}
                  message="兼容 stdio、Streamable HTTP 和 SSE。配置会随 Agent 保存，运行时执行前仍会做权限和环境校验。"
                  style={{ borderRadius: 10, marginBottom: 14 }}
                />

                {selectedMcpServers.length > 0 && (
                  <div style={{
                    border: '1px solid #dbe4f0',
                    background: '#f8fbff',
                    borderRadius: 12,
                    padding: 12,
                    marginBottom: 14,
                  }}>
                    <Text strong style={{ fontSize: 13 }}>已装配 {selectedMcpServers.length} 个 MCP</Text>
                    <Space direction="vertical" size={8} style={{ width: '100%', marginTop: 10 }}>
                      {selectedMcpServers.map((server) => (
                        <div
                          key={server.id || server.name}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr auto',
                            gap: 12,
                            alignItems: 'center',
                            padding: '10px 12px',
                            border: '1px solid #e5ebf3',
                            background: '#fff',
                            borderRadius: 10,
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <Space size={6} wrap>
                              <Text strong>{server.name}</Text>
                              <Tag color={server.transport === 'stdio' ? 'geekblue' : 'cyan'}>{server.transport}</Tag>
                              {server.source && <Tag>{server.source}</Tag>}
                            </Space>
                            <Tooltip title={getMcpEndpoint(server)}>
                              <Text type="secondary" ellipsis style={{ display: 'block', maxWidth: 520, fontSize: 12 }}>
                                <LinkOutlined /> {getMcpEndpoint(server) || '未填写连接信息'}
                              </Text>
                            </Tooltip>
                          </div>
                          <Button
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => removeMcpServer(server)}
                            aria-label={`移除 ${server.name}`}
                          />
                        </div>
                      ))}
                    </Space>
                  </div>
                )}

                <Row gutter={[12, 12]}>
                  {mcpMarketplace.map((server) => {
                    const active = selectedMcpServers.some((item) => (item.id || item.name) === (server.id || server.name));
                    return (
                      <Col span={12} key={server.id || server.name}>
                        <div style={{
                          border: active ? '1px solid #2563eb' : '1px solid #e5eaf2',
                          background: active ? '#f5f9ff' : '#fff',
                          borderRadius: 12,
                          padding: 14,
                          minHeight: 152,
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          boxShadow: active ? '0 12px 30px rgba(37, 99, 235, 0.10)' : '0 8px 22px rgba(15, 23, 42, 0.05)',
                        }}>
                          <div>
                            <Space size={8} style={{ marginBottom: 8 }} wrap>
                              <ShoppingOutlined style={{ color: '#2563eb' }} />
                              <Text strong>{server.name}</Text>
                              <Tag color={server.transport === 'stdio' ? 'geekblue' : 'cyan'}>{server.transport}</Tag>
                            </Space>
                            <Text type="secondary" style={{ fontSize: 12, display: 'block', minHeight: 36 }}>
                              {server.description}
                            </Text>
                            {(server.capabilities || []).length > 0 && (
                              <Space wrap size={[4, 4]} style={{ marginTop: 8 }}>
                                {(server.capabilities || []).slice(0, 3).map((cap) => (
                                  <Tag key={cap} style={{ marginRight: 0 }}>{cap}</Tag>
                                ))}
                              </Space>
                            )}
                          </div>
                          <Button
                            size="small"
                            type={active ? 'default' : 'primary'}
                            onClick={() => active ? removeMcpServer(server) : addMcpServer(server)}
                            style={{ marginTop: 12, borderRadius: 8, alignSelf: 'flex-start' }}
                          >
                            {active ? '移除' : '添加'}
                          </Button>
                        </div>
                      </Col>
                    );
                  })}
                </Row>
              </div>
            </>
          </div>

          {/* Step 2: 能力配置 */}
          <div style={{ display: currentStep === 1 ? 'block' : 'none' }}>
            <>
              <div style={{ marginBottom: 8 }}>
                <Title level={5} style={{ margin: 0 }}>能力装配</Title>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  默认使用能力树组织 SKU，快速选择保留原有卡片交互。
                </Text>
              </div>

              <Tabs
                defaultActiveKey="tree"
                items={[
                  {
                    key: 'tree',
                    label: '能力树',
                    children: (
                      <CapabilityTreeBuilder
                        skills={availableSkills}
                        selectedSkillIds={selectedSkillIds}
                        onSkillsChange={handleCapabilitySkillsChange}
                        onSnapshotChange={handleCapabilitySnapshotChange}
                      />
                    ),
                  },
                  {
                    key: 'quick',
                    label: '快速选择',
                    children: (
                      <Form.Item name="skills" noStyle>
                        <Checkbox.Group style={{ width: '100%' }}>
                          {(() => {
                            const allDomains = [...new Set(availableSkills.map(s => s.domain).filter(Boolean))] as string[];
                            return (
                              <div style={{ marginBottom: 16 }}>
                                <Text type="secondary" style={{ fontSize: 12, marginBottom: 6, display: 'block' }}>
                                  按领域筛选
                                </Text>
                                <Space wrap size={[4, 8]}>
                                  <Tag.CheckableTag
                                    checked={selectedDomain === null}
                                    onChange={() => { setSelectedDomain(null); setSelectedSubDomain(null); }}
                                    style={{ borderRadius: 12, padding: '2px 14px' }}
                                  >
                                    全部
                                  </Tag.CheckableTag>
                                  {allDomains.map(domain => (
                                    <Tag.CheckableTag
                                      key={domain}
                                      checked={selectedDomain === domain}
                                      onChange={() => {
                                        setSelectedDomain(domain === selectedDomain ? null : domain);
                                        setSelectedSubDomain(null);
                                      }}
                                      style={{ borderRadius: 12, padding: '2px 14px' }}
                                    >
                                      {DomainLabels[domain as SkillDomain] || domain}
                                    </Tag.CheckableTag>
                                  ))}
                                </Space>
                              </div>
                            );
                          })()}

                          {selectedDomain && (() => {
                            const subDomains = [...new Set(
                              availableSkills.filter(s => s.domain === selectedDomain).map(s => s.subDomain).filter(Boolean)
                            )] as string[];
                            if (subDomains.length === 0) return null;
                            return (
                              <div style={{ marginBottom: 16, marginLeft: 8 }}>
                                <Text type="secondary" style={{ fontSize: 12, marginBottom: 6, display: 'block' }}>
                                  子域
                                </Text>
                                <Space wrap size={[4, 8]}>
                                  <Tag.CheckableTag
                                    checked={selectedSubDomain === null}
                                    onChange={() => setSelectedSubDomain(null)}
                                    style={{ borderRadius: 12, padding: '2px 14px' }}
                                  >
                                    全部子域
                                  </Tag.CheckableTag>
                                  {subDomains.map(sd => (
                                    <Tag.CheckableTag
                                      key={sd}
                                      checked={selectedSubDomain === sd}
                                      onChange={checked => setSelectedSubDomain(checked ? sd : null)}
                                      style={{ borderRadius: 12, padding: '2px 14px' }}
                                    >
                                      {sd.replace(/_/g, ' ')}
                                    </Tag.CheckableTag>
                                  ))}
                                </Space>
                              </div>
                            );
                          })()}

                          <Text style={{
                            fontSize: 12, marginBottom: 12, display: 'block',
                            color: selectedSkillIds.length > 0 ? '#6366f1' : '#999',
                          }}>
                            {selectedSkillIds.length > 0
                              ? `已选择 ${selectedSkillIds.length} 个 Skill`
                              : '尚未选择任何 Skill'
                            }
                          </Text>

                          <div style={{ maxHeight: 300, overflowY: 'auto', overflowX: 'hidden', paddingRight: 4, marginRight: -4 }}>
                            <Row gutter={[12, 12]}>
                              {(() => {
                                let filtered = availableSkills;
                                if (selectedDomain) filtered = filtered.filter(s => s.domain === selectedDomain);
                                if (selectedSubDomain) filtered = filtered.filter(s => s.subDomain === selectedSubDomain);
                                return filtered.length > 0 ? filtered.map((skill) => (
                                  <Col xs={24} md={12} key={skill.id}>
                                    <Card
                                      hoverable
                                      style={{ borderRadius: 10, border: '1px solid #e8e8e8', height: 118, overflow: 'hidden' }}
                                      bodyStyle={{ padding: 12, height: '100%' }}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                        <Checkbox value={skill.id} style={{ marginTop: 3 }} />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
                                            <Text strong style={{ fontSize: 14, maxWidth: 180 }} ellipsis>{skill.name}</Text>
                                            {skill.abilityName && (
                                              <Tag style={{ fontSize: 10, lineHeight: '18px', marginRight: 0 }}>{skill.abilityName}</Tag>
                                            )}
                                            {skill.domain && (
                                              <Tag color="blue" style={{ fontSize: 10, lineHeight: '18px', marginRight: 0 }}>
                                                {DomainLabels[skill.domain as SkillDomain] || skill.domain}
                                              </Tag>
                                            )}
                                          </div>
                                          <Text type="secondary" style={{
                                            fontSize: 12,
                                            display: '-webkit-box',
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden',
                                          }}>
                                            {skill.description}
                                          </Text>
                                        </div>
                                      </div>
                                    </Card>
                                  </Col>
                                )) : (
                                  <Col span={24}>
                                    <div style={{ padding: '40px 0' }}>
                                      <Empty description="该分类下暂无 Skill" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                                    </div>
                                  </Col>
                                );
                              })()}
                            </Row>
                          </div>
                        </Checkbox.Group>
                      </Form.Item>
                    ),
                  },
                ]}
              />

              <Divider />

              <Form.Item
                name="knowledgeBases"
                label={<Title level={5} style={{ margin: 0 }}>关联知识库</Title>}
              >
                <Select
                  mode="multiple"
                  placeholder="选择知识库（可选，可多选）"
                  options={availableKnowledgeBases.map(kb => ({
                    value: kb.id,
                    label: `${kb.name} (${kb.documentCount} 文档)`,
                  }))}
                />
              </Form.Item>
            </>
          </div>

          {/* Step 3: 高级设置 */}
          <div style={{ display: currentStep === 2 ? 'block' : 'none' }}>
            <>
              <Form.Item
                name="memoryEnabled"
                label="启用长期记忆"
                valuePropName="checked"
              >
                <Switch checkedChildren="开启" unCheckedChildren="关闭" />
              </Form.Item>
              <Text type="secondary" style={{ marginBottom: 16, display: 'block' }}>
                开启后 Agent 将记住用户的偏好和历史对话内容
              </Text>

              <Divider />

              <Form.Item
                name="temperature"
                label="温度参数"
              >
                <Select
                  options={[
                    { value: 0.3, label: '严谨 (0.3) - 更精确、一致' },
                    { value: 0.7, label: '平衡 (0.7) - 推荐' },
                    { value: 1.0, label: '创意 (1.0) - 更多样、灵活' },
                  ]}
                />
              </Form.Item>

              <Form.Item
                name="maxTokens"
                label="最大输出长度"
              >
                <Select
                  options={[
                    { value: 1024, label: '短 (1024 tokens)' },
                    { value: 2048, label: '中 (2048 tokens)' },
                    { value: 4096, label: '长 (4096 tokens)' },
                  ]}
                />
              </Form.Item>
            </>
          </div>

          {/* 操作按钮 */}
          <Divider />
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            {currentStep > 0 && (
              <Button onClick={() => setCurrentStep(currentStep - 1)}>
                上一步
              </Button>
            )}
            {currentStep < 2 ? (
              <Button
                type="primary"
                onClick={async () => {
                  // 根据当前步骤校验相关字段
                  const stepFields = [['name', 'description', 'model'], [], []];
                  try {
                    await form.validateFields(stepFields[currentStep]);
                    setCurrentStep(currentStep + 1);
                  } catch {
                    // 校验失败，表单自动显示错误提示
                  }
                }}
                style={{ background: '#6366f1' }}
              >
                下一步
              </Button>
            ) : (
              <Space>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SaveOutlined />}
                  loading={loading}
                  style={{ background: '#6366f1' }}
                >
                  {editId ? '保存 Agent' : '创建 Agent'}
                </Button>
                <Button
                  onClick={() => navigate('/dashboard')}
                >
                  取消
                </Button>
              </Space>
            )}
          </Space>
        </Form>
      </Card>

      <Modal
        title="粘贴 MCP JSON 配置"
        open={mcpJsonOpen}
        onCancel={() => setMcpJsonOpen(false)}
        onOk={applyMcpJson}
        okText="解析并添加"
        cancelText="取消"
        confirmLoading={mcpParsing}
        width={720}
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 10 }}>
          支持 <code>mcpServers</code> 对象、数组，或单个 Server 配置。敏感 Key 建议写成环境变量占位符。
        </Text>
        <Input.TextArea
          value={mcpJson}
          onChange={(event) => setMcpJson(event.target.value)}
          rows={14}
          spellCheck={false}
          placeholder={`{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/workspace"]
    },
    "remoteSearch": {
      "transport": "streamable_http",
      "url": "https://example.com/mcp",
      "headers": { "Authorization": "Bearer \${TOKEN}" }
    }
  }
}`}
          style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}
        />
      </Modal>
    </div>
  );
};

export default AgentCreate;
