/**
 * AgentChat - 对话界面组件
 * 支持与 Deep Agent Runtime 进行对话交互
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  Card,
  Input,
  Button,
  Space,
  Typography,
  Tag,
  Avatar,
  Spin,
  Empty,
  Divider,
  Select,
  Tooltip,
  message,
} from 'antd';
import {
  SendOutlined,
  RobotOutlined,
  UserOutlined,
  ReloadOutlined,
  SettingOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type { InputRef } from 'antd';

const { TextArea } = Input;
const { Text, Title } = Typography;

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    model?: string;
    skills?: string[];
    toolCalls?: any[];
  };
}

interface AgentChatProps {
  threadId?: string;
  defaultModel?: string;
  onMessageSent?: (message: string) => void;
}

const AgentChat: React.FC<AgentChatProps> = ({
  threadId = 'default-thread',
  defaultModel = 'qwen-plus',
  onMessageSent,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState(defaultModel);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  
  const inputRef = useRef<InputRef>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // 可用模型列表
  const models = [
    { value: 'qwen-turbo', label: '通义千问 Turbo' },
    { value: 'qwen-plus', label: '通义千问 Plus' },
    { value: 'qwen-max', label: '通义千问 Max' },
    { value: 'deepseek-v3', label: 'DeepSeek V3' },
  ];
  
  // 可用 Skills
  const availableSkills = [
    { value: 'process-analysis', label: '流程分析' },
    { value: 'document-generation', label: '文档生成' },
    { value: 'risk-assessment', label: '风险评估' },
  ];
  
  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);
  
  // 发送消息
  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;
    
    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setStreamingContent('');
    
    try {
      // 调用 Agent Runtime V2 API（直接调用百炼模型）
      const response = await fetch('http://localhost:8001/v2/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          thread_id: threadId,
          message: userMessage.content,
          model: selectedModel,
          skills: selectedSkills,
          stream: true,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Agent Runtime 响应失败');
      }
      
      // 处理流式响应
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ') && !line.includes('[DONE]')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === 'content' && data.content) {
                  fullContent += data.content;
                  setStreamingContent(fullContent);
                } else if (data.type === 'error') {
                  message.error(data.content);
                }
              } catch (e) {
                // 忽略解析错误
              }
            }
          }
        }
      }
      
      // 添加助手消息
      const assistantMessage: Message = {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant',
        content: fullContent || '（无响应内容）',
        timestamp: new Date(),
        metadata: {
          model: selectedModel,
          skills: selectedSkills,
        },
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      setStreamingContent('');
      onMessageSent?.(userMessage.content);
      
    } catch (error) {
      message.error('发送失败，请检查 Agent Runtime 服务是否启动');
      
      // 添加错误消息
      const errorMessage: Message = {
        id: `msg-${Date.now()}-error`,
        role: 'system',
        content: `错误：${error instanceof Error ? error.message : '未知错误'}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };
  
  // 清空对话
  const clearChat = () => {
    setMessages([]);
    setStreamingContent('');
    message.success('对话已清空');
  };
  
  // 渲染单条消息
  const renderMessage = (msg: Message) => {
    const isUser = msg.role === 'user';
    const isSystem = msg.role === 'system';
    
    return (
      <div
        key={msg.id}
        style={{
          display: 'flex',
          justifyContent: isUser ? 'flex-end' : 'flex-start',
          marginBottom: 16,
        }}
      >
        <div
          style={{
            maxWidth: '70%',
            display: 'flex',
            gap: 8,
            alignItems: 'flex-start',
          }}
        >
          {!isUser && (
            <Avatar
              icon={isSystem ? <SettingOutlined /> : <RobotOutlined />}
              style={{ backgroundColor: isSystem ? '#ff4d4f' : '#1890ff' }}
            />
          )}
          <div>
            <Card
              size="small"
              style={{
                backgroundColor: isUser ? '#e6f7ff' : isSystem ? '#fff2f0' : '#f5f5f5',
                borderRadius: 8,
              }}
            >
              <Text>{msg.content}</Text>
              {msg.metadata && (
                <div style={{ marginTop: 8 }}>
                  {msg.metadata.model && (
                    <Tag color="blue">{msg.metadata.model}</Tag>
                  )}
                  {msg.metadata.skills?.map(skill => (
                    <Tag color="green">{skill}</Tag>
                  ))}
                </div>
              )}
            </Card>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {msg.timestamp.toLocaleTimeString()}
            </Text>
          </div>
          {isUser && (
            <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#87d068' }} />
          )}
        </div>
      </div>
    );
  };
  
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 工具栏 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            value={selectedModel}
            onChange={setSelectedModel}
            options={models}
            style={{ width: 150 }}
            placeholder="选择模型"
          />
          <Select
            mode="multiple"
            value={selectedSkills}
            onChange={setSelectedSkills}
            options={availableSkills}
            style={{ width: 200 }}
            placeholder="加载 Skill"
            allowClear
          />
          <Tooltip title="清空对话">
            <Button icon={<ReloadOutlined />} onClick={clearChat} />
          </Tooltip>
          <Tooltip title="新建 Agent">
            <Button icon={<ThunderboltOutlined />} type="primary">
              新建 Agent
            </Button>
          </Tooltip>
        </Space>
      </Card>
      
      {/* 消息列表 */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 16,
          backgroundColor: '#fafafa',
          borderRadius: 8,
        }}
      >
        {messages.length === 0 && !isLoading && (
          <Empty
            description="开始对话"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Text type="secondary">
              输入问题，Agent 将为您执行任务规划与处理
            </Text>
          </Empty>
        )}
        
        {messages.map(renderMessage)}
        
        {/* 流式输出显示 */}
        {isLoading && streamingContent && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <Avatar icon={<RobotOutlined />} style={{ backgroundColor: '#1890ff' }} />
            <Card size="small" style={{ backgroundColor: '#f5f5f5' }}>
              <Text>{streamingContent}</Text>
            </Card>
          </div>
        )}
        
        {/* 加载指示器 */}
        {isLoading && !streamingContent && (
          <div style={{ textAlign: 'center', padding: 16 }}>
            <Spin tip="Agent 正在思考..." />
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* 输入区域 */}
      <Card size="small" style={{ marginTop: 16 }}>
        <Space.Compact style={{ width: '100%' }}>
          <TextArea
            ref={inputRef}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            placeholder="输入问题或任务描述..."
            autoSize={{ minRows: 1, maxRows: 4 }}
            onPressEnter={e => {
              if (!e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            disabled={isLoading}
            style={{ borderRadius: 0 }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={sendMessage}
            loading={isLoading}
            style={{ width: 80 }}
          >
            发送
          </Button>
        </Space.Compact>
        <Text type="secondary" style={{ fontSize: 12, marginTop: 8 }}>
          按 Enter 发送，Shift + Enter 换行
        </Text>
      </Card>
    </div>
  );
};

export default AgentChat;