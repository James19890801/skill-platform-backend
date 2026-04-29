import React, { useState } from 'react';
import { Button, Form, Input, Card, message } from 'antd';
import { MailOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { authApi } from '../services/api';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [loginForm] = Form.useForm();

  const handleFormLogin = async (values: { identifier: string; password: string }) => {
    setLoading(true);
    
    try {
      // 调用真实登录接口，identifier 可以是邮箱或手机号
      const response = await authApi.login({
        identifier: values.identifier,
        password: values.password,
      });
      
      setAuth(response.access_token, response.user);
      message.success(`欢迎回来，${response.user.name}！`);
      navigate('/dashboard');
    } catch (error: unknown) {
      // 登录失败显示错误提示
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
          <p style={{ color: '#999' }}>请输入您的账户信息</p>
        </div>

        <Form
          form={loginForm}
          name="login"
          initialValues={{ remember: true }}
          onFinish={handleFormLogin}
          autoComplete="off"
        >
          <Form.Item
            name="identifier"
            rules={[
              { 
                required: true, 
                message: '请输入邮箱或手机号!' 
              },
              {
                pattern: /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$|^1[3-9]\d{9}$/,
                message: '请输入有效的邮箱或手机号!'
              }
            ]}
          >
            <Input
              prefix={<MailOutlined />}
              placeholder="请输入邮箱或手机号"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码!' }]}
          >
            <Input
              prefix={<LockOutlined />}
              type="password"
              placeholder="请输入密码"
            />
          </Form.Item>

          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={loading}
              block
            >
              登录
            </Button>
          </Form.Item>

          <div style={{ textAlign: 'center' }}>
            <span style={{ color: '#999' }}>还没有账号? </span>
            <a href="/register">立即注册</a>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default LoginPage;
