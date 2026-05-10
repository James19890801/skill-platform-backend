/**
 * AgentCreate - 创建 Agent 页面
 * 配置 Agent 的模型、Skills、知识库、记忆等
 */
import React, { useEffect, useState } from 'react';
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
} from 'antd';
import { useAuthStore } from '../../stores/useAuthStore';
import {
  RobotOutlined,
  SaveOutlined,
  PlayCircleOutlined,
  FolderOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { SkillDomain, DomainLabels } from '../../types';
import { LlmModel, llmApi, knowledgeApi } from '../../services/api';
import {
  AGENT_ICON_LIBRARY,
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
    knowledgeBases: string[];
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
  const selectedSkillIds = Form.useWatch('skills', form);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [selectedSubDomain, setSelectedSubDomain] = useState<string | null>(null);
  const [availableSkills, setAvailableSkills] = useState<Array<{
    id: string;
    name: string;
    description: string;
    domain?: string;
    subDomain?: string;
    abilityName?: string;
  }>>([]);
  const [availableModels, setAvailableModels] = useState<LlmModel[]>([]);
  const [availableKnowledgeBases, setAvailableKnowledgeBases] = useState<Array<{ id: number; name: string; documentCount: number }>>([]);
  const [avatar, setAvatar] = useState<string>('icon:01');

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
        knowledgeBases: initialData.knowledgeBases || [],
        memoryEnabled: initialData.memoryEnabled,
        temperature: initialData.temperature,
        maxTokens: initialData.maxTokens || 2048,
      });
      setAvatar((initialData as any).avatar || 'icon:01');
    }
  }, [editId, initialData, form]);

  const readAvatarFile = (file: File): false => {
    const reader = new FileReader();
    reader.onload = () => {
      setAvatar(String(reader.result || 'icon:01'));
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
        skills: values.skills || [],
        knowledgeBases: values.knowledgeBases || [],
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
          { title: '能力配置', description: 'Skills 和知识库' },
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
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 28px)', gap: 6, maxWidth: 340 }}>
                      {AGENT_ICON_LIBRARY.map((icon) => (
                        <button
                          key={icon.token}
                          type="button"
                          onClick={() => setAvatar(icon.token)}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 8,
                            border: avatar === icon.token ? '2px solid #111827' : '1px solid #e5e7eb',
                            background: icon.background,
                            color: '#fff',
                            fontSize: 10,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                          title={`图标 ${icon.label}`}
                        >
                          {icon.label}
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
            </>
          </div>

          {/* Step 2: 能力配置 */}
          <div style={{ display: currentStep === 1 ? 'block' : 'none' }}>
            <>
              <Form.Item
                name="skills"
                label={<Title level={5} style={{ margin: 0 }}>选择 Skills</Title>}
              >
                <Checkbox.Group style={{ width: '100%' }}>
                  {/* === 领域筛选 === */}
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

                  {/* === 子域筛选 === */}
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

                  {/* === 已选计数 === */}
                  <Text style={{
                    fontSize: 12, marginBottom: 12, display: 'block',
                    color: (selectedSkillIds?.length || 0) > 0 ? '#6366f1' : '#999',
                  }}>
                    {(selectedSkillIds?.length || 0) > 0
                      ? `已选择 ${selectedSkillIds.length} 个 Skill`
                      : '尚未选择任何 Skill'
                    }
                  </Text>

                  {/* === Skill 卡片列表 === */}
                  <Row gutter={[12, 12]}>
                    {(() => {
                      let filtered = availableSkills;
                      if (selectedDomain) filtered = filtered.filter(s => s.domain === selectedDomain);
                      if (selectedSubDomain) filtered = filtered.filter(s => s.subDomain === selectedSubDomain);
                      return filtered.length > 0 ? filtered.map((skill) => (
                        <Col span={12} key={skill.id}>
                          <Card
                            hoverable
                            style={{ borderRadius: 10, border: '1px solid #e8e8e8' }}
                            bodyStyle={{ padding: 12 }}
                          >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                              <Checkbox value={skill.id} style={{ marginTop: 3 }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
                                  <Text strong style={{ fontSize: 14 }}>{skill.name}</Text>
                                  {skill.abilityName && (
                                    <Tag style={{ fontSize: 10, lineHeight: '18px', marginRight: 0 }}>{skill.abilityName}</Tag>
                                  )}
                                  {skill.domain && (
                                    <Tag color="blue" style={{ fontSize: 10, lineHeight: '18px', marginRight: 0 }}>
                                      {DomainLabels[skill.domain as SkillDomain] || skill.domain}
                                    </Tag>
                                  )}
                                </div>
                                <Text type="secondary" style={{ fontSize: 12 }}>
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
                </Checkbox.Group>
              </Form.Item>

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
    </div>
  );
};

export default AgentCreate;
