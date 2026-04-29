/**
 * Settings - 设置页面
 * 用户设置、模型配置、API Key 管理
 */
import React, { useState } from 'react';
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
} from 'antd';
import {
  SettingOutlined,
  ApiOutlined,
  SafetyOutlined,
  BellOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

const Settings: React.FC = () => {
  const [loading, setLoading] = useState(false);

  const handleSave = () => {
    setLoading(true);
    setTimeout(() => {
      message.success('设置已保存');
      setLoading(false);
    }, 500);
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
                  <Title level={5}>阿里云百炼 API</Title>
                  <Text type="secondary" style={{ marginBottom: 12, display: 'block' }}>
                    使用 OpenAI 兼容协议调用百炼模型
                  </Text>
                  <Form.Item 
                    label="API Key" 
                    name="bailianApiKey"
                    extra="在阿里云控制台 → DashScope → API-KEY管理 中获取"
                  >
                    <Input.Password placeholder="sk-xxxxxxxxxxxxxxxx" />
                  </Form.Item>
                  <Form.Item 
                    label="Base URL" 
                    name="bailianBaseUrl"
                    extra="OpenAI 兼容模式地址，无需修改"
                  >
                    <Input 
                      defaultValue="https://dashscope.aliyuncs.com/compatible-mode/v1"
                      placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
                    />
                  </Form.Item>
                  <Divider />
                  <Title level={5}>默认模型</Title>
                  <Form.Item label="默认对话模型" name="defaultModel">
                    <Select
                      options={[
                        { value: 'qwen-turbo', label: '通义千问 Turbo' },
                        { value: 'qwen-plus', label: '通义千问 Plus' },
                        { value: 'qwen-max', label: '通义千问 Max' },
                      ]}
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