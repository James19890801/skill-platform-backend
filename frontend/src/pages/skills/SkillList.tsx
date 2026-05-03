import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Tag, Input, Select, Dropdown, Tooltip, Spin, message } from 'antd';
import { PlusOutlined, SearchOutlined, EyeOutlined, EditOutlined, MoreOutlined, DownloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { SkillStatus, SkillScope, SkillType, SkillDomain, DomainLabels } from '../../types';
import { skillsApi } from '../../services/api';
import SkillInstallModal from '../../components/SkillInstallModal';

const { Search } = Input;

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

const domainColors: Record<string, string> = {
  [SkillDomain.MTL_MARKET]: '#3b82f6',
  [SkillDomain.LTC_SALES]: '#10b981',
  [SkillDomain.ITR_SERVICE]: '#f59e0b',
  [SkillDomain.IPD_RD]: '#8b5cf6',
  [SkillDomain.SCM]: '#06b6d4',
  [SkillDomain.PROCUREMENT]: '#f97316',
  [SkillDomain.MANUFACTURING]: '#84cc16',
  [SkillDomain.DELIVERY]: '#14b8a6',
  [SkillDomain.FINANCE]: colors.green,
  [SkillDomain.HR]: colors.purple,
  [SkillDomain.IT]: '#6366f1',
  [SkillDomain.LEGAL]: colors.primary,
  [SkillDomain.STRATEGY]: '#ec4899',
  [SkillDomain.QUALITY]: '#0ea5e9',
  [SkillDomain.RISK]: colors.red,
  [SkillDomain.ADMIN]: colors.textSecondary,
  [SkillDomain.OTHER]: '#9ca3af',
};

const statusConfig: Record<SkillStatus, { color: string; dotColor: string; label: string }> = {
  [SkillStatus.DRAFT]: { color: colors.textSecondary, dotColor: '#94a3b8', label: '草稿' },
  [SkillStatus.REVIEWING]: { color: colors.primary, dotColor: colors.primary, label: '审核中' },
  [SkillStatus.PUBLISHED]: { color: colors.green, dotColor: colors.green, label: '已发布' },
  [SkillStatus.ARCHIVED]: { color: colors.amber, dotColor: colors.amber, label: '已归档' },
  [SkillStatus.DEPRECATED]: { color: colors.red, dotColor: colors.red, label: '已废弃' },
};

const scopeConfig: Record<SkillScope, { color: string; label: string }> = {
  [SkillScope.PERSONAL]: { color: 'blue', label: '个人' },
  [SkillScope.BUSINESS]: { color: 'green', label: '业务' },
  [SkillScope.PLATFORM]: { color: 'purple', label: '平台' },
};

const SkillList: React.FC = () => {
  const navigate = useNavigate();
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [searchText, setSearchText] = useState('');
  const [domainFilter, setDomainFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  
  // 安装 Modal 状态
  const [installModalVisible, setInstallModalVisible] = useState(false);
  const [installSkill, setInstallSkill] = useState<{ id: number; name: string } | null>(null);

  // 数据状态
  const [loading, setLoading] = useState(true);
  const [skills, setSkills] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, published: 0, draft: 0, reviewing: 0 });
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });

  // 从后端加载 Skill 列表
  useEffect(() => {
    const fetchSkills = async () => {
      try {
        setLoading(true);
        const response = await skillsApi.list({
          page: pagination.current,
          limit: pagination.pageSize,
          domain: (domainFilter || undefined) as SkillDomain | undefined,
          status: (statusFilter || undefined) as SkillStatus | undefined,
          search: searchText || undefined,
        });
        
        // 处理响应数据 - 后端分页返回格式为 { items: [...], total: N }
        // 响应拦截器已解包外层 { success, data }，此时 response 是分页数据本身
        const data = Array.isArray(response) 
          ? response 
          : (response.items || []);
        setSkills(data);
        
        // 计算统计数据
        const total = Array.isArray(response) ? data.length : (response.total || data.length);
        const published = data.filter((s: any) => s.status === SkillStatus.PUBLISHED).length;
        const draft = data.filter((s: any) => s.status === SkillStatus.DRAFT).length;
        const reviewing = data.filter((s: any) => s.status === SkillStatus.REVIEWING).length;
        
        setStats({ total, published, draft, reviewing });
        setPagination(prev => ({ ...prev, total }));
      } catch (error) {
        console.error('加载 Skill 列表失败:', error);
        message.error('加载 Skill 列表失败');
      } finally {
        setLoading(false);
      }
    };
    fetchSkills();
  }, [pagination.current, pagination.pageSize, domainFilter, statusFilter, searchText]);

  const handleInstall = (record: { id: number; name: string }) => {
    setInstallSkill(record);
    setInstallModalVisible(true);
  };

  const moreMenuItems = [
    { key: 'archive', label: '归档' },
    { key: 'delete', label: '删除', danger: true },
  ];

  const columns = [
    {
      title: 'Skill 名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: any) => (
        <div>
          <div style={{ fontWeight: 600, color: colors.textPrimary, cursor: 'pointer' }} onClick={() => navigate(`/skills/${record.id}`)}>
            {text}
          </div>
          <div style={{ fontSize: 12, color: colors.textSecondary, fontFamily: 'monospace' }}>
            {record.namespace}
          </div>
        </div>
      ),
    },
    {
      title: '业务域',
      dataIndex: 'domain',
      key: 'domain',
      width: 100,
      render: (domain: SkillDomain) => (
        <Tag style={{ borderRadius: 10, border: 'none', background: domainColors[domain], color: '#fff' }}>
          {DomainLabels[domain]}
        </Tag>
      ),
    },
    {
      title: '范围',
      dataIndex: 'scope',
      key: 'scope',
      width: 80,
      render: (scope: SkillScope) => {
        const config = scopeConfig[scope];
        return <Tag color={config.color} style={{ borderRadius: 10 }}>{config.label}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: SkillStatus) => {
        const config = statusConfig[status];
        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: config.dotColor }} />
            <span style={{ color: config.color }}>{config.label}</span>
          </span>
        );
      },
    },
    {
      title: '关联流程',
      dataIndex: 'relatedProcess',
      key: 'relatedProcess',
      width: 140,
      render: (process: string | null) => process ? (
        <Tag style={{ borderRadius: 10, background: '#f1f5f9', color: colors.textSecondary, border: 'none' }}>
          {process}
        </Tag>
      ) : (
        <span style={{ color: '#cbd5e1' }}>-</span>
      ),
    },
    {
      title: '负责人',
      dataIndex: 'ownerName',
      key: 'ownerName',
      width: 80,
    },
    {
      title: '版本',
      dataIndex: 'currentVersion',
      key: 'currentVersion',
      width: 80,
      render: (v: string) => <span style={{ fontFamily: 'monospace', color: colors.textSecondary }}>{v}</span>,
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_: unknown, record: any) => (
        <Space size={4}>
          <Tooltip title="查看">
            <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => navigate(`/skills/${record.id}`)} style={{ color: colors.textSecondary }} />
          </Tooltip>
          <Tooltip title="编辑">
            <Button type="text" size="small" icon={<EditOutlined />} style={{ color: colors.textSecondary }} />
          </Tooltip>
          <Tooltip title="安装/分发">
            <Button type="text" size="small" icon={<DownloadOutlined />} onClick={() => handleInstall(record)} style={{ color: colors.primary }} />
          </Tooltip>
          <Dropdown menu={{ items: moreMenuItems }} trigger={['click']}>
            <Button type="text" size="small" icon={<MoreOutlined />} style={{ color: colors.textSecondary }} />
          </Dropdown>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, background: colors.bgMain, minHeight: '100%' }}>
      {/* 顶部标题 + 统计 */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: colors.textPrimary, margin: 0 }}>
              Skill 管理
            </h1>
            <div style={{ marginTop: 12, display: 'flex', gap: 12 }}>
              <Tag style={{ borderRadius: 12, padding: '4px 12px', background: '#fff', border: `1px solid ${colors.border}` }}>
                <span style={{ color: colors.textSecondary }}>总数</span> <span style={{ fontWeight: 600, color: colors.textPrimary, marginLeft: 4 }}>{stats.total}</span>
              </Tag>
              <Tag style={{ borderRadius: 12, padding: '4px 12px', background: '#dcfce7', border: 'none' }}>
                <span style={{ color: colors.green }}>已发布</span> <span style={{ fontWeight: 600, color: colors.green, marginLeft: 4 }}>{stats.published}</span>
              </Tag>
              <Tag style={{ borderRadius: 12, padding: '4px 12px', background: '#f1f5f9', border: 'none' }}>
                <span style={{ color: colors.textSecondary }}>草稿</span> <span style={{ fontWeight: 600, color: colors.textSecondary, marginLeft: 4 }}>{stats.draft}</span>
              </Tag>
              <Tag style={{ borderRadius: 12, padding: '4px 12px', background: '#dbeafe', border: 'none' }}>
                <span style={{ color: colors.primary }}>审核中</span> <span style={{ fontWeight: 600, color: colors.primary, marginLeft: 4 }}>{stats.reviewing}</span>
              </Tag>
            </div>
          </div>
        </div>
      </div>

      {/* 操作栏 */}
      <Card style={{ background: colors.bgCard, borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: 'none', marginBottom: 16 }} bodyStyle={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space size={12}>
            <Search placeholder="搜索 Skill 名称..." allowClear style={{ width: 240 }} prefix={<SearchOutlined style={{ color: colors.textSecondary }} />} value={searchText} onChange={(e) => setSearchText(e.target.value)} />
            <Select placeholder="业务域" allowClear style={{ width: 120 }} value={domainFilter} onChange={setDomainFilter} options={Object.values(SkillDomain).map(d => ({ value: d, label: DomainLabels[d] }))} />
            <Select placeholder="状态" allowClear style={{ width: 120 }} value={statusFilter} onChange={setStatusFilter} options={[
              { value: SkillStatus.PUBLISHED, label: '已发布' },
              { value: SkillStatus.REVIEWING, label: '审核中' },
              { value: SkillStatus.DRAFT, label: '草稿' },
            ]} />
          </Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/skills/create')} style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', border: 'none', borderRadius: 8, height: 36, fontWeight: 500 }}>
            创建 Skill
          </Button>
        </div>
      </Card>

      {/* 表格 */}
      <Card style={{ background: colors.bgCard, borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: 'none' }} bodyStyle={{ padding: 0 }}>
        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={skills}
            rowKey="id"
            pagination={{ 
              current: pagination.current, 
              pageSize: pagination.pageSize, 
              total: pagination.total, 
              showSizeChanger: true, 
              showQuickJumper: true, 
              showTotal: (total) => `共 ${total} 条`,
              onChange: (page, pageSize) => setPagination(prev => ({ ...prev, current: page, pageSize })),
            }}
            onRow={(record) => ({
              onMouseEnter: () => setHoveredRow(record.id),
              onMouseLeave: () => setHoveredRow(null),
              style: { background: hoveredRow === record.id ? '#f8fafc' : 'transparent', transition: 'background 0.15s' },
            })}
            style={{ borderRadius: 16, overflow: 'hidden' }}
          />
        </Spin>
      </Card>

      {/* 安装 Modal */}
      <SkillInstallModal
        visible={installModalVisible}
        skillId={installSkill?.id || 0}
        skillName={installSkill?.name || ''}
        onClose={() => {
          setInstallModalVisible(false);
          setInstallSkill(null);
        }}
      />
    </div>
  );
};

export default SkillList;
