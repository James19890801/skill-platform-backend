import React, { useState, useEffect } from 'react';
import {
  Card, Form, Input, Select, Button, Tabs, message, Spin, Row, Col,
  Descriptions, Tag, InputNumber, Space, Typography, Empty, Upload,
} from 'antd';
import {
  SaveOutlined, ArrowLeftOutlined, RobotOutlined, CodeOutlined,
  ApiOutlined, SettingOutlined, FileTextOutlined, ProfileOutlined,
  EditOutlined, UploadOutlined, DeleteOutlined, InboxOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { SkillStatus, SkillScope, SkillType, SkillDomain, DomainLabels } from '../../types';
import { skillsApi } from '../../services/api';
import { useAuthStore } from '../../stores/useAuthStore';

const { TextArea } = Input;
const { Text } = Typography;

const colors = {
  primary: '#2563eb',
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

const scopeOptions = [
  { label: '个人', value: 'personal' },
  { label: '业务', value: 'business' },
  { label: '平台', value: 'platform' },
];

const typeOptions = [
  { label: '纯业务型', value: 'pure-business' },
  { label: '轻技术型', value: 'light-tech' },
  { label: '重技术型', value: 'heavy-tech' },
];

const executionTypeOptions = [
  { label: '手动执行', value: 'manual' },
  { label: 'API 调用', value: 'api' },
  { label: 'Webhook', value: 'webhook' },
  { label: 'AI Agent', value: 'agent' },
  { label: 'RPA 脚本', value: 'rpa' },
];

const httpMethodOptions = [
  { label: 'GET', value: 'GET' },
  { label: 'POST', value: 'POST' },
  { label: 'PUT', value: 'PUT' },
  { label: 'DELETE', value: 'DELETE' },
];

const fallbackOptions = [
  { label: '返回默认值', value: 'default' },
  { label: '跳过执行', value: 'skip' },
  { label: '人工介入', value: 'manual' },
  { label: '抛出异常', value: 'throw' },
];

const SkillEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [skill, setSkill] = useState<any>(null);
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ name: string; path: string; type: string; description: string; size: number }>>([]);
  const [uploading, setUploading] = useState(false);

  // 文件上传处理 — 读取为 Base64 并加入列表
  const handleFileUpload = (file: File): false => {
    setUploading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = (e.target?.result as string) || '';
      let fileType = 'assets';
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      if (['py', 'sh', 'js', 'ts'].includes(ext)) fileType = 'scripts';
      else if (['docx', 'xlsx', 'pptx', 'doc', 'xls'].includes(ext)) fileType = 'templates';
      else if (['pdf', 'md', 'txt', 'json', 'yaml', 'yml'].includes(ext)) fileType = 'references';
      setUploadedFiles(prev => [...prev, {
        name: file.name,
        path: `${fileType}/${file.name}`,
        type: fileType,
        description: base64,
        size: file.size,
      }]);
      message.success(`已添加: ${file.name}`);
      setUploading(false);
    };
    reader.onerror = () => { message.error('文件读取失败'); setUploading(false); };
    reader.readAsDataURL(file);
    return false;
  };

  const handleRemoveFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // 加载 skill 时同步已有 files
  useEffect(() => {
    if (skill?.files && Array.isArray(skill.files)) {
      setUploadedFiles(skill.files.map((f: any) => ({
        name: f.name || '', path: f.path || '', type: f.type || 'assets',
        description: f.description || '', size: f.size || 0,
      })));
    }
  }, [skill?.id]);

  const user = useAuthStore(state => state.user);
  const canEditExecution = user?.role === 'admin' || user?.role === 'manager';

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    skillsApi.getById(Number(id))
      .then(data => {
        setSkill(data);
        form.setFieldsValue({
          name: data.name,
          namespace: data.namespace,
          description: data.description,
          domain: data.domain,
          subDomain: data.subDomain,
          abilityName: data.abilityName,
          scope: data.scope,
          type: data.type,
          sopSource: data.sopSource,
          // Skill 内容
          content: data.content,
          agentPrompt: data.agentPrompt,
          toolDefinition: data.toolDefinition,
          // 执行配置
          executionType: data.executionType,
          endpoint: data.endpoint,
          httpMethod: data.httpMethod,
          headers: data.headers,
          requestTemplate: data.requestTemplate,
          responseMapping: data.responseMapping,
          authConfig: data.authConfig,
          errorHandling: data.errorHandling,
        });
      })
      .catch(() => message.error('加载 Skill 失败'))
      .finally(() => setLoading(false));
  }, [id, form]);

  const handleSave = async () => {
    if (!id) return;
    try {
      const values = await form.validateFields();
      setSaving(true);
      // 将上传文件列表转为 JSON 字符串（后端期望）
      const payload = { ...values };
      if (uploadedFiles.length > 0) {
        payload.files = JSON.stringify(uploadedFiles);
      }
      await skillsApi.update(Number(id), payload);
      message.success('Skill 已更新');
      navigate(`/skills/${id}`);
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (id) navigate(`/skills/${id}`);
    else navigate('/skills');
  };

  if (loading) {
    return (
      <div style={{ padding: 24, background: colors.bgMain, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!skill) {
    return (
      <div style={{ padding: 24, background: colors.bgMain, minHeight: '100%' }}>
        <Spin size="large" />
      </div>
    );
  }

  const tabItems = [
    {
      key: 'basic',
      label: '基本信息',
      children: (
        <div style={{ maxWidth: 800 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="Skill 名称" rules={[{ required: true, message: '请输入名称' }]}>
                <Input placeholder="例如：合同审核助手" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="namespace" label="命名空间" rules={[{ required: true }]}>
                <Input placeholder="如 legal.contract.risk-check" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="domain" label="业务域" rules={[{ required: true }]}>
                <Select placeholder="选择业务域">
                  {Object.values(SkillDomain).map((domain) => (
                    <Select.Option key={domain} value={domain}>{DomainLabels[domain]}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="subDomain" label="子领域">
                <Input placeholder="如 contract / litigation" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="abilityName" label="能力名称">
                <Input placeholder="能力名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="sopSource" label="SOP 来源">
                <Input placeholder="SOP 文档链接" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="scope" label="范围">
                <Select options={scopeOptions} placeholder="选择范围" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="type" label="类型">
                <Select options={typeOptions} placeholder="选择类型" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status" label="状态">
                <Select disabled>
                  <Select.Option value="draft">草稿</Select.Option>
                  <Select.Option value="published">已发布</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="描述">
            <TextArea rows={4} placeholder="描述这个 Skill 的功能和用途" />
          </Form.Item>

          {/* 只读信息 */}
          <Card size="small" style={{ background: '#f8fafc', border: `1px solid ${colors.border}`, borderRadius: 8, marginTop: 16 }}>
            <Descriptions column={3} size="small">
              <Descriptions.Item label="当前版本">{skill.currentVersion}</Descriptions.Item>
              <Descriptions.Item label="负责人">{skill.owner?.name || '-'}</Descriptions.Item>
              <Descriptions.Item label="所属组织">{skill.organization?.name || '-'}</Descriptions.Item>
            </Descriptions>
          </Card>
        </div>
      ),
    },
    {
      key: 'content',
      label: 'Skill 内容',
      children: (
        <div style={{ maxWidth: 900 }}>
          <div style={{ marginBottom: 16, padding: 16, background: '#f0f9ff', borderRadius: 8, border: '1px solid #bae6fd' }}>
            <Text type="secondary" style={{ fontSize: 13, lineHeight: 1.8 }}>
              请使用 Markdown 格式编写 Skill 标准正文（SKILL.md）。建议按以下结构组织：
              <br />
              1. <strong>角色定义</strong> — 你是谁，扮演什么角色
              <br />
              2. <strong>交付物定义</strong> — 这个 Skill 最终产出什么（至少 3 项）
              <br />
              3. <strong>实施步骤</strong> — 分步骤说明执行流程（每步一个标题 + 说明）
              <br />
              4. <strong>工具调用说明</strong> — 需要调用哪些工具、何时调用
              <br />
              5. <strong>输入格式</strong> — 用户应提供什么信息
              <br />
              6. <strong>输出格式</strong> — 最终产出的格式规范
              <br />
              7. <strong>约束条件</strong> — 限制条件、注意事项
              <br />
              8. <strong>示例</strong> — 输入输出示例
            </Text>
          </div>
          <Form.Item name="content" noStyle>
            <TextArea
              rows={24}
              placeholder={`# 角色定义\n你是专业的...领域专家\n\n## 交付物定义\n1. **交付物A**：说明\n2. **交付物B**：说明\n3. **交付物C**：说明\n\n## 实施步骤\n### 第1步：步骤名称\n详细说明\n\n### 第2步：步骤名称\n详细说明\n\n## 工具调用说明\n- **工具A**：何时调用\n- **工具B**：何时调用\n\n## 输入格式\n- 输入项1\n- 输入项2\n\n## 输出格式\n请描述最终产出的格式\n\n## 约束条件\n- 条件1\n- 条件2\n\n## 示例\n### 示例1\n**输入：** ...\n**输出：** ...`}
              style={{
                fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, Courier, monospace',
                fontSize: 13, lineHeight: 1.7, borderRadius: 8, background: '#f8fafc',
              }}
            />
          </Form.Item>
        </div>
      ),
    },
    {
      key: 'execution',
      label: '执行配置',
      children: (
        <div style={{ maxWidth: 800 }}>
          {canEditExecution ? (
            <>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="executionType" label="执行方式">
                    <Select options={executionTypeOptions} placeholder="选择执行方式" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="httpMethod" label="HTTP 方法">
                    <Select options={httpMethodOptions} placeholder="选择 HTTP 方法" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="endpoint" label="API 端点">
                <Input placeholder="https://api.example.com/v1/action" />
              </Form.Item>
              <Form.Item name="headers" label="自定义请求头 (JSON)">
                <TextArea
                  rows={3}
                  placeholder={'{\n  "Content-Type": "application/json"\n}'}
                  style={{ fontFamily: 'monospace', fontSize: 12 }}
                />
              </Form.Item>
              <Form.Item name="authConfig" label="认证配置 (JSON)">
                <TextArea
                  rows={3}
                  placeholder={'{\n  "type": "bearer",\n  "token": "..."\n}'}
                  style={{ fontFamily: 'monospace', fontSize: 12 }}
                />
              </Form.Item>

              {/* 错误处理 */}
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${colors.border}` }}>
                <div style={{ fontWeight: 600, color: colors.textPrimary, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <SettingOutlined style={{ color: colors.red }} />
                  错误处理策略
                </div>
                <Form.Item name="errorHandling" label="错误处理配置 (JSON)">
                  <TextArea
                    rows={4}
                    placeholder={'{\n  "retryCount": 3,\n  "retryInterval": 1000,\n  "fallback": "manual"\n}'}
                    style={{ fontFamily: 'monospace', fontSize: 12 }}
                  />
                </Form.Item>
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item label="重试次数">
                      <InputNumber min={0} max={10} defaultValue={3} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="重试间隔 (ms)">
                      <InputNumber min={100} max={60000} defaultValue={1000} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="降级方式">
                      <Select options={fallbackOptions} placeholder="选择降级方式" />
                    </Form.Item>
                  </Col>
                </Row>
              </div>
            </>
          ) : (
            <Card style={{ background: '#f8fafc', border: `1px solid ${colors.border}`, borderRadius: 8 }}>
              <Space direction="vertical" size="large">
                <Text type="secondary">您没有权限编辑执行配置，请联系管理员</Text>
                <Descriptions bordered column={2} size="small">
                  <Descriptions.Item label="执行方式">{skill.executionType || '-'}</Descriptions.Item>
                  <Descriptions.Item label="HTTP 方法">{skill.httpMethod || '-'}</Descriptions.Item>
                  <Descriptions.Item label="API 端点" span={2}>{skill.endpoint || '-'}</Descriptions.Item>
                  <Descriptions.Item label="请求头" span={2}>
                    <pre style={{ margin: 0, fontSize: 12 }}>{skill.headers || '-'}</pre>
                  </Descriptions.Item>
                  <Descriptions.Item label="认证配置" span={2}>
                    <pre style={{ margin: 0, fontSize: 12 }}>{skill.authConfig || '-'}</pre>
                  </Descriptions.Item>
                </Descriptions>
              </Space>
            </Card>
          )}
        </div>
      ),
    },
    {
      key: 'files',
      label: '附件文件',
      children: (
        <div style={{ maxWidth: 800 }}>
          <div style={{ marginBottom: 16, padding: 16, background: '#f0f9ff', borderRadius: 8, border: '1px solid #bae6fd' }}>
            <Text type="secondary" style={{ fontSize: 13, lineHeight: 1.8 }}>
              一个 Skill 可以捆绑以下类型的附件文件（类似于 zip 包中的资源）：
              <br />
              • <strong>scripts/</strong> — Python/Shell 等可执行脚本，用于确定性/重复性任务
              <br />
              • <strong>templates/</strong> — 输出模板文件（如 Word/Excel 模板）
              <br />
              • <strong>references/</strong> — 引用文档、规范说明等参考资源
              <br />
              • <strong>assets/</strong> — 图标、字体、图片等静态资源
            </Text>
          </div>

          {/* 上传区域 */}
          <div style={{ marginBottom: 16 }}>
            <Upload.Dragger
              multiple
              beforeUpload={handleFileUpload}
              showUploadList={false}
              accept="*"
              disabled={uploading}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
              <p className="ant-upload-hint">
                支持单个或批量上传。文件将以 base64 编码存储在 Skill 中。
              </p>
            </Upload.Dragger>
          </div>

          {/* 已上传文件列表 */}
          {uploadedFiles.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="暂无附件文件，请通过上方上传区域添加"
            />
          ) : (
            <div>
              <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text strong>已添加 {uploadedFiles.length} 个文件</Text>
              </div>
              {uploadedFiles.map((file, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    marginBottom: 4,
                    background: '#fafafa',
                    borderRadius: 6,
                    border: '1px solid #f0f0f0',
                  }}
                >
                  <Space size={8}>
                    <FileTextOutlined style={{ color: '#6366f1' }} />
                    <Text style={{ fontSize: 13 }}>{file.name}</Text>
                    <Tag color="blue" style={{ fontSize: 11 }}>{file.type}/</Tag>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {(file.size / 1024).toFixed(1)} KB
                    </Text>
                  </Space>
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleRemoveFile(idx)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, background: colors.bgMain, minHeight: '100%' }}>
      {/* 标题栏 */}
      <Card
        style={{ background: colors.bgCard, borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: 'none', marginBottom: 24 }}
        bodyStyle={{ padding: 24 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Button icon={<ArrowLeftOutlined />} onClick={handleCancel} style={{ borderRadius: 8 }}>
              返回
            </Button>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: colors.textPrimary, margin: 0 }}>
                编辑 Skill
              </h1>
              <p style={{ fontSize: 14, color: colors.textSecondary, marginTop: 4, marginBottom: 0 }}>
                {skill.name} <code style={{ marginLeft: 8, padding: '2px 8px', background: '#f1f5f9', borderRadius: 4 }}>{skill.namespace}</code>
              </p>
            </div>
          </div>
          <Space>
            <Button onClick={handleCancel} style={{ borderRadius: 8 }}>取消</Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSave}
              loading={saving}
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
          </Space>
        </div>
      </Card>

      {/* Tab 编辑区 */}
      <Card
        style={{ background: colors.bgCard, borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: 'none' }}
        bodyStyle={{ padding: 24 }}
      >
        <Form form={form} layout="vertical">
          <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
        </Form>
      </Card>
    </div>
  );
};

export default SkillEdit;
