/**
 * AgentChatCanvas - Agent 对话界面（产物驱动 Canvas）
 *
 * 设计：
 * - 平时只有左侧对话区（居中/全宽），右侧 Canvas 隐藏
 * - AI 回复中的代码块、表格被识别为"产物卡片"
 * - 点击产物卡片 → 右侧 Canvas 展开展示详情
 * - 左右分栏支持拖拽调整宽度
 * - 输入框始终固定在底部
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Card,
  Input,
  Button,
  Typography,
  Space,
  Avatar,
  Tag,
  Spin,
  Select,
  Tabs,
  Empty,
  Tooltip,
} from 'antd';
import {
  SendOutlined,
  RobotOutlined,
  UserOutlined,
  ClearOutlined,
  AppstoreOutlined,
  CodeOutlined,
  FileTextOutlined,
  CloseOutlined,
  CopyOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { useParams } from 'react-router-dom';

const { TextArea } = Input;
const { Text, Title } = Typography;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  artifacts?: Artifact[]; // ★ 产物列表
}

interface Artifact {
  id: string;
  type: 'code' | 'table' | 'document';
  title: string;
  content: string;
  language?: string;
}

const AgentChatCanvas: React.FC = () => {
  const { agentId } = useParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('qwen-plus');
  const [canvasOpen, setCanvasOpen] = useState(false);
  const [currentArtifact, setCurrentArtifact] = useState<Artifact | null>(null);
  const [canvasViewMode, setCanvasViewMode] = useState<'preview' | 'code'>('preview');
  const [leftWidth, setLeftWidth] = useState(100); // 百分比
  const [isDragging, setIsDragging] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartX = useRef(0);
  const dragStartLeftWidth = useRef(0);

  // 添加悬停效果的样式
  useEffect(() => {
    const styleId = 'artifact-card-hover-style';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .artifact-card:hover .artifact-actions {
          opacity: 1;
        }
        
        .artifact-table {
          border-collapse: collapse;
          width: 100%;
          font-size: 13px;
        }
        
        .artifact-table th,
        .artifact-table td {
          border: 1px solid #ddd;
          padding: 8px 12px;
          text-align: left;
        }
        
        .artifact-table th {
          background-color: #f5f5f5;
          font-weight: 600;
        }
        
        .artifact-table tr:nth-child(even) {
          background-color: #f9f9f9;
        }
        
        .artifact-table-container {
          overflow: auto;
          max-height: 400px;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ★ 解析产物：从 AI 内容中提取代码块和表格
  const parseArtifacts = useCallback((content: string): Artifact[] => {
    const artifacts: Artifact[] = [];

    // 匹配代码块 ```lang\ncode\n```
    const codeRegex = /```(\w*)\n?([\s\S]*?)```/g;
    let match;
    let idx = 0;
    while ((match = codeRegex.exec(content)) !== null) {
      const lang = match[1] || 'text';
      const code = match[2].trim();
      artifacts.push({
        id: `artifact-code-${idx++}`,
        type: 'code',
        title: `${lang || '代码'} 产物`,
        content: code,
        language: lang,
      });
    }

    // 匹配表格 | col1 | col2 |
    const tablePattern = '\\|[^\\n]+\\|\\n\\|[-:\\s|]+\\|\\n(?:\\|[^\\n]+\\|\\n?)+';
    const tableRegex = new RegExp(tablePattern, 'g');
    idx = 0;
    while ((match = tableRegex.exec(content)) !== null) {
      artifacts.push({
        id: `artifact-table-${idx++}`,
        type: 'table',
        title: `表格产物`,
        content: match[0],
      });
    }

    return artifacts;
  }, []);

  // ★ 渲染消息内容（将产物替换为可点击卡片）
  const renderMessageContent = (msg: Message) => {
    if (!msg.artifacts || msg.artifacts.length === 0) {
      // 处理纯文本内容，移除markdown标记
      const cleanText = msg.content
        .replace(/```[\s\S]*?```/g, '') // 移除代码块
        .replace(/\|.*\|(?:\n\|[-:\s|]+)+\n?(?:\|.*\|(?=\n|$))*/g, '') // 移除表格
        .replace(/\*\*(.*?)\*\*/g, '$1') // 移除粗体标记
        .replace(/\*(.*?)\*/g, '$1') // 移除斜体标记
        .replace(/~~(.*?)~~/g, '$1') // 移除删除线标记
        .replace(/`(.*?)`/g, '$1') // 移除行内代码标记
        .replace(/^#+\s+/gm, '') // 移除标题标记
        .replace(/^\s*[-+*]\s+/gm, '• ') // 替换列表标记为圆点
        .replace(/^\s*\d+\.\s+/gm, (match) => match.replace(/^\s*(\d+)\.\s+/, '$1. ')) // 保持数字列表
        .trim();
      
      return <Text style={{ whiteSpace: 'pre-wrap' }}>{cleanText}</Text>;
    }

    const artifactCards: JSX.Element[] = [];

    msg.artifacts.forEach((artifact) => {
      artifactCards.push(
        <div
          key={artifact.id}
          className="artifact-card"
          style={{
            marginTop: 12,
            padding: '8px 12px',
            background: '#f0f5ff',
            border: '1px dashed #b7c8f0',
            borderRadius: 8,
            cursor: 'pointer',
            transition: 'all 0.15s',
            position: 'relative',
          }}
          onClick={() => openCanvas(artifact)}
        >
          <Space>
            <Tag color="blue" style={{ margin: 0 }}>
              {artifact.type === 'code' ? '📄' : artifact.type === 'table' ? '📊' : '📄'} {artifact.title}
            </Tag>
            <Text type="secondary" style={{ fontSize: 12 }}>
              点击在 Canvas 中查看
            </Text>
          </Space>
          {artifact.type === 'code' && (
            <pre
              style={{
                margin: '8px 0 0',
                padding: 8,
                background: '#1e1e1e',
                color: '#d4d4d4',
                borderRadius: 6,
                fontSize: 11,
                maxHeight: 80,
                overflow: 'hidden',
                lineHeight: 1.4,
              }}
            >
              <code>{artifact.content.slice(0, 200)}{artifact.content.length > 200 ? '...' : ''}</code>
            </pre>
          )}
          
          {/* 悬停时显示的操作按钮 */}
          <div
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              opacity: 0,
              transition: 'opacity 0.2s',
              background: 'rgba(255, 255, 255, 0.9)',
              borderRadius: 4,
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}
            className="artifact-actions"
          >
            <Tooltip title="复制内容">
              <Button
                size="small"
                icon={<CopyOutlined />}
                type="text"
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(artifact.content);
                }}
                style={{ padding: '2px 4px' }}
              />
            </Tooltip>
          </div>
        </div>
      );
    });

    // 清理消息内容中的原始代码块/表格，保留其他文本
    const tablePattern = '\\|[^\n]+\\|(?:\\n\\|[-:\\s|]+)+\\n?(?:\\|[^\n]+\\|(?=\\n|$))*';
    let cleanContent = msg.content
      .replace(/\`\`\`[\s\S]*?\`\`\`/g, '')
      .replace(new RegExp(tablePattern, 'g'), '')
      .replace(/\*\*(.*?)\*\*/g, '$1') // 移除粗体标记
      .replace(/\*(.*?)\*/g, '$1') // 移除斜体标记
      .replace(/~~(.*?)~~/g, '$1') // 移除删除线标记
      .replace(/`(.*?)`/g, '$1') // 移除行内代码标记
      .replace(/^#+\s+/gm, '') // 移除标题标记
      .replace(/^\s*[-+*]\s+/gm, '• ') // 替换列表标记为圆点
      .replace(/^\s*\d+\.\s+/gm, (match) => match.replace(/^\s*(\d+)\.\s+/, '$1. ')) // 保持数字列表
      .trim();
      
    return (
      <div>
        {cleanContent && <Text style={{ whiteSpace: 'pre-wrap' }}>{cleanContent}</Text>}
        {artifactCards}
      </div>
    );
  };

  const openCanvas = (artifact: Artifact) => {
    setCurrentArtifact(artifact);
    setCanvasOpen(true);
    setCanvasViewMode('preview');
    setLeftWidth(60);
  };

  const closeCanvas = () => {
    setCanvasOpen(false);
    setCurrentArtifact(null);
    setLeftWidth(100);
  };

  // ★ 拖拽调整宽度
  const handleDragStart = (e: React.MouseEvent) => {
    if (!canvasOpen) return;
    setIsDragging(true);
    dragStartX.current = e.clientX;
    dragStartLeftWidth.current = leftWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  };

  useEffect(() => {
    const handleDragMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;
      const containerWidth = containerRef.current.offsetWidth;
      const dx = e.clientX - dragStartX.current;
      const dxPercent = (dx / containerWidth) * 100;
      let newLeft = dragStartLeftWidth.current + dxPercent;
      newLeft = Math.max(40, Math.min(80, newLeft));
      setLeftWidth(newLeft);
    };

    const handleDragEnd = () => {
      if (isDragging) {
        setIsDragging(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleDragEnd);
    }
    return () => {
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
    };
  }, [isDragging]);

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const API_BASE = import.meta.env.VITE_API_URL || 'https://skill-platform-backend-production.up.railway.app/api';
      const response = await fetch(`${API_BASE}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thread_id: agentId || 'default',
          message: userMessage.content,
          model: selectedModel,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`API 响应失败: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data:')) {
              const dataStr = line.slice(5).trim();
              if (dataStr === '[DONE]' || dataStr === '') continue;

              try {
                const data = JSON.parse(dataStr);
                if (data.type === 'content' && data.content) {
                  assistantContent += data.content;

                  setMessages((prev) => {
                    const lastMsg = prev[prev.length - 1];
                    if (lastMsg?.role === 'assistant' && lastMsg.id.startsWith('msg-assistant')) {
                      return [...prev.slice(0, -1), { ...lastMsg, content: assistantContent }];
                    }
                    return [...prev, {
                      id: `msg-assistant-${Date.now()}`,
                      role: 'assistant',
                      content: assistantContent,
                      timestamp: new Date(),
                    }];
                  });
                }
              } catch (e) {
                // 忽略解析错误
              }
            }
          }
        }
      }

      // 流式结束后，解析产物
      setMessages((prev) => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg?.role === 'assistant') {
          const artifacts = parseArtifacts(lastMsg.content);
          return [...prev.slice(0, -1), { ...lastMsg, artifacts }];
        }
        return prev;
      });

    } catch (error: any) {
      setMessages((prev) => [...prev, {
        id: `msg-fallback-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ API 连接失败，请检查配置。\n\n错误信息: ${error.message}`,
        timestamp: new Date(),
      }]);
    }

    setIsLoading(false);
  };

  const clearChat = () => {
    setMessages([]);
    setCanvasOpen(false);
    setCurrentArtifact(null);
    setLeftWidth(100);
  };

  // Canvas 内容渲染
  const renderCanvasContent = () => {
    if (!currentArtifact) {
      return (
        <Empty description="点击对话中的产物卡片查看详情" image={Empty.PRESENTED_IMAGE_SIMPLE}>
          <Text type="secondary">产物将在 Canvas 中展开展示</Text>
        </Empty>
      );
    }

    const { content, type, language } = currentArtifact;

    if (canvasViewMode === 'code') {
      return (
        <pre style={{ margin: 0, padding: 16, background: '#1e1e1e', color: '#d4d4d4', borderRadius: 8, overflow: 'auto', fontSize: 13, lineHeight: 1.6 }}>
          <code>{content}</code>
        </pre>
      );
    }

    // 预览模式
    if (type === 'code') {
      return (
        <pre style={{ margin: 0, padding: 16, background: '#1e1e1e', color: '#d4d4d4', borderRadius: 8, overflow: 'auto', fontSize: 13, lineHeight: 1.6 }}>
          <code>{content}</code>
        </pre>
      );
    }

    if (type === 'table') {
      // 解析表格内容
      const rows = content.trim().split('\n').filter(row => row.trim() !== '');
      if (rows.length < 2) {
        return <Text>无法解析表格数据</Text>;
      }
      
      // 找到分隔线位置（包含 --- 的行）
      let separatorIndex = -1;
      for (let i = 0; i < rows.length; i++) {
        if (rows[i].includes('|---') || rows[i].includes(':-') || rows[i].includes('-:')) {
          separatorIndex = i;
          break;
        }
      }
      
      if (separatorIndex === -1) {
        // 如果没有找到分隔线，则第一行为表头
        separatorIndex = 0;
      }
      
      const headers = rows[separatorIndex - 1]?.split('|').filter(Boolean).map(h => h.trim()) || [];
      const dataRows = rows.slice(separatorIndex + 1).map(row => row.split('|').filter(Boolean).map(c => c.trim()));

      return (
        <div className="artifact-table-container">
          <table className="artifact-table">
            <thead>
              <tr>
                {headers.map((h, i) => (
                  <th key={i}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dataRows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    return <Text>{content}</Text>;
  };

  return (
    <div ref={containerRef} style={{ height: 'calc(100vh - 56px - 32px)', display: 'flex', flexDirection: 'column' }}>
      {/* 顶部工具栏 */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <Space>
          <RobotOutlined style={{ color: '#6366f1', fontSize: 18 }} />
          <Text strong style={{ fontSize: 15 }}>Agent 对话</Text>
          {agentId && <Tag>{agentId}</Tag>}
        </Space>
        <Space>
          <Select
            value={selectedModel}
            onChange={setSelectedModel}
            size="small"
            style={{ width: 130 }}
            options={[
              { value: 'qwen-turbo', label: 'Turbo' },
              { value: 'qwen-plus', label: 'Plus' },
              { value: 'qwen-max', label: 'Max' },
            ]}
          />
          <Button icon={<ClearOutlined />} size="small" onClick={clearChat}>
            清空
          </Button>
        </Space>
      </div>

      {/* 主区域：对话 + Canvas */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {/* 左侧：对话区 */}
        <div
          style={{
            width: `${leftWidth}%`,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            transition: isDragging ? 'none' : 'width 0.2s',
            minWidth: 0,
          }}
        >
          {/* 消息列表 */}
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              padding: '16px 20px',
              background: '#fafafa',
            }}
          >
            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 80 }}>
                <RobotOutlined style={{ fontSize: 56, color: '#6366f1', marginBottom: 16 }} />
                <Title level={4}>开始对话</Title>
                <Text type="secondary">输入问题，Agent 将为您分析和解答</Text>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    marginBottom: 20,
                    flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                  }}
                >
                  <Avatar
                    icon={msg.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
                    style={{
                      backgroundColor: msg.role === 'user' ? '#10b981' : '#6366f1',
                      flexShrink: 0,
                    }}
                  />
                  <div
                    style={{
                      maxWidth: '78%',
                      marginLeft: msg.role === 'user' ? 0 : 12,
                      marginRight: msg.role === 'user' ? 12 : 0,
                      padding: '12px 16px',
                      borderRadius: 12,
                      background: msg.role === 'user' ? '#e8f5e9' : '#fff',
                      boxShadow: msg.role === 'user' ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
                      border: msg.role === 'user' ? 'none' : '1px solid #f0f0f0',
                    }}
                  >
                    {renderMessageContent(msg)}
                  </div>
                </div>
              ))
            )}
            {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <Avatar icon={<RobotOutlined />} style={{ backgroundColor: '#6366f1', flexShrink: 0 }} />
                <Card size="small" style={{ background: '#f5f5f5', border: 'none' }}>
                  <Spin size="small" tip="Agent 思考中..." />
                </Card>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 输入区 — 始终固定在底部 */}
          <div style={{ padding: '12px 20px', borderTop: '1px solid #f0f0f0', background: '#fff', flexShrink: 0 }}>
            <Space.Compact style={{ width: '100%' }}>
              <TextArea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="输入您的消息..."
                autoSize={{ minRows: 1, maxRows: 4 }}
                onPressEnter={(e) => {
                  if (!e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                disabled={isLoading}
                style={{ borderRadius: '8px 0 0 8px' }}
              />
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={sendMessage}
                loading={isLoading}
                style={{ background: '#6366f1', borderRadius: '0 8px 8px 0', height: 'auto' }}
              >
                发送
              </Button>
            </Space.Compact>
            <Text type="secondary" style={{ fontSize: 12, marginTop: 6, display: 'block' }}>
              按 Enter 发送，Shift + Enter 换行
            </Text>
          </div>
        </div>

        {/* 拖拽分隔条 */}
        {canvasOpen && (
          <div
            onMouseDown={handleDragStart}
            style={{
              width: 5,
              cursor: 'col-resize',
              background: isDragging ? '#6366f1' : '#e0e0e0',
              flexShrink: 0,
              transition: isDragging ? 'none' : 'background 0.15s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="拖拽调整宽度"
          >
            <div style={{ width: 2, height: 24, background: isDragging ? '#fff' : '#bbb', borderRadius: 1 }} />
          </div>
        )}

        {/* 右侧：Canvas */}
        {canvasOpen && (
          <div
            style={{
              width: `${100 - leftWidth}%`,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              borderLeft: '1px solid #f0f0f0',
              background: '#fff',
              transition: isDragging ? 'none' : 'width 0.2s',
              minWidth: 0,
            }}
          >
            {/* Canvas 头部 */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, background: '#fafafa' }}>
              <Space>
                <AppstoreOutlined style={{ color: '#6366f1' }} />
                <Text strong>🎨 Canvas</Text>
                {currentArtifact && (
                  <Tag color="blue">{currentArtifact.title}</Tag>
                )}
              </Space>
              <Space>
                <Button
                  size="small"
                  icon={<EyeOutlined />}
                  type={canvasViewMode === 'preview' ? 'primary' : 'default'}
                  onClick={() => setCanvasViewMode('preview')}
                >
                  预览
                </Button>
                <Button
                  size="small"
                  icon={<CodeOutlined />}
                  type={canvasViewMode === 'code' ? 'primary' : 'default'}
                  onClick={() => setCanvasViewMode('code')}
                >
                  源码
                </Button>
                {currentArtifact && (
                  <Button
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={() => {
                      navigator.clipboard.writeText(currentArtifact.content);
                    }}
                  >
                    复制
                  </Button>
                )}
                <Button size="small" icon={<CloseOutlined />} onClick={closeCanvas} />
              </Space>
            </div>

            {/* Canvas 内容 */}
            <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
              {renderCanvasContent()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentChatCanvas;
