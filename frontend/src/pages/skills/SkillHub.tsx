/**
 * SkillHub - Skill 市场页面
 * 展示可用的 Skills，支持安装/卸载/查看详情
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Statistic,
} from 'antd';
import {
  SearchOutlined,
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
  mtl_market: '市场管理',
  ltc_sales: '销售管理',
  itr_service: '客户服务',
  ipd_rd: '产品研发',
  scm: '供应链',
  procurement: '采购',
  manufacturing: '制造',
  delivery: '交付',
  finance: '财务',
  hr: '人力资源',
  it: '信息技术',
  legal: '法务合规',
  strategy: '战略管理',
  quality: '质量管理',
  risk: '风险管理',
  admin: '行政管理',
  other: '其他',
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
  const navigate = useNavigate();

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
    navigate(`/skills/${skill.id}`);
  };

  // 打开编辑
  const openEdit = (skill: SkillItem) => {
    navigate(`/skills/edit/${skill.id}`);
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
      {/* 顶部操作栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1e293b' }}>Skill 市场</h2>
        <Button type="primary" onClick={() => navigate('/skills/create')}>
          + 新建 Skill
        </Button>
      </div>

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
              { value: 'mtl_market', label: '市场管理' },
              { value: 'ltc_sales', label: '销售管理' },
              { value: 'itr_service', label: '客户服务' },
              { value: 'ipd_rd', label: '产品研发' },
              { value: 'scm', label: '供应链' },
              { value: 'procurement', label: '采购' },
              { value: 'manufacturing', label: '制造' },
              { value: 'delivery', label: '交付' },
              { value: 'finance', label: '财务' },
              { value: 'hr', label: '人力资源' },
              { value: 'it', label: '信息技术' },
              { value: 'legal', label: '法务合规' },
              { value: 'strategy', label: '战略管理' },
              { value: 'quality', label: '质量管理' },
              { value: 'risk', label: '风险管理' },
              { value: 'admin', label: '行政管理' },
              { value: 'other', label: '其他' },
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

    </div>
  );
};

export default SkillHub;