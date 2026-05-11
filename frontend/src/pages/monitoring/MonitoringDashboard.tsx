import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  BellOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { monitoringApi, MonitoringSummaryDTO, OperationalEventDTO } from '../../services/api';

const { Text, Title } = Typography;

const panelStyle: React.CSSProperties = {
  borderRadius: 16,
  border: '1px solid #e5e7eb',
  boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)',
};

function formatUptime(seconds: number) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}天 ${hours}小时`;
  if (hours > 0) return `${hours}小时 ${minutes}分钟`;
  return `${minutes}分钟`;
}

function levelTag(level: OperationalEventDTO['level']) {
  const color = level === 'error' ? 'red' : level === 'warn' ? 'gold' : 'blue';
  const label = level === 'error' ? '异常' : level === 'warn' ? '警告' : '信息';
  return <Tag color={color}>{label}</Tag>;
}

const MonitoringDashboard: React.FC = () => {
  const [summary, setSummary] = useState<MonitoringSummaryDTO | null>(null);
  const [events, setEvents] = useState<OperationalEventDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const [summaryData, eventData] = await Promise.all([
        monitoringApi.summary(),
        monitoringApi.events({ limit: 100 }),
      ]);
      setSummary(summaryData);
      setEvents(eventData || []);
    } catch (error) {
      message.error('监控数据加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 30000);
    return () => window.clearInterval(timer);
  }, []);

  const healthColor = summary?.status === 'ok' ? '#16a34a' : '#dc2626';
  const recentFailureText = useMemo(() => {
    if (!summary) return '';
    if (summary.counters.errors1h > 0) return `过去 1 小时有 ${summary.counters.errors1h} 个异常`;
    if (summary.counters.warnings24h > 0) return `过去 24 小时有 ${summary.counters.warnings24h} 个警告`;
    return '过去 1 小时没有异常';
  }, [summary]);

  const columns = [
    {
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      width: 86,
      render: levelTag,
    },
    {
      title: '事件',
      key: 'event',
      render: (_: unknown, record: OperationalEventDTO) => (
        <Space direction="vertical" size={2}>
          <Space wrap>
            <Text strong>{record.message}</Text>
            <Tag>{record.category}</Tag>
            {record.statusCode ? <Tag color={record.statusCode >= 500 ? 'red' : 'gold'}>{record.statusCode}</Tag> : null}
            {record.durationMs !== undefined ? <Tag>{record.durationMs}ms</Tag> : null}
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {[record.method, record.path, record.requestId ? `requestId ${record.requestId}` : ''].filter(Boolean).join(' · ')}
          </Text>
        </Space>
      ),
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 190,
      render: (value: string) => new Date(value).toLocaleString(),
    },
  ];

  return (
    <div style={{ padding: 24, background: '#f6f8fb', minHeight: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>监控看板</Title>
          <Text type="secondary">请求日志、异常追踪、慢请求和邮件告警状态</Text>
        </div>
        <Button icon={<ReloadOutlined />} loading={loading} onClick={load}>刷新</Button>
      </div>

      <Alert
        style={{ marginBottom: 16 }}
        type={summary?.status === 'ok' ? 'success' : 'error'}
        showIcon
        message={summary?.status === 'ok' ? '系统运行正常' : '系统存在异常'}
        description={
          summary
            ? `${recentFailureText}。邮件告警${summary.emailAlertConfigured ? '已启用' : '未启用'}，收件人 ${summary.alertEmail}。`
            : '正在读取监控状态'
        }
      />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} md={6}>
          <Card style={panelStyle}>
            <Statistic title="系统状态" value={summary?.status === 'ok' ? '正常' : '异常'} valueStyle={{ color: healthColor }} prefix={<ExclamationCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card style={panelStyle}>
            <Statistic title="24小时异常" value={summary?.counters.errors24h || 0} valueStyle={{ color: '#dc2626' }} prefix={<WarningOutlined />} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card style={panelStyle}>
            <Statistic title="24小时事件" value={summary?.counters.events24h || 0} prefix={<ClockCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card style={panelStyle}>
            <Statistic title="邮件告警" value={summary?.emailAlertConfigured ? '已启用' : '待配置'} prefix={<BellOutlined />} />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} md={12}>
          <Card title="最近异常" style={panelStyle}>
            {summary?.recentErrors?.length ? (
              <Space direction="vertical" size={10} style={{ width: '100%' }}>
                {summary.recentErrors.map((event) => (
                  <Alert
                    key={event.id}
                    type="error"
                    showIcon
                    message={event.message}
                    description={`${event.method || ''} ${event.path || ''} ${event.statusCode || ''} · ${new Date(event.createdAt).toLocaleString()}`}
                  />
                ))}
              </Space>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无异常" />
            )}
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="慢请求" style={panelStyle}>
            {summary?.slowRequests?.length ? (
              <Space direction="vertical" size={10} style={{ width: '100%' }}>
                {summary.slowRequests.map((event) => (
                  <Alert
                    key={event.id}
                    type="warning"
                    showIcon
                    message={`${event.method || ''} ${event.path || ''}`}
                    description={`耗时 ${event.durationMs}ms · ${new Date(event.createdAt).toLocaleString()}`}
                  />
                ))}
              </Space>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无慢请求" />
            )}
          </Card>
        </Col>
      </Row>

      <Card
        title="全流程事件"
        extra={summary ? <Tag>已运行 {formatUptime(summary.uptimeSeconds)}</Tag> : null}
        style={panelStyle}
      >
        <Table
          dataSource={events}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 12 }}
          locale={{ emptyText: <Empty description="暂无监控事件" /> }}
        />
      </Card>
    </div>
  );
};

export default MonitoringDashboard;
