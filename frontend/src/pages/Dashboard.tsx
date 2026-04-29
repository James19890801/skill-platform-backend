import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Table, Tag, Progress, Timeline, Spin, Empty, message } from 'antd';
import {
  ApartmentOutlined,
  FileTextOutlined,
  PieChartOutlined,
  WarningOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  SearchOutlined,
  PlusOutlined,
  AuditOutlined,
} from '@ant-design/icons';
import { Pie } from '@ant-design/charts';
import { useNavigate } from 'react-router-dom';
import { dashboardApi } from '../services/api';
import { useAuthStore } from '../stores/useAuthStore';

const styles = {
  page: {
    padding: '24px',
    background: '#f0f4f8',
    minHeight: '100vh',
  },
  header: {
    marginBottom: '24px',
  },
  title: {
    fontSize: '28px',
    fontWeight: 'bold' as const,
    color: '#1e293b',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#64748b',
  },
  statCard: {
    borderRadius: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    overflow: 'hidden',
    transition: 'transform 0.2s',
  },
  statCardContent: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px',
  },
  colorBar: {
    width: '4px',
    height: '100%',
    position: 'absolute' as const,
    left: 0,
    top: 0,
    bottom: 0,
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#1e293b',
    marginBottom: '16px',
  },
  contentCard: {
    borderRadius: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    height: '100%',
  },
  quickActionCard: {
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    cursor: 'pointer',
    transition: 'all 0.2s',
    textAlign: 'center' as const,
    padding: '16px',
  },
  gapItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 0',
    borderBottom: '1px solid #f0f0f0',
  },
};

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, tenant } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<{
    totalSkills: number;
    publishedSkills: number;
    pendingReviews: number;
    totalOrgs: number;
    totalModels: number;
    skillsByDomain: Record<string, number>;
  } | null>(null);

  // 加载真实统计数据
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const data = await dashboardApi.getStats();
        setDashboardData(data);
      } catch (error) {
        console.error('获取统计数据失败:', error);
        message.error('获取统计数据失败，使用默认数据展示');
        // 使用默认数据作为降级方案
        setDashboardData({
          totalSkills: 0,
          publishedSkills: 0,
          pendingReviews: 0,
          totalOrgs: 0,
          totalModels: 0,
          skillsByDomain: {},
        });
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  // 顶部指标数据（使用真实数据）
  const statsData = dashboardData ? [
    { title: '业务流程数', value: dashboardData.totalOrgs, icon: <ApartmentOutlined />, color: '#2563eb', trend: '+3', trendText: '本月' },
    { title: 'Skill 总量', value: dashboardData.totalSkills, icon: <FileTextOutlined />, color: '#10b981', trend: '+8', trendText: '本月' },
    { title: 'Skill 覆盖率', value: dashboardData.publishedSkills > 0 ? Math.round((dashboardData.publishedSkills / dashboardData.totalSkills) * 100) || 0 : 0, suffix: '%', icon: <PieChartOutlined />, color: '#f59e0b', trend: '↑5%', trendText: '' },
    { title: '待审核', value: dashboardData.pendingReviews, icon: <WarningOutlined />, color: '#ef4444', trend: '-4', trendText: '本月', trendDown: true },
  ] : [];

  // 流程覆盖数据
  const processCoverageData = [
    { key: '1', name: '合同审批流程', domain: '法务', sopCount: 5, requiredSkills: 12, existingSkills: 10, coverage: 83 },
    { key: '2', name: '报账处理流程', domain: '财务', sopCount: 7, requiredSkills: 15, existingSkills: 9, coverage: 60 },
    { key: '3', name: '供应商准入流程', domain: '采购', sopCount: 6, requiredSkills: 10, existingSkills: 4, coverage: 40 },
    { key: '4', name: '员工入职流程', domain: '人力', sopCount: 8, requiredSkills: 18, existingSkills: 13, coverage: 72 },
    { key: '5', name: '代码发布流程', domain: '技术', sopCount: 4, requiredSkills: 8, existingSkills: 7, coverage: 88 },
    { key: '6', name: '发票中心处理', domain: '财务', sopCount: 5, requiredSkills: 11, existingSkills: 6, coverage: 55 },
    { key: '7', name: '专利申请流程', domain: '法务', sopCount: 4, requiredSkills: 9, existingSkills: 5, coverage: 56 },
    { key: '8', name: '预算编制流程', domain: '财务', sopCount: 6, requiredSkills: 14, existingSkills: 11, coverage: 79 },
  ];

  // 域颜色映射
  const domainColors: Record<string, string> = {
    '法务': '#2563eb',
    '财务': '#10b981',
    '采购': '#f59e0b',
    '人力': '#8b5cf6',
    '技术': '#06b6d4',
    '平台': '#ec4899',
  };

  // 表格列定义
  const columns = [
    { title: '流程名称', dataIndex: 'name', key: 'name', render: (text: string) => <span style={{ fontWeight: 500 }}>{text}</span> },
    { 
      title: '所属域', 
      dataIndex: 'domain', 
      key: 'domain',
      render: (domain: string) => <Tag color={domainColors[domain]}>{domain}</Tag>
    },
    { title: 'SOP数', dataIndex: 'sopCount', key: 'sopCount', align: 'center' as const },
    { title: '需要Skill', dataIndex: 'requiredSkills', key: 'requiredSkills', align: 'center' as const },
    { title: '已有Skill', dataIndex: 'existingSkills', key: 'existingSkills', align: 'center' as const },
    { 
      title: '覆盖率', 
      dataIndex: 'coverage', 
      key: 'coverage',
      width: 150,
      render: (coverage: number) => {
        const color = coverage < 40 ? '#ef4444' : coverage < 70 ? '#f59e0b' : '#10b981';
        return <Progress percent={coverage} size="small" strokeColor={color} />;
      }
    },
  ];

  // 时间线数据
  const timelineData = [
    { time: '10:30', user: '张华', content: '从报账处理流程中挖掘了 3 个新 Skill', color: '#10b981' },
    { time: '09:45', user: '李明', content: '发布了「合同条款审核」Skill', color: '#2563eb' },
    { time: '09:20', user: '王芳', content: '创建了员工入职流程的 2 个 SOP', color: '#8b5cf6' },
    { time: '昨天', user: '陈伟', content: '完成了供应商准入流程的 Skill 盘点', color: '#f59e0b' },
    { time: '昨天', user: '刘洋', content: '审核通过「发票识别」Skill', color: '#10b981' },
    { time: '前天', user: '赵雪', content: '新建了代码发布流程', color: '#2563eb' },
  ];

  // Skill 域分布数据（使用真实数据）
  const pieData = dashboardData?.skillsByDomain
    ? Object.entries(dashboardData.skillsByDomain).map(([type, value]) => ({
        type: domainLabels[type] || type,
        value,
      }))
    : [
        { type: '法务', value: 0 },
        { type: '财务', value: 0 },
        { type: '采购', value: 0 },
        { type: '人力资源', value: 0 },
        { type: '技术', value: 0 },
        { type: '平台', value: 0 },
      ];

  // 域标签映射
  const domainLabels: Record<string, string> = {
    legal: '法务',
    finance: '财务',
    procurement: '采购',
    hr: '人力资源',
    tech: '技术',
    platform: '平台',
  };

  const totalSkillCount = pieData.reduce((sum, item) => sum + item.value, 0);

  const pieConfig = {
    data: pieData,
    angleField: 'value',
    colorField: 'type',
    radius: 1,
    innerRadius: 0.6,
    label: {
      text: 'value',
      style: { fontWeight: 'bold' },
    },
    legend: {
      color: {
        position: 'right' as const,
        rowPadding: 5,
      },
    },
    annotations: [
      {
        type: 'text',
        style: {
          text: String(totalSkillCount),
          x: '50%',
          y: '50%',
          textAlign: 'center',
          fontSize: 28,
          fontWeight: 'bold',
        },
      },
    ],
    color: ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899'],
  };

  // 能力缺口 Top 5
  const gapData = [
    { name: '电子签章操作', process: '合同审批流程', urgency: '高' },
    { name: '业务合规校验', process: '合同审批流程', urgency: '高' },
    { name: '费用智能分摊', process: '报账处理流程', urgency: '中' },
    { name: '供应商资质验证', process: '供应商准入流程', urgency: '中' },
    { name: '历史合同检索', process: '合同审批流程', urgency: '低' },
  ];

  const urgencyColors: Record<string, string> = { '高': '#ef4444', '中': '#f59e0b', '低': '#10b981' };

  // 快捷操作
  const quickActions = [
    { title: '盘点 SOP', icon: <SearchOutlined style={{ fontSize: 24, color: '#10b981' }} />, path: '/mining', color: '#ecfdf5' },
    { title: '流程画布', icon: <ApartmentOutlined style={{ fontSize: 24, color: '#2563eb' }} />, path: '/process', color: '#eff6ff' },
    { title: '创建 Skill', icon: <PlusOutlined style={{ fontSize: 24, color: '#8b5cf6' }} />, path: '/skills/create', color: '#f5f3ff' },
    { title: '审核中心', icon: <AuditOutlined style={{ fontSize: 24, color: '#f59e0b' }} />, path: '/reviews', color: '#fffbeb' },
  ];

  // 加载状态
  if (loading) {
    return (
      <div style={{ ...styles.page, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div style={{ ...styles.page, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Empty description="无法获取数据" />
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* 顶部标题 */}
      <div style={styles.header}>
        <div style={{ fontSize: 16, color: '#64748b', marginBottom: 8 }}>
          欢迎回来，{tenant?.name || user?.tenantName || '默认租户'} - {user?.name || '用户'}
        </div>
        <div style={styles.title}>流程全景仪表板</div>
        <div style={styles.subtitle}>从流程视角出发，掌握组织 Skill 能力覆盖全貌</div>
      </div>

      {/* 顶部指标卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {statsData.map((stat, index) => (
          <Col span={6} key={index}>
            <Card 
              style={{ ...styles.statCard, position: 'relative' }}
              bodyStyle={{ padding: '24px', paddingLeft: '28px' }}
              hoverable
            >
              <div style={{ ...styles.colorBar, backgroundColor: stat.color }} />
              <Statistic
                title={<span style={{ color: '#64748b', fontSize: 14 }}>{stat.title}</span>}
                value={stat.value}
                suffix={stat.suffix}
                prefix={React.cloneElement(stat.icon, { style: { color: stat.color, marginRight: 8 } })}
                valueStyle={{ color: '#1e293b', fontWeight: 'bold' }}
              />
              <div style={{ marginTop: 8, fontSize: 12, color: stat.trendDown ? '#10b981' : '#64748b' }}>
                {stat.trendDown ? <ArrowDownOutlined style={{ color: '#10b981' }} /> : null}
                {!stat.trendDown && stat.trend.startsWith('+') ? <ArrowUpOutlined style={{ color: '#10b981' }} /> : null}
                <span style={{ marginLeft: 4, color: stat.trendDown ? '#10b981' : stat.trend.includes('↑') ? '#10b981' : '#64748b' }}>
                  {stat.trend} {stat.trendText}
                </span>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 主体区域 */}
      <Row gutter={24}>
        {/* 左列 */}
        <Col span={14}>
          {/* 流程 Skill 覆盖全景 */}
          <Card title={<span style={styles.sectionTitle}>流程 Skill 覆盖全景</span>} style={{ ...styles.contentCard, marginBottom: 24 }}>
            <Table 
              columns={columns} 
              dataSource={processCoverageData} 
              pagination={false}
              size="small"
            />
          </Card>

          {/* 最新动态 */}
          <Card title={<span style={styles.sectionTitle}>最新动态</span>} style={styles.contentCard}>
            <Timeline
              items={timelineData.map(item => ({
                color: item.color,
                children: (
                  <div>
                    <span style={{ color: '#64748b', fontSize: 12 }}>{item.time}</span>
                    <span style={{ marginLeft: 8, fontWeight: 500 }}>{item.user}</span>
                    <span style={{ marginLeft: 8, color: '#1e293b' }}>{item.content}</span>
                  </div>
                ),
              }))}
            />
          </Card>
        </Col>

        {/* 右列 */}
        <Col span={10}>
          {/* Skill 域分布 */}
          <Card title={<span style={styles.sectionTitle}>Skill 域分布</span>} style={{ ...styles.contentCard, marginBottom: 24 }}>
            <div style={{ height: 250 }}>
              <Pie {...pieConfig} />
            </div>
          </Card>

          {/* 待建设能力 Top 5 */}
          <Card title={<span style={styles.sectionTitle}>待建设能力 Top 5</span>} style={{ ...styles.contentCard, marginBottom: 24 }}>
            {gapData.map((item, index) => (
              <div key={index} style={styles.gapItem}>
                <div>
                  <span style={{ fontWeight: 500, color: '#1e293b' }}>{item.name}</span>
                  <span style={{ marginLeft: 8, color: '#64748b', fontSize: 12 }}>关联：{item.process}</span>
                </div>
                <Tag color={urgencyColors[item.urgency]}>{item.urgency}</Tag>
              </div>
            ))}
          </Card>

          {/* 快捷操作 */}
          <Card title={<span style={styles.sectionTitle}>快捷操作</span>} style={styles.contentCard}>
            <Row gutter={[12, 12]}>
              {quickActions.map((action, index) => (
                <Col span={12} key={index}>
                  <div 
                    style={{ ...styles.quickActionCard, background: action.color }}
                    onClick={() => navigate(action.path)}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
                  >
                    {action.icon}
                    <div style={{ marginTop: 8, fontWeight: 500, color: '#1e293b' }}>{action.title}</div>
                  </div>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
