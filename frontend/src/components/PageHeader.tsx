import React from 'react';
import { Typography, Space, Breadcrumb, Button } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Text } = Typography;

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  breadcrumb?: Array<{ title: string; path?: string }>;
  extra?: React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  showBack = false,
  breadcrumb,
  extra,
}) => {
  const navigate = useNavigate();

  return (
    <div className="page-header">
      {breadcrumb && breadcrumb.length > 0 && (
        <Breadcrumb
          style={{ marginBottom: 16 }}
          items={breadcrumb.map((item) => ({
            title: item.path ? (
              <a onClick={() => navigate(item.path!)}>{item.title}</a>
            ) : (
              item.title
            ),
          }))}
        />
      )}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Space align="start">
          {showBack && (
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate(-1)}
              style={{ marginRight: 8, marginTop: 4 }}
            />
          )}
          <div>
            <h1 className="page-header-title">
              {title}
            </h1>
            {subtitle && (
              <Text className="page-header-subtitle">
                {subtitle}
              </Text>
            )}
          </div>
        </Space>
        {extra && <div style={{ display: 'flex', alignItems: 'center' }}>{extra}</div>}
      </div>
    </div>
  );
};

export default PageHeader;
