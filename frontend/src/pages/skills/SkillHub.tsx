/**
 * SkillHub - Skill 市场页面
 * 展示可用的 Skills，支持安装/卸载/查看详情
 */
import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Typography,
  Tag,
  Button,
  Space,
  Input,
  Select,
  Empty,
  Spin,
  Avatar,
  Tooltip,
  message,
  Modal,
  Descriptions,
  Statistic,
  Form,
} from 'antd';
import {
  SearchOutlined,
  DownloadOutlined,
  EyeOutlined,
  EditOutlined,
  FilterOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import apiClient from '../../services/api';

const { Title, Text, Paragraph } = Typography;

// 后端 Skill 数据的字段映射
interface SkillItem {
  id: number;
  name: string;
  description: string;
  version: string;
  domain: string;
  subDomain: string;
  status: string;
  ownerName: string;
  orgName: string;
}

const domainLabelMap: Record<string, string> = {
  legal: '法务',
  finance: '财务',
  procurement: '采购',
  hr: '人力资源',
  tech: '技术',
  platform: '平台',
};

const statusLabelMap: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'blue' },
  reviewing: { label: '审核中', color: 'orange' },
  published: { label: '已发布', color: 'green' },
  archived: { label: '已归档', color: 'default' },
  deprecated: { label: '已弃用', color: 'red' },
};

