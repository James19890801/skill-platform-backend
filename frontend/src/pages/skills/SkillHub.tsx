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
  Rate,
  Tooltip,
  message,
  Modal,
  Descriptions,
} from 'antd';
import {
  SearchOutlined,
  DownloadOutlined,
  EyeOutlined,
  StarOutlined,
  FilterOutlined,
  RocketOutlined,
  CodeOutlined,
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

interface SkillItem {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  category: string;
  tags: string[];
  rating: number;
  installs: number;
  status: 'installed' | 'available' | 'updating';
  instructionsPreview: string;
}

const categories = [
  { value: 'all', label: '全部' },
  { value: '流程管理', label: '流程管理' },
  { value: '文档处理', label: '文档处理' },
  { value: '数据分析', label: '数据分析' },
  { value: '代码开发', label: '代码开发' },
  { value: '自动化', label: '自动化' },
];

const SkillHub: React.FC = () => {
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<SkillItem | null>(null);
  
  // Mock 数据
  const mockSkills: SkillItem[] = [
    {
      id: 'process-analysis',
      name: '流程分析',
      description: '业务流程分析技能，能够解析流程文件、识别关键节点、分析风险点',
      version: '1.0.0',
      author: 'E2E AI',
      category: '流程管理',
      tags: ['流程管理', '业务分析', 'SOP'],
      rating: 4.5,
      installs: 128,
      status: 'installed',
      instructionsPreview: '你是专业的流程分析专家，具备以下能力...',
    },
    {
      id: 'document-generation',
      name: '文档生成',
      description: '根据模板和输入数据自动生成各类业务文档',
      version: '1.2.0',
      author: 'E2E AI',
      category: '文档处理',
      tags: ['文档', '模板', '自动化'],
      rating: 4.2,
      installs: 89,
      status: 'available',
      instructionsPreview: '你是专业的文档生成助手...',
    },
    {
      id: 'risk-assessment',
      name: '风险评估',
      description: '识别业务流程中的风险点并提供评估建议',
      version: '0.9.0',
      author: 'Risk Team',
      category: '数据分析',
      tags: ['风险', '评估', '合规'],
      rating: 3.8,
      installs: 45,
      status: 'available',
      instructionsPreview: '你是风险评估专家...',
    },
    {
      id: 'code-review',
      name: '代码审查',
      description: '自动审查代码质量、发现潜在问题',
      version: '2.0.0',
      author: 'DevTools',
      category: '代码开发',
      tags: ['代码', '审查', '质量'],
      rating: 4.8,
      installs: 256,
      status: 'available',
      instructionsPreview: '你是资深代码审查专家...',
    },
    {
      id: 'workflow-automation',
      name: '工作流自动化',
      description: '将手动流程转换为自动化执行脚本',
      version: '1.5.0',
      author: 'Automation Team',
      category: '自动化',
      tags: ['自动化', '脚本', 'RPA'],
      rating: 4.0,
      installs: 78,
      status: 'updating',
      instructionsPreview: '你是自动化流程设计专家...',
    },
  ];
  
  useEffect(() => {
    loadSkills();
  }, []);
  
  const loadSkills = async () => {
    setLoading(true);
    try {
      // 实际应从 API 加载
      // const response = await fetch('http://localhost:8001/skills');
      // const data = await response.json();
      
      // 使用 mock 数据
      setSkills(mockSkills);
    } catch (error) {
      message.error('加载 Skills 失败');
    } finally {
      setLoading(false);
    }
  };
  
  // 筛选 Skills
  const filteredSkills = skills.filter(skill => {
    const matchSearch = skill.name.toLowerCase().includes(searchText.toLowerCase()) ||
      skill.description.toLowerCase().includes(searchText.toLowerCase());
    const matchCategory = selectedCategory === 'all' || skill.category === selectedCategory;
    return matchSearch && matchCategory;
  });
  
  // 安装 Skill
  const installSkill = async (skillId: string) => {
    message.loading('正在安装...');
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSkills(prev => prev.map(s => 
        s.id === skillId ? { ...s, status: 'installed' } : s
      ));
      message.success('安装成功');
    } catch (error) {
      message.error('安装失败');
    }
  };
  
  // 卸载 Skill
  const uninstallSkill = async (skillId: string) => {
    message.loading('正在卸载...');
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      setSkills(prev => prev.map(s => 
        s.id === skillId ? { ...s, status: 'available' } : s
      ));
      message.success('卸载成功');
    } catch (error) {
      message.error('卸载失败');
    }
  };
  
  // 查看 Skill 详情
  const viewDetail = (skill: SkillItem) => {
    setSelectedSkill(skill);
    setDetailModalVisible(true);
  };
  
  // 渲染 Skill 卡片
  const renderSkillCard = (skill: SkillItem) => {
    const statusColor = {
      installed: 'green',
      available: 'blue',
      updating: 'orange',
    };
    
    return (
      <Col xs={24} sm={12} md={8} lg={6} key={skill.id}>
        <Card
          hoverable
          style={{ height: '100%' }}
          actions={[
            <Tooltip title="查看详情">
              <EyeOutlined onClick={() => viewDetail(skill)} />
            </Tooltip>,
            skill.status === 'installed' ? (
              <Tooltip title="已安装">
                <Tag color="green">已安装</Tag>
              </Tooltip>
            ) : (
              <Tooltip title="安装">
                <DownloadOutlined onClick={() => installSkill(skill.id)} />
              </Tooltip>
            ),
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
                  v{skill.version} · {skill.author}
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
              <Rate disabled defaultValue={skill.rating} style={{ fontSize: 12 }} />
              <Text type="secondary" style={{ fontSize: 12 }}>
                ({skill.installs} 次安装)
              </Text>
            </Space>
            <div style={{ marginTop: 8 }}>
              {skill.tags.map(tag => (
                <Tag key={tag} style={{ marginBottom: 4 }}>{tag}</Tag>
              ))}
            </div>
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
            value={selectedCategory}
            onChange={setSelectedCategory}
            options={categories}
            style={{ width: 150 }}
          />
          <Button icon={<FilterOutlined />}>高级筛选</Button>
          <Button type="primary" icon={<CodeOutlined />}>
            提交 Skill
          </Button>
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
            <Statistic title="已安装" value={skills.filter(s => s.status === 'installed').length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="可更新" value={skills.filter(s => s.status === 'updating').length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="总安装次数" value={skills.reduce((sum, s) => sum + s.installs, 0)} />
          </Card>
        </Col>
      </Row>
      
      {/* Skill 列表 */}
      {loading ? (
        <Spin tip="加载 Skills..." />
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
        footer={[
          selectedSkill?.status === 'installed' ? (
            <Button danger onClick={() => {
              uninstallSkill(selectedSkill!.id);
              setDetailModalVisible(false);
            }}>
              卸载
            </Button>
          ) : (
            <Button type="primary" onClick={() => {
              installSkill(selectedSkill!.id);
              setDetailModalVisible(false);
            }}>
              安装
            </Button>
          ),
          <Button onClick={() => setDetailModalVisible(false)}>关闭</Button>,
        ]}
        width={600}
      >
        {selectedSkill && (
          <Descriptions column={2}>
            <Descriptions.Item label="版本">{selectedSkill.version}</Descriptions.Item>
            <Descriptions.Item label="作者">{selectedSkill.author}</Descriptions.Item>
            <Descriptions.Item label="分类">{selectedSkill.category}</Descriptions.Item>
            <Descriptions.Item label="评分">
              <Rate disabled defaultValue={selectedSkill.rating} />
            </Descriptions.Item>
            <Descriptions.Item label="安装次数">{selectedSkill.installs}</Descriptions.Item>
            <Descriptions.Item label="标签">
              {selectedSkill.tags.map(tag => <Tag key={tag}>{tag}</Tag>)}
            </Descriptions.Item>
            <Descriptions.Item label="描述" span={2}>
              {selectedSkill.description}
            </Descriptions.Item>
            <Descriptions.Item label="指令预览" span={2}>
              <Paragraph ellipsis={{ rows: 4, expandable: true }}>
                {selectedSkill.instructionsPreview}
              </Paragraph>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

// 统计组件
const Statistic: React.FC<{ title: string; value: number }> = ({ title, value }) => (
  <div>
    <Text type="secondary">{title}</Text>
    <Title level={4} style={{ margin: 0 }}>{value}</Title>
  </div>
);

export default SkillHub;