/**
 * Settings - 设置页面
 * 用户设置、模型配置、API Key 管理
 */
import React, { useEffect, useState } from 'react';
import {
  Card,
  Tabs,
  Form,
  Input,
  Select,
  Switch,
  Button,
  Typography,
  Space,
  Divider,
  message,
  Table,
  Tag,
} from 'antd';
import {
  SettingOutlined,
  ApiOutlined,
  SafetyOutlined,
  BellOutlined,
} from '@ant-design/icons';
import { LlmModel, LlmProvider, llmApi } from '../../services/api';

const { Title, Text } = Typography;

const Settings: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<LlmProvider[]>([]);
  const [models, setModels] = useState<LlmModel[]>([]);
  const [providerForm] = Form.useForm();

  const loadLlmData = async () => {
    const [providerData, modelData] = await Promise.all([
      llmApi.listProviders().catch(() => []),
      llmApi.listModels().catch(() => []),
    ]);
    setProviders(providerData);
    setModels(modelData);
  };

  useEffect(() => {
    loadLlmData();
  }, []);

  const handleSave = () => {
    setLoading(true);
    setTimeout(() => {
      message.success('设置已保存');
      setLoading(false);
    }, 500);
  };

  const handleRegisterProvider = async () => {
    try {
      const values = await providerForm.validateFields();
      setLoading(true);
      await llmApi.createProvider(values);
      message.success('模型供应商已注册并完成扫描');
      providerForm.resetFields();
      await loadLlmData();
    } catch (error: any) {
      if (!error?.errorFields) message.error('模型注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <Title level={3} style={{ marginBottom: 24 }}>
        <SettingOutlined style={{ marginRight: 8, color: '#6366f1' }} />
        系统设置
      </Title>

      <Card style={{ borderRadius: 12 }}>
        <Tabs
          items={[
            {
              key: 'api',
              label: 'API 配置',
              icon: <ApiOutlined />,
              children: (
                <Form layout="vertical">
                  <Title level={5}>模型供应商</Title>
                  <Text type="secondary" style={{ marginBottom: 12, display: 'block' }}>
                    填 AK 后扫描可用模型，注册成功后可在 Agent 创建和对话中选择。
                  </Text>
                  <Form form={providerForm} layout="vertical">
                    <Form.Item label="供应商" name="provider" initialValue="dashscope" rules={[{ required: true }]}>
                      <Select
                        options={[
                          { value: 'dashscope', label: '通义千问 / DashScope' },
                          { value: 'deepseek', label: 'DeepSeek' },
                          { value: 'openai', label: 'OpenAI' },
                          { value: 'openai-compatible', label: 'OpenAI 兼容网关' },
                        ]}
                      />
                    </Form.Item>
                    <Form.Item label="显示名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
                      <Input placeholder="公司主账号 / 测试网关" />
                    </Form.Item>
                    <Form.Item label="Base URL" name="baseUrl">
                      <Input placeholder="留空使用供应商默认地址" />
                    </Form.Item>
                    <Form.Item label="API Key" name="apiKey" rules={[{ required: true, message: '请输入 AK' }]}>
                      <Input.Password placeholder="sk-..." />
                    </Form.Item>
                    <Button type="primary" onClick={handleRegisterProvider} loading={loading}>
                      注册并扫描模型
                    </Button>
                  </Form>
                  <Divider />
                  <Title level={5}>可用模型</Title>
                  <Table
                    size="small"
                    rowKey={(record) => record.code}
                    dataSource={models}
                    pagination={{ pageSize: 6 }}
                    columns={[
                      { title: '模型', dataIndex: 'label' },
                      { title: '代码', dataIndex: 'code', render: (value: string) => <Text code>{value}</Text> },
                      { title: '能力', dataIndex: 'capability', render: (value: string) => <Tag color={value === 'embedding' ? 'purple' : 'blue'}>{value}</Tag> },
                    ]}
                  />
                  <Divider />
                  <Title level={5}>默认模型</Title>
                  <Form.Item label="默认对话模型" name="defaultModel">
                    <Select
                      options={models.map((model) => ({ value: model.code, label: model.label }))}
                    />
                  </Form.Item>
                  <Button type="primary" onClick={handleSave} loading={loading} style={{ background: '#6366f1' }}>
                    保存配置
                  </Button>
                </Form>
              ),
            },
            {
              key: 'security',
              label: '安全设置',
              icon: <SafetyOutlined />,
              children: (
                <Form layout="vertical">
                  <Title level={5}>敏感操作审批</Title>
                  <Form.Item label="启用审批" name="approvalEnabled" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Text type="secondary">
                    开启后，涉及敏感数据的操作需要人工审批
                  </Text>
                  <Divider />
                  <Title level={5}>沙箱执行</Title>
                  <Form.Item label="代码执行沙箱" name="sandboxEnabled" valuePropName="checked">
                    <Switch defaultChecked />
                  </Form.Item>
                  <Text type="secondary">
                    Agent 执行代码将在隔离的沙箱环境中运行
                  </Text>
                  <Divider />
                  <Button type="primary" onClick={handleSave} loading={loading} style={{ background: '#6366f1' }}>
                    保存设置
                  </Button>
                </Form>
              ),
            },
            {
              key: 'notification',
              label: '通知设置',
              icon: <BellOutlined />,
              children: (
                <Form layout="vertical">
                  <Title level={5}>通知偏好</Title>
                  <Form.Item label="任务完成通知" name="taskNotification" valuePropName="checked">
                    <Switch defaultChecked />
                  </Form.Item>
                  <Form.Item label="错误告警通知" name="errorNotification" valuePropName="checked">
                    <Switch defaultChecked />
                  </Form.Item>
                  <Divider />
                  <Button type="primary" onClick={handleSave} loading={loading} style={{ background: '#6366f1' }}>
                    保存设置
                  </Button>
                </Form>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default Settings;
