import React from 'react';
import { Modal, Button, Typography, Space } from 'antd';
import { LoginOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Text, Title } = Typography;

interface LoginModalProps {
  visible: boolean;
  onClose: () => void;
  /** 登录后跳转的目标路径 */
  redirectTo?: string;
}

const LoginModal: React.FC<LoginModalProps> = ({ visible, onClose, redirectTo }) => {
  const navigate = useNavigate();

  const handleGoLogin = () => {
    onClose();
    navigate('/login', { state: { from: redirectTo || window.location.pathname } });
  };

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      footer={null}
      width={400}
      centered
      closable
    >
      <div style={{ textAlign: 'center', padding: '24px 0' }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
          }}
        >
          <UserOutlined style={{ fontSize: 28, color: '#fff' }} />
        </div>

        <Title level={4} style={{ marginBottom: 8 }}>
          当前是访客模式
        </Title>

        <Text type="secondary" style={{ fontSize: 14, display: 'block', marginBottom: 24, lineHeight: 1.8 }}>
          需要登录后才能创建资源
          <br />
          输入邮箱和手机号即可一键登录 / 注册
        </Text>

        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Button
            type="primary"
            size="large"
            block
            icon={<LoginOutlined />}
            onClick={handleGoLogin}
            style={{
              height: 44,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              fontWeight: 500,
            }}
          >
            去登录
          </Button>
          <Button size="large" block onClick={onClose} style={{ height: 44, borderRadius: 8 }}>
            再看看
          </Button>
        </Space>
      </div>
    </Modal>
  );
};

export default LoginModal;
