/**
 * AgentChatCanvas - Agent 对话界面（产物驱动 Canvas）
 *
 * 设计：
 * - 平时只有左侧对话区（居中/全宽），右侧 Canvas 隐藏
 * - AI 回复中的代码块、表格被识别为"产物卡片"
 * - 点击产物卡片 → 右侧 Canvas 展开展示详情
 * - 左右分栏支持拖拽调整宽度
 * - 输入框始终固定在底部
 * - 支持多会话管理：历史会话列表、新建会话
 */
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
  Empty,
  Tooltip,
  Drawer,
  List,
  message,
  Grid,
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
  HistoryOutlined,
  PlusOutlined,
  DeleteOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/useAuthStore';
import MermaidRenderer from '../../components/MermaidRenderer';

const { TextArea } = Input;
const { Text, Title } = Typography;
const { useBreakpoint } = Grid;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  artifacts?: Artifact[];
}

interface Artifact {
  id: string;
  type: 'code' | 'table' | 'document';
  title: string;
  content: string;
  language?: string;
}

interface ConversationSummary {
  threadId: string;
  messageCount: number;
  firstMessage: string;
}

const API_BASE = import.meta.env.VITE_API_URL || 'https://skill-platform-backend-production.up.railway.app/api';

const AgentChatCanvas: React.FC = () => {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('qwen-plus');
  const [canvasOpen, setCanvasOpen] = useState(false);
  const [currentArtifact, setCurrentArtifact] = useState<Artifact | null>(null);
  const [canvasViewMode, setCanvasViewMode] = useState<'preview' | 'code'>('preview');
  const [leftWidth, setLeftWidth] = useState(100);
  const [isDragging, setIsDragging] = useState(false);

  // 会话管理状态
  const [currentThreadId, setCurrentThreadId] = useState<string>(
    `thread-${Date.now()}`
  );
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

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

  // ★ 检测 Mermaid 代码块
  const isMermaidCode = (code: string): boolean => {
    const firstLine = code.trim().split('\n')[0].trim();
    return /^(graph\s+(TD|LR|BT|RL)|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|flowchart\s+(TD|LR|BT|RL))/.test(firstLine);
  };

  // ★ 清理 HTML 标签和 markdown 乱码
  const cleanText = (text: string): string => {
    return text
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?[a-zA-Z][^>]*>/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/^#+\s+/gm, '')
      .replace(/^\s*[-*+]\s+/gm, '')
      .replace(/^\s*\d+\.\s+/gm, (m) => m.replace(/^\s*\d+\.\s+/, ''))
      .replace(/[○●◆◇]/g, '')
      .trim();
  };

  // ★ 判断是否是标准 markdown 表格（有分隔行）
  const isMarkdownTable = (block: string): boolean => {
    const lines = block.trim().split('\n').filter(l => l.trim().length > 0);
    if (lines.length < 2) return false;
    // 第一行必须是 | 开头 | 结尾
    if (!/^\|.*\|$/.test(lines[0].trim())) return false;
    // 第二行必须是分隔线（包含 ---）
    if (!/^\|[-:\s|]+\|$/.test(lines[1].trim())) return false;
    return true;
  };

  // ★ 渲染消息内容
  const renderMessageContent = (msg: Message) => {
    const artifacts: JSX.Element[] = [];
  
    if (msg.artifacts && msg.artifacts.length > 0) {
      msg.artifacts.forEach((artifact) => {
        if (artifact.type === 'table') return;
          
        // Mermaid 代码块产物：标记为 mermaid 类型以便 inline 渲染
        const isMermaid = artifact.type === 'code' && isMermaidCode(artifact.content);

        artifacts.push(
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
            onClick={() => !isMermaid && openCanvas(artifact)}
          >
            <Space>
              <Tag color={isMermaid ? 'green' : 'blue'} style={{ margin: 0 }}>
                {isMermaid ? '📊 流程图' : `📄 ${artifact.title}`}
              </Tag>
              {!isMermaid && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  点击在 Canvas 中查看
                </Text>
              )}
            </Space>
            {isMermaid ? (
              <MermaidRenderer chart={artifact.content} id={`inline-mermaid-${artifact.id}`} />
            ) : artifact.type === 'code' && (
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
    }
  
    // ★ 渲染内容：先预处理内容，再分段处理表格/代码/文本
    const renderContentWithTables = (rawContent: string) => {
      // 1. 预处理：统一换行 + 清理 HTML
      let content = rawContent
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/?(p|div|span|section|pre|code|em|strong|b|i|u|s|ul|ol|li|h[1-6])\b[^>]*>/gi, '');

      const parts: (string | JSX.Element)[] = [];

      // 2. 按段落分割
      const paragraphs = content.split(/\n{2,}/);

      for (let pi = 0; pi < paragraphs.length; pi++) {
        const para = paragraphs[pi].trim();
        if (!para) continue;

        // 2a. 检测标准 markdown 表格（必须含 |---| 分隔行）
        if (isMarkdownTable(para)) {
          const tableLines = para.split('\n').filter(l => l.trim().length > 0);
          const sepIdx = tableLines.findIndex(l => /^\|[-:\s|]+\|$/.test(l.trim()));
          if (sepIdx === -1) continue;

          const parseRow = (line: string) =>
            line.split('|').filter((_, i, arr) => i > 0 && i < arr.length - 1).map(c => c.trim());

          const headers = sepIdx > 0 ? parseRow(tableLines[sepIdx - 1]) : [];
          const dataRows = tableLines.slice(sepIdx + 1).map(parseRow);

          if (headers.length > 0 && dataRows.length > 0) {
            parts.push(
              <div key={`table-${pi}`} style={{ overflow: 'auto', marginBottom: 12 }}>
                <table style={{
                  width: '100%', borderCollapse: 'collapse', fontSize: 13,
                  border: '1px solid #e2e8f0', borderRadius: 6,
                }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9' }}>
                      {headers.map((h, i) => (
                        <th key={i} style={{ padding: '8px 12px', borderBottom: '2px solid #e2e8f0', textAlign: 'left', fontWeight: 600 }}>{cleanText(h)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dataRows.map((row, ri) => (
                      <tr key={ri} style={{ background: ri % 2 === 0 ? '#fff' : '#fafafa' }}>
                        {row.map((cell, ci) => (
                          <td key={ci} style={{ padding: '6px 12px', borderBottom: '1px solid #e2e8f0' }}>{cleanText(cell)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
            continue;
          }
        }

        // 2b. 检测代码块（``` 包裹）→ 判断是否为 Mermaid
        if (/^```/.test(para)) {
          const codeText = para.replace(/^```\w*\n?/, '').replace(/```$/, '').trim();
          
          if (isMermaidCode(codeText)) {
            // 渲染为 Mermaid 图
            parts.push(
              <div key={`mermaid-${pi}`}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#6366f1', marginBottom: 8 }}>
                  📊 流程图
                </div>
                <MermaidRenderer chart={codeText} id={`mermaid-inline-${pi}`} />
              </div>
            );
          } else {
            // 普通代码块
            parts.push(
              <pre key={`code-${pi}`} style={{
                background: '#1e1e1e', color: '#d4d4d4', borderRadius: 8,
                padding: 12, fontSize: 12, overflow: 'auto', lineHeight: 1.5, marginBottom: 12,
              }}>
                <code>{codeText}</code>
              </pre>
            );
          }
          continue;
        }

        // 2c. 普通文本：清理后渲染
        const cleanPara = para
          .replace(/\|/g, '')
          .replace(/\*\*(.*?)\*\*/g, '$1')
          .replace(/\*(.*?)\*/g, '$1')
          .replace(/`([^`]+)`/g, '$1')
          .replace(/^#+\s+/gm, '')
          .replace(/^\s*[-*+]\s+/gm, '• ')
          .replace(/^\s*\d+\.\s+/gm, '')
          .replace(/[○●◆◇]/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .trim();

        if (cleanPara) {
          parts.push(
            <Text key={`text-${pi}`} style={{ whiteSpace: 'pre-wrap', display: 'block', marginBottom: 8, lineHeight: 1.7 }}>
              {cleanPara}
            </Text>
          );
        }
      }

      if (parts.length === 0 && content.trim()) {
        parts.push(
          <Text key="fallback" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
            {cleanText(content)}
          </Text>
        );
      }

      return parts;
    };
  
    return (
      <div>
        {renderContentWithTables(msg.content)}
        {artifacts}
        {/* 下载 Word 按钮 */}
        {msg.role === 'assistant' && msg.content.trim() && (
          <div style={{ marginTop: 12, display: 'flex', gap: 6 }}>
            <Button
              size="small"
              icon={<FileTextOutlined />}
              onClick={async () => {
                try {
                  const API_BASE = import.meta.env.VITE_API_URL || 'https://skill-platform-backend-production.up.railway.app/api';
                  const token = useAuthStore.getState().token;
                  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                  if (token) headers['Authorization'] = `Bearer ${token}`;
                  const resp = await fetch(`${API_BASE}/ai/export-docx`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ content: msg.content, format: 'docx', filename: `对话回复_${Date.now()}.docx` }),
                  });
                  if (!resp.ok) {
                    const errText = await resp.text().catch(() => '');
                    throw new Error(errText ? `导出失败: ${errText}` : '导出失败');
                  }
                  const blob = await resp.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `回复_${Date.now()}.docx`;
                  a.click();
                  URL.revokeObjectURL(url);
                } catch (e: any) {
                  message.error('导出 Word 失败: ' + (e.message || '未知错误'));
                }
              }}
            >
              下载 Word
            </Button>
            <Button
              size="small"
              icon={<CopyOutlined />}
              onClick={() => {
                navigator.clipboard.writeText(msg.content);
                message.success('已复制');
              }}
            >
              复制
            </Button>
          </div>
        )}
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
      const response = await fetch(`${API_BASE}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thread_id: currentThreadId,
          message: userMessage.content,
          model: selectedModel,
          agentId: agentId ? Number(agentId) : undefined,
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

  // ============ 会话管理 ============

  // 加载历史会话列表
  const loadConversations = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const resp = await fetch(`${API_BASE}/ai/conversations`);
      if (resp.ok) {
        const data = await resp.json();
        setConversations(data || []);
      }
    } catch {
      // 静默失败，可能是服务未启动
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  // 切换到指定会话
  const switchConversation = async (threadId: string) => {
    setHistoryVisible(false);
    setCurrentThreadId(threadId);
    setMessages([]);
    setCanvasOpen(false);
    setIsLoading(true);

    try {
      const resp = await fetch(`${API_BASE}/ai/conversations/${encodeURIComponent(threadId)}`);
      if (resp.ok) {
        const data = await resp.json();
        const historyMessages: Message[] = (data.messages || []).map(
          (m: { role: string; content: string }, i: number) => ({
            id: `msg-history-${i}-${Date.now()}`,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            timestamp: new Date(),
          })
        );
        setMessages(historyMessages);
      }
    } catch {
      message.error('加载历史会话失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 新建对话
  const newConversation = () => {
    setMessages([]);
    setCurrentThreadId(`thread-${Date.now()}`);
    setCanvasOpen(false);
    setCurrentArtifact(null);
    setLeftWidth(100);
    setHistoryVisible(false);
  };

  // 初始加载会话列表
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // 每次消息变化后刷新会话列表
  useEffect(() => {
    if (messages.length > 0) {
      loadConversations();
    }
  }, [messages.length]);

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
    <div ref={containerRef} style={{ height: isMobile ? 'calc(100vh - 56px)' : 'calc(100vh - 56px - 32px)', display: 'flex', flexDirection: 'column' }}>
      {/* 顶部工具栏 */}
      <div style={{
        padding: isMobile ? '8px 12px' : '12px 16px',
        borderBottom: '1px solid #f0f0f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0,
      }}>
        {isMobile ? (
          <Space>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/dashboard')}
              style={{ fontSize: 16, color: '#333' }}
            />
            <RobotOutlined style={{ color: '#6366f1', fontSize: 16 }} />
            <Text strong style={{ fontSize: 15 }}>{agentId ? `Agent #${agentId}` : 'AI 对话'}</Text>
          </Space>
        ) : (
          <Space>
            <RobotOutlined style={{ color: '#6366f1', fontSize: 18 }} />
            <Text strong style={{ fontSize: 15 }}>Agent 对话</Text>
            {agentId && <Tag>{agentId}</Tag>}
            <Tag color="default" style={{ fontSize: 11 }}>
              {currentThreadId.slice(0, 16)}...
            </Tag>
          </Space>
        )}
        <Space>
          {isMobile ? (
            <>
              <Tooltip title="历史会话">
                <Button
                  icon={<HistoryOutlined />}
                  size="small"
                  type="text"
                  onClick={() => { loadConversations(); setHistoryVisible(true); }}
                />
              </Tooltip>
              <Tooltip title="新建对话">
                <Button
                  type="text"
                  icon={<PlusOutlined />}
                  size="small"
                  onClick={newConversation}
                />
              </Tooltip>
            </>
          ) : (
            <>
              <Tooltip title="历史会话">
                <Button
                  icon={<HistoryOutlined />}
                  size="small"
                  onClick={() => { loadConversations(); setHistoryVisible(true); }}
                />
              </Tooltip>
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
            </>
          )}
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
              padding: isMobile ? '8px 12px' : '16px 20px',
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
          <div style={{ padding: isMobile ? '8px 12px' : '12px 20px', borderTop: '1px solid #f0f0f0', background: '#fff', flexShrink: 0 }}>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: isMobile ? 4 : 6 }}>
              <Text type="secondary" style={{ fontSize: isMobile ? 11 : 12 }}>
                按 Enter 发送
              </Text>
              {!isMobile && (
                <Tooltip title="新建对话">
                  <Button
                    type="text"
                    icon={<PlusOutlined />}
                    size="small"
                    onClick={newConversation}
                    style={{ color: '#bbb' }}
                  />
                </Tooltip>
              )}
            </div>
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

      {/* 历史会话抽屉 */}
      <Drawer
        title="历史会话"
        placement="left"
        open={historyVisible}
        onClose={() => setHistoryVisible(false)}
        width={340}
      >
        <List
          loading={loadingHistory}
          dataSource={conversations}
          renderItem={(item) => (
            <List.Item
              onClick={() => switchConversation(item.threadId)}
              style={{ cursor: 'pointer' }}
              actions={[
                <Button
                  type="text"
                  icon={<DeleteOutlined />}
                  size="small"
                  danger
                  onClick={async (e) => {
                    e.stopPropagation();
                    try {
                      await fetch(`${API_BASE}/ai/conversations/${encodeURIComponent(item.threadId)}`, {
                        method: 'DELETE',
                      });
                      message.success('已删除');
                      loadConversations();
                    } catch {
                      message.error('删除失败');
                    }
                  }}
                />,
              ]}
            >
              <List.Item.Meta
                title={item.firstMessage || '(空对话)'}
                description={`${item.messageCount} 条消息`}
              />
            </List.Item>
          )}
          locale={{ emptyText: '暂无历史对话' }}
        />
      </Drawer>
    </div>
  );
};

export default AgentChatCanvas;
