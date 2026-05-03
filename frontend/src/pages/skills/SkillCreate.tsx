import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Select, Button, TreeSelect, message, Spin, Collapse, InputNumber, Row, Col } from 'antd';
import { SaveOutlined, RobotOutlined, ArrowLeftOutlined, SettingOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { SkillDomain, DomainLabels } from '../../types';
import { skillsApi, modelsApi } from '../../services/api';
import { useAuthStore } from '../../stores/useAuthStore';

const { TextArea } = Input;

// 统一视觉语言
const colors = {
  primary: '#2563eb',
  primaryDark: '#1d4ed8',
  green: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
  purple: '#8b5cf6',
  bgMain: '#f0f4f8',
  bgCard: '#ffffff',
  textPrimary: '#1e293b',
  textSecondary: '#64748b',
  border: '#e2e8f0',
};

// Skill 类型选项（用户要求的专业技能/通用技能/管理技能）
const skillTypeOptions = [
  { label: '专业技能', value: 'professional' },
  { label: '通用技能', value: 'general' },
  { label: '管理技能', value: 'management' },
];

// 优先级选项
const priorityOptions = [
  { label: '高', value: 'high' },
  { label: '中', value: 'medium' },
  { label: '低', value: 'low' },
];

// 执行方式选项
const executionTypeOptions = [
  { label: 'API 调用', value: 'api' },
  { label: 'Webhook', value: 'webhook' },
  { label: 'RPA 脚本', value: 'rpa' },
  { label: 'AI Agent', value: 'agent' },
  { label: '手动执行', value: 'manual' },
];

// HTTP 方法选项
const httpMethodOptions = [
  { label: 'GET', value: 'GET' },
  { label: 'POST', value: 'POST' },
  { label: 'PUT', value: 'PUT' },
  { label: 'DELETE', value: 'DELETE' },
];

// 认证方式选项
const authTypeOptions = [
  { label: 'Bearer Token', value: 'bearer' },
  { label: 'Basic Auth', value: 'basic' },
  { label: 'API Key', value: 'apikey' },
  { label: 'OAuth2', value: 'oauth2' },
];

// 降级方式选项
const fallbackOptions = [
  { label: '返回默认值', value: 'default' },
  { label: '跳过执行', value: 'skip' },
  { label: '人工介入', value: 'manual' },
  { label: '抛出异常', value: 'throw' },
];

// Prompt 模板
const promptTemplate = `# 角色定义
你是一位专业的{业务域}领域专家。

# 任务描述
{在此编写 Skill 的具体任务指令}

# 输入格式
用户将提供以下信息：
- {输入字段1}
- {输入字段2}

# 输出要求
请按以下格式输出：
1. {输出要求1}
2. {输出要求2}

# 注意事项
- {约束条件}`;

// 输入 Schema 示例
const inputSchemaPlaceholder = `{
  "type": "object",
  "properties": {
    "content": {
      "type": "string",
      "description": "用户输入的内容"
    },
    "context": {
      "type": "string",
      "description": "上下文信息"
    }
  },
  "required": ["content"]
}`;

// 输出 Schema 示例
const outputSchemaPlaceholder = `{
  "type": "object",
  "properties": {
    "result": {
      "type": "string",
      "description": "处理结果"
    },
    "suggestions": {
      "type": "array",
      "items": { "type": "string" },
      "description": "建议列表"
    }
  }
}`;

const SkillCreate: React.FC = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [prompt, setPrompt] = useState(promptTemplate);
  const [inputSchema, setInputSchema] = useState('');
  const [outputSchema, setOutputSchema] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // 执行配置状态
  const [executionType, setExecutionType] = useState<string | undefined>(undefined);

  // 获取当前用户角色，判断是否可编辑执行配置
  const user = useAuthStore(state => state.user);
  const canEditExecution = user?.isAdmin === true;

  // 组织和岗位数据状态
  const [orgTree, setOrgTree] = useState<any[]>([]);
  const [positions, setPositions] = useState<{ label: string; value: string }[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // 递归转换组织树数据为 TreeSelect 格式
  const convertOrgTree = (orgs: any[]): any[] => {
    return orgs.map(org => ({
      title: org.name,
      value: String(org.id),
      key: String(org.id),
      children: org.children ? convertOrgTree(org.children) : undefined,
    }));
  };

  // 从后端加载组织和岗位数据
  useEffect(() => {
    const fetchData = async () => {
      try {
        setDataLoading(true);
        
        // 从后端加载岗位列表
        const modelData = await modelsApi.list().catch(() => []);
        
        // 组织树已废弃，直接使用降级数据
        setOrgTree([
          { title: '全局', value: 'global', key: 'global' },
        ]);
        
        // 转换岗位列表
        if (Array.isArray(modelData) && modelData.length > 0) {
          setPositions(modelData.map((m: any) => ({
            label: m.name,
            value: String(m.id),
          })));
        } else {
          // 降级使用 Mock 数据
          setPositions([
            { label: '合同管理岗', value: 'contract-mgr' },
            { label: '法务顾问岗', value: 'legal-advisor' },
            { label: '财务会计岗', value: 'accountant' },
          ]);
        }
      } catch (error) {
        console.error('加载数据失败:', error);
      } finally {
        setDataLoading(false);
      }
    };
    fetchData();
  }, []);

  // AI 辅助生成 Prompt
  const handleAiGenerate = async () => {
    const name = form.getFieldValue('name');
    const description = form.getFieldValue('description');
    const domain = form.getFieldValue('domain');

    if (!name || !description) {
      message.warning('请先填写 Skill 名称和描述');
      return;
    }

    setAiGenerating(true);
    
    // Mock 2秒延迟
    await new Promise(resolve => setTimeout(resolve, 2000));

    const domainLabel = domain ? DomainLabels[domain as SkillDomain] : '业务';
    
    const generatedPrompt = `# 角色定义
你是一位专业的${domainLabel}领域专家，专注于${name}相关任务。

# 任务描述
${description}

# 输入格式
用户将提供以下信息：
- 具体的业务场景描述
- 相关的背景信息和约束条件
- 期望的处理方式或结果格式

# 输出要求
请按以下格式输出：
1. 分析结果：对输入内容的专业分析
2. 处理建议：具体可执行的行动建议
3. 风险提示：需要注意的潜在问题

# 注意事项
- 确保输出内容符合${domainLabel}领域的专业规范
- 结果应当清晰、可操作
- 如遇不确定情况，应明确说明需要进一步确认的信息`;

    setPrompt(generatedPrompt);
    setAiGenerating(false);
    message.success('Prompt 已自动生成');
  };

  // 保存
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      
      const skillData = {
        name: values.name,
        domain: values.domain,
        description: values.description,
        prompt,
        inputSchema,
        outputSchema,
        type: values.type,
        priority: values.priority,
        targetOrgs: values.targetOrgs,
        targetPositions: values.targetPositions,
        status: 'draft',
        // 执行配置字段
        executionType: values.executionType,
        endpoint: values.endpoint,
        httpMethod: values.httpMethod,
        headers: values.headers,
        requestTemplate: values.requestTemplate,
        responseMapping: values.responseMapping,
        authType: values.authType,
        authCredential: values.authCredential,
        agentPrompt: values.agentPrompt,
        toolDefinition: values.toolDefinition,
        retryCount: values.retryCount,
        retryInterval: values.retryInterval,
        fallbackType: values.fallbackType,
      };
      
      await skillsApi.create(skillData as any);
      message.success('Skill 创建成功！已进入审核流程');
      navigate('/skills');
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'response' in error) {
        message.error('创建失败，请重试');
      } else {
        message.error('请填写必填字段');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 24, background: colors.bgMain, minHeight: '100%' }}>
      {/* 标题栏 */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: 24 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={() => navigate('/skills')}
            style={{ borderRadius: 8 }}
          >
            返回
          </Button>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: colors.textPrimary, margin: 0 }}>
              创建/编写 Skill
            </h1>
            <p style={{ fontSize: 14, color: colors.textSecondary, marginTop: 4, marginBottom: 0 }}>
              定义 Skill 基本信息并编写 Prompt 指令
            </p>
          </div>
        </div>
        <Button 
          type="primary" 
          icon={<SaveOutlined />} 
          onClick={handleSave}
          style={{ 
            background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', 
            border: 'none', 
            borderRadius: 8,
            height: 40,
            paddingLeft: 24,
            paddingRight: 24,
            fontWeight: 500,
          }}
        >
          保存
        </Button>
      </div>

      {/* 左右分栏布局 */}
      <div style={{ display: 'flex', gap: 24 }}>
        {/* 左栏 - 基本信息 */}
        <Card 
          title="基本信息"
          style={{ 
            flex: '0 0 380px', 
            background: colors.bgCard, 
            borderRadius: 16, 
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)', 
            border: 'none',
          }}
          headStyle={{ 
            borderBottom: `1px solid ${colors.border}`,
            fontWeight: 600,
            fontSize: 16,
          }}
          bodyStyle={{ padding: 24 }}
        >
          <Form 
            form={form} 
            layout="vertical"
            requiredMark="optional"
          >
            <Form.Item 
              name="name" 
              label="Skill 名称" 
              rules={[{ required: true, message: '请输入 Skill 名称' }]}
            >
              <Input 
                placeholder="例如：合同审核助手" 
                style={{ borderRadius: 8 }} 
              />
            </Form.Item>

            <Form.Item 
              name="type" 
              label="Skill 类型"
              rules={[{ required: true, message: '请选择类型' }]}
            >
              <Select 
                placeholder="选择类型" 
                options={skillTypeOptions}
                style={{ borderRadius: 8 }} 
              />
            </Form.Item>

            <Form.Item 
              name="domain" 
              label="所属业务域"
              rules={[{ required: true, message: '请选择业务域' }]}
            >
              <Select 
                placeholder="选择业务域"
                style={{ borderRadius: 8 }}
              >
                {Object.values(SkillDomain).map((domain) => (
                  <Select.Option key={domain} value={domain}>
                    {DomainLabels[domain]}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item 
              name="description" 
              label="描述"
            >
              <TextArea 
                rows={3} 
                placeholder="描述这个 Skill 的功能和用途" 
                style={{ borderRadius: 8 }} 
              />
            </Form.Item>

            <Form.Item 
              name="targetOrgs" 
              label={<span>适用组织范围 <span style={{ color: colors.red }}>*</span></span>}
              rules={[{ required: true, message: '请选择适用组织' }]}
            >
              <TreeSelect
                treeData={orgTree}
                placeholder={dataLoading ? "加载中..." : "选择适用的组织"}
                treeCheckable
                showCheckedStrategy={TreeSelect.SHOW_PARENT}
                style={{ width: '100%' }}
                dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
                allowClear
                loading={dataLoading}
              />
            </Form.Item>

            <Form.Item 
              name="targetPositions" 
              label={<span>适用岗位范围 <span style={{ color: colors.red }}>*</span></span>}
              rules={[{ required: true, message: '请选择适用岗位' }]}
            >
              <Select
                mode="multiple"
                placeholder={dataLoading ? "加载中..." : "选择适用的岗位"}
                options={positions}
                style={{ width: '100%' }}
                allowClear
                loading={dataLoading}
              />
            </Form.Item>

            <Form.Item 
              name="priority" 
              label="优先级"
            >
              <Select 
                placeholder="选择优先级" 
                options={priorityOptions}
                style={{ borderRadius: 8 }} 
              />
            </Form.Item>

            {/* 执行配置折叠区域 - 仅管理员和经理可见 */}
            {canEditExecution && (
              <Collapse
                ghost
                style={{ marginTop: 16 }}
                items={[
                  {
                    key: 'execution',
                    label: (
                      <span style={{ fontWeight: 500, color: colors.textPrimary }}>
                        <SettingOutlined style={{ marginRight: 8 }} />
                        执行配置
                      </span>
                    ),
                    children: (
                      <>
                        <Form.Item 
                          name="executionType" 
                          label="执行方式"
                        >
                          <Select 
                            placeholder="选择执行方式" 
                            options={executionTypeOptions}
                            style={{ borderRadius: 8 }}
                            onChange={(value) => setExecutionType(value)}
                          />
                        </Form.Item>

                        {/* API 调用配置 */}
                        {executionType === 'api' && (
                          <>
                            <Form.Item name="endpoint" label="API 端点">
                              <Input placeholder="https://api.example.com/v1/action" style={{ borderRadius: 8 }} />
                            </Form.Item>
                            <Form.Item name="httpMethod" label="HTTP 方法">
                              <Select placeholder="选择 HTTP 方法" options={httpMethodOptions} style={{ borderRadius: 8 }} />
                            </Form.Item>
                            <Form.Item name="headers" label="请求头">
                              <TextArea 
                                rows={3} 
                                placeholder={'{\n  "Content-Type": "application/json"\n}'} 
                                style={{ borderRadius: 8, fontFamily: 'monospace', fontSize: 12 }} 
                              />
                            </Form.Item>
                            <Form.Item name="requestTemplate" label="请求模板">
                              <TextArea 
                                rows={4} 
                                placeholder={'{\n  "input": "{{content}}",\n  "context": "{{context}}"\n}'} 
                                style={{ borderRadius: 8, fontFamily: 'monospace', fontSize: 12 }} 
                              />
                            </Form.Item>
                            <Form.Item name="responseMapping" label="响应映射">
                              <TextArea 
                                rows={3} 
                                placeholder={'{\n  "result": "$.data.output"\n}'} 
                                style={{ borderRadius: 8, fontFamily: 'monospace', fontSize: 12 }} 
                              />
                            </Form.Item>
                            <Form.Item name="authType" label="认证方式">
                              <Select placeholder="选择认证方式" options={authTypeOptions} style={{ borderRadius: 8 }} />
                            </Form.Item>
                            <Form.Item name="authCredential" label="认证凭据">
                              <Input.Password placeholder="输入认证凭据" style={{ borderRadius: 8 }} />
                            </Form.Item>
                          </>
                        )}

                        {/* AI Agent 配置 */}
                        {executionType === 'agent' && (
                          <>
                            <Form.Item name="agentPrompt" label="Agent Prompt 模板">
                              <TextArea 
                                rows={6} 
                                placeholder="定义 AI Agent 的行为指令..." 
                                style={{ borderRadius: 8, fontFamily: 'monospace', fontSize: 12 }} 
                              />
                            </Form.Item>
                            <Form.Item name="toolDefinition" label="工具定义">
                              <TextArea 
                                rows={4} 
                                placeholder={'[\n  {\n    "name": "search",\n    "description": "搜索工具"\n  }\n]'} 
                                style={{ borderRadius: 8, fontFamily: 'monospace', fontSize: 12 }} 
                              />
                            </Form.Item>
                          </>
                        )}

                        {/* 错误处理策略（通用） */}
                        <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${colors.border}` }}>
                          <div style={{ fontWeight: 500, color: colors.textPrimary, marginBottom: 12 }}>错误处理策略</div>
                          <Row gutter={12}>
                            <Col span={8}>
                              <Form.Item name="retryCount" label="重试次数">
                                <InputNumber min={0} max={10} defaultValue={3} style={{ width: '100%', borderRadius: 8 }} />
                              </Form.Item>
                            </Col>
                            <Col span={8}>
                              <Form.Item name="retryInterval" label="重试间隔(ms)">
                                <InputNumber min={100} max={60000} defaultValue={1000} style={{ width: '100%', borderRadius: 8 }} />
                              </Form.Item>
                            </Col>
                            <Col span={8}>
                              <Form.Item name="fallbackType" label="降级方式">
                                <Select placeholder="选择降级方式" options={fallbackOptions} style={{ borderRadius: 8 }} />
                              </Form.Item>
                            </Col>
                          </Row>
                        </div>
                      </>
                    ),
                  },
                ]}
              />
            )}
          </Form>
        </Card>

        {/* 右栏 - Skill 编辑器 */}
        <Card 
          title="Skill 编辑器"
          style={{ 
            flex: 1, 
            background: colors.bgCard, 
            borderRadius: 16, 
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)', 
            border: 'none',
          }}
          headStyle={{ 
            borderBottom: `1px solid ${colors.border}`,
            fontWeight: 600,
            fontSize: 16,
          }}
          bodyStyle={{ padding: 24 }}
        >
          {/* Prompt 编辑器 */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: 8 
            }}>
              <label style={{ 
                fontWeight: 500, 
                color: colors.textPrimary,
                fontSize: 14,
              }}>
                Prompt 编辑器
              </label>
            </div>
            <TextArea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              style={{ 
                fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, Courier, monospace',
                fontSize: 13,
                lineHeight: 1.6,
                borderRadius: 8,
                background: '#f8fafc',
                minHeight: 240,
              }}
              rows={12}
            />
          </div>

          {/* 输入 Schema */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ 
              fontWeight: 500, 
              color: colors.textPrimary,
              fontSize: 14,
              display: 'block',
              marginBottom: 8,
            }}>
              输入 Schema
            </label>
            <TextArea
              value={inputSchema}
              onChange={(e) => setInputSchema(e.target.value)}
              placeholder={inputSchemaPlaceholder}
              style={{ 
                fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, Courier, monospace',
                fontSize: 13,
                lineHeight: 1.5,
                borderRadius: 8,
              }}
              rows={6}
            />
          </div>

          {/* 输出 Schema */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ 
              fontWeight: 500, 
              color: colors.textPrimary,
              fontSize: 14,
              display: 'block',
              marginBottom: 8,
            }}>
              输出 Schema
            </label>
            <TextArea
              value={outputSchema}
              onChange={(e) => setOutputSchema(e.target.value)}
              placeholder={outputSchemaPlaceholder}
              style={{ 
                fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, Courier, monospace',
                fontSize: 13,
                lineHeight: 1.5,
                borderRadius: 8,
              }}
              rows={6}
            />
          </div>

          {/* AI 辅助生成按钮 */}
          <Button
            icon={aiGenerating ? <Spin size="small" /> : <RobotOutlined />}
            onClick={handleAiGenerate}
            disabled={aiGenerating}
            style={{ 
              borderRadius: 8,
              background: aiGenerating ? '#f1f5f9' : 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
              border: 'none',
              color: aiGenerating ? colors.textSecondary : '#fff',
              height: 40,
              paddingLeft: 20,
              paddingRight: 20,
              fontWeight: 500,
            }}
          >
            {aiGenerating ? '正在生成...' : 'AI 辅助生成'}
          </Button>
          <span style={{ 
            marginLeft: 12, 
            fontSize: 13, 
            color: colors.textSecondary 
          }}>
            基于名称和描述自动生成 Prompt
          </span>
        </Card>
      </div>
    </div>
  );
};

export default SkillCreate;