const SkillHub: React.FC = () => {
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('all');
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<SkillItem | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingSkill, setEditingSkill] = useState<SkillItem | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [form] = Form.useForm();

  // 从后端获取 Skills
  const loadSkills = async () => {
    setLoading(true);
    try {
      const res: any = await apiClient.get('/skills', { params: { page: 1, limit: 100 } });
      const data = res?.items || [];
      setSkills(data.map((s: any) => ({
        id: s.id,
        name: s.name,
        description: s.description || '',
        version: s.currentVersion || '1.0.0',
        domain: s.domain || 'platform',
        subDomain: s.subDomain || '',
        status: s.status || 'published',
        ownerName: s.owner?.name || '系统',
        orgName: s.organization?.name || '平台',
      })));
    } catch (error) {
      console.error('加载 Skills 失败:', error);
      message.error('加载 Skills 失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSkills();
  }, []);

  // 筛选 Skills
  const filteredSkills = skills.filter(skill => {
    const matchSearch = skill.name.toLowerCase().includes(searchText.toLowerCase()) ||
      skill.description.toLowerCase().includes(searchText.toLowerCase());
    const matchDomain = selectedDomain === 'all' || skill.domain === selectedDomain;
    return matchSearch && matchDomain;
  });

  // 查看详情
  const viewDetail = (skill: SkillItem) => {
    setSelectedSkill(skill);
    setDetailModalVisible(true);
  };

  // 打开编辑弹窗
  const openEdit = (skill: SkillItem) => {
    setEditingSkill(skill);
    form.setFieldsValue({
      name: skill.name,
      description: skill.description,
      domain: skill.domain,
      subDomain: skill.subDomain || '',
      abilityName: skill.abilityName || '',
      namespace: skill.namespace || '',
      scope: skill.scope || 'business',
      type: skill.type || 'light-tech',
      sopSource: skill.sopSource || '',
      executionType: skill.executionType || 'manual',
      endpoint: skill.endpoint || '',
      httpMethod: skill.httpMethod || 'POST',
      agentPrompt: skill.agentPrompt || '',
      toolDefinition: typeof skill.toolDefinition === 'object' ? JSON.stringify(skill.toolDefinition, null, 2) : skill.toolDefinition || '',
    });
    setEditModalVisible(true);
  };

  // 提交编辑
  const handleEditSave = async () => {
    if (!editingSkill) return;
    try {
      setEditLoading(true);
      const values = await form.validateFields();
      const payload: Record<string, any> = {};
      for (const key of Object.keys(values)) {
        if (values[key] !== undefined && values[key] !== '') {
          payload[key] = values[key];
        }
      }
      await apiClient.put(`/skills/${editingSkill.id}`, payload);
      message.success('Skill 已更新');
      setEditModalVisible(false);
      loadSkills();
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) return;
      message.error('更新失败');
    } finally {
      setEditLoading(false);
    }
  };

  // 渲染 Skill 卡片
  const renderSkillCard = (skill: SkillItem) => {
    const statusConfig = statusLabelMap[skill.status] || { label: skill.status, color: 'default' };

    return (
      <Col xs={24} sm={12} md={8} lg={6} key={skill.id}>
        <Card
          hoverable
          style={{ height: '100%' }}
          actions={[
            <Tooltip title="查看详情">
              <EyeOutlined onClick={() => viewDetail(skill)} />
            </Tooltip>,
            <Tooltip title="编辑">
              <EditOutlined style={{ color: '#1890ff' }} onClick={() => openEdit(skill)} />
            </Tooltip>,
            <Tag color={statusConfig.color}>{statusConfig.label}</Tag>,
          ]}
        >
          <Card.Meta
            avatar={
              <Avatar
                style={{ backgroundColor: '#1890ff' }}
                icon={<RocketOutlined />}
              />
            }
            title={skill.name}
            description={
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  v{skill.version} · {skill.ownerName}
                </Text>
                <Paragraph
                  ellipsis={{ rows: 2 }}
                  style={{ marginTop: 8, marginBottom: 0 }}
                >
                  {skill.description}
                </Paragraph>
              </div>
            }
          />
          <div style={{ marginTop: 12 }}>
            <Space>
              <Tag>{domainLabelMap[skill.domain] || skill.domain}</Tag>
              {skill.subDomain && <Tag>{skill.subDomain}</Tag>}
            </Space>
          </div>
        </Card>
      </Col>
    );
  };

  return (
    <div>
      {/* 搜索与筛选 */}
      <Card style={{ marginBottom: 16 }}>
        <Space size="large" wrap>
          <Input
            placeholder="搜索 Skill..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            style={{ width: 300 }}
            allowClear
          />
          <Select
            value={selectedDomain}
            onChange={setSelectedDomain}
            options={[
              { value: 'all', label: '全部领域' },
              { value: 'legal', label: '法务' },
              { value: 'finance', label: '财务' },
              { value: 'procurement', label: '采购' },
              { value: 'hr', label: '人力资源' },
              { value: 'tech', label: '技术' },
              { value: 'platform', label: '平台' },
            ]}
            style={{ width: 150 }}
          />
          <Button icon={<FilterOutlined />}>高级筛选</Button>
        </Space>
      </Card>

      {/* 统计 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="总 Skills" value={skills.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="已发布" value={skills.filter(s => s.status === 'published').length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="草稿" value={skills.filter(s => s.status === 'draft').length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="领域数" value={new Set(skills.map(s => s.domain)).size} />
          </Card>
        </Col>
      </Row>

      {/* Skill 列表 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" />
        </div>
      ) : filteredSkills.length === 0 ? (
        <Empty description="没有找到匹配的 Skill" />
      ) : (
        <Row gutter={[16, 16]}>
          {filteredSkills.map(renderSkillCard)}
        </Row>
      )}

      {/* 详情 Modal */}
      <Modal
        title={selectedSkill?.name}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={<Button onClick={() => setDetailModalVisible(false)}>关闭</Button>}
        width={600}
      >
        {selectedSkill && (
          <Descriptions column={2}>
            <Descriptions.Item label="版本">{selectedSkill.version}</Descriptions.Item>
            <Descriptions.Item label="所属组织">{selectedSkill.orgName}</Descriptions.Item>
            <Descriptions.Item label="领域">
              {domainLabelMap[selectedSkill.domain] || selectedSkill.domain}
            </Descriptions.Item>
            <Descriptions.Item label="子领域">{selectedSkill.subDomain || '-'}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={(statusLabelMap[selectedSkill.status] || { color: 'default' }).color}>
                {(statusLabelMap[selectedSkill.status] || { label: selectedSkill.status }).label}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="负责人">{selectedSkill.ownerName}</Descriptions.Item>
            <Descriptions.Item label="描述" span={2}>
              {selectedSkill.description}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* 编辑 Modal - 全字段编辑 */}
      <Modal
        title={`编辑 Skill: ${editingSkill?.name}`}
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onOk={handleEditSave}
        confirmLoading={editLoading}
        okText="保存"
        cancelText="取消"
        width={720}
        style={{ top: 20 }}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#1e293b', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #e2e8f0' }}>基本信息</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
              <Input placeholder="名称" />
            </Form.Item>
            <Form.Item label="命名空间" name="namespace">
              <Input placeholder="如 legal.contract.risk-check" />
            </Form.Item>
            <Form.Item label="领域" name="domain">
              <Input placeholder="legal/finance/procurement/hr/tech/platform" />
            </Form.Item>
            <Form.Item label="子领域" name="subDomain">
              <Input placeholder="如 contract/litigation" />
            </Form.Item>
            <Form.Item label="能力名称" name="abilityName">
              <Input placeholder="能力名称" />
            </Form.Item>
            <Form.Item label="SOP来源" name="sopSource">
              <Input placeholder="SOP文档链接" />
            </Form.Item>
            <Form.Item label="范围" name="scope">
              <Select>
                <Select.Option value="personal">个人</Select.Option>
                <Select.Option value="business">业务</Select.Option>
                <Select.Option value="platform">平台</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item label="类型" name="type">
              <Select>
                <Select.Option value="pure-business">纯业务型</Select.Option>
                <Select.Option value="light-tech">轻技术型</Select.Option>
                <Select.Option value="heavy-tech">重技术型</Select.Option>
              </Select>
            </Form.Item>
          </div>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={3} placeholder="描述" />
          </Form.Item>

          <div style={{ fontSize: 15, fontWeight: 600, color: '#1e293b', margin: '24px 0 12px', paddingBottom: 8, borderBottom: '1px solid #e2e8f0' }}>执行配置</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Form.Item label="执行类型" name="executionType">
              <Select>
                <Select.Option value="manual">手动执行</Select.Option>
                <Select.Option value="api">API 调用</Select.Option>
                <Select.Option value="webhook">Webhook</Select.Option>
                <Select.Option value="agent">AI Agent</Select.Option>
                <Select.Option value="rpa">RPA 脚本</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item label="API端点" name="endpoint">
              <Input placeholder="https://..." />
            </Form.Item>
            <Form.Item label="HTTP方法" name="httpMethod">
              <Select>
                <Select.Option value="GET">GET</Select.Option>
                <Select.Option value="POST">POST</Select.Option>
                <Select.Option value="PUT">PUT</Select.Option>
                <Select.Option value="DELETE">DELETE</Select.Option>
              </Select>
            </Form.Item>
          </div>

          <div style={{ fontSize: 15, fontWeight: 600, color: '#1e293b', margin: '24px 0 12px', paddingBottom: 8, borderBottom: '1px solid #e2e8f0' }}>Agent 定义</div>
          <Form.Item label="Agent Prompt" name="agentPrompt">
            <Input.TextArea rows={4} placeholder="Agent 系统提示词" />
          </Form.Item>
          <Form.Item label="工具定义 (JSON)" name="toolDefinition">
            <Input.TextArea rows={4} placeholder='[{"name":"functionName","description":"..."}]' />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SkillHub;