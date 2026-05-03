import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Spin, Empty, message } from 'antd';
import {
  FileTextOutlined,
  PieChartOutlined,
  WarningOutlined,
  ApartmentOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons';
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
  colorBar: {
    width: '4px',
    height: '100%',
    position: 'absolute' as const,
    left: 0,
    top: 0,
    bottom: 0,
  },
};

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<{
    totalSkills: number;
    publishedSkills: number;
    pendingReviews: number;
    domainStats: Array<{ domain: string; count: number; published: number }>;
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
        setDashboardData({
          totalSkills: 0,
          publishedSkills: 0,
          pendingReviews: 0,
          domainStats: [],
        });
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  // 顶部指标数据
  const statsData = dashboardData ? [
    { title: 'Skill 总量', value: dashboardData.totalSkills, icon: <FileTextOutlined />, color: '#10b981', trend: '+8', trendText: '本月' },
    { title: '已发布', value: dashboardData.publishedSkills, icon: <PieChartOutlined />, color: '#f59e0b', trend: '↑5%', trendText: '' },
    { title: '待审核', value: dashboardData.pendingReviews, icon: <WarningOutlined />, color: '#ef4444', trend: '-4', trendText: '本月', trendDown: true },
    { title: '领域数', value: dashboardData.domainStats?.length || 0, icon: <ApartmentOutlined />, color: '#2563eb', trend: '+3', trendText: '本月' },
  ] : [];

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
          欢迎回来，{user?.email || '用户'}
        </div>
        <div style={styles.title}>Skill 管理平台</div>
        <div style={styles.subtitle}>管理和运营企业技能资产</div>
      </div>

      {/* 顶部指标卡片 */}
      <Row gutter={16}>
        {statsData.map((stat, index) => (
          <Col span={6} key={index}>
            <Card 
              style={{ ...styles.statCard, position: 'relative' }}
              styles={{ body: { padding: '24px', paddingLeft: '28px' } }}
              hoverable
            >
              <div style={{ ...styles.colorBar, backgroundColor: stat.color }} />
              <Statistic
                title={<span style={{ color: '#64748b', fontSize: 14 }}>{stat.title}</span>}
                value={stat.value}
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
    </div>
  );
};

export default Dashboard;
