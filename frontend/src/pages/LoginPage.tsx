import React, { useState } from 'react';
import { Button, Form, Input, Card, message } from 'antd';
import { MailOutlined, PhoneOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { authApi } from '../services/api';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [loginForm] = Form.useForm();

  // 支持回调跳转（如从创建按钮的弹窗过来）
  const from = (location.state as any)?.from || '/dashboard';

  const handleFormLogin = async (values: { email: string; phone: string }) => {
    setLoading(true);
    
    try {
      const response = await authApi.login({
        email: values.email,
        phone: values.phone,
      });
      
      setAuth(response.access_token, response.user);
      message.success('登录成功！');
      navigate(from, { replace: true });
    } catch (error: unknown) {
      console.error('登录失败:', error);
      const errorMessage = error instanceof Error ? error.message : '登录失败，请检查后端服务是否正常运行';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'
    }}>
      <Card 
        style={{ 
          width: 400, 
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          borderRadius: '16px',
          overflow: 'hidden'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '32px', padding: '20px' }}>
          <h2>欢迎回来</h2>
          <p style={{ color: '#999' }}>输入邮箱和手机号即可登录/注册</p>
        </div>

        <Form
          form={loginForm}
          name="login"
          onFinish={handleFormLogin}
          autoComplete="off"
        >
          <Form.Item
            name="email"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' }
            ]}
          >
            <Input
              prefix={<MailOutlined />}
              placeholder="请输入邮箱"
            />
          </Form.Item>

          <Form.Item
            name="phone"
            rules={[
              { required: true, message: '请输入手机号' },
              { pattern: /^1[3-9]\d{9}$/, message: '请输入有效的手机号' }
            ]}
          >
            <Input
              prefix={<PhoneOutlined />}
              placeholder="请输入手机号"
            />
          </Form.Item>

          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={loading}
              block
              size="large"
            >
              登录 / 注册
            </Button>
          </Form.Item>

          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <p style={{ color: '#bbb', fontSize: 12, lineHeight: 1.6 }}>
              首次登录将自动创建账号。登录即表示您同意<br />
              我们的服务条款和隐私政策。
            </p>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default LoginPage;
