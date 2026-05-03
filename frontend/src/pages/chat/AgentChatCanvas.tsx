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
  Upload,
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
  DeleteOutlined,
  ArrowLeftOutlined,
  PictureOutlined,
  PaperClipOutlined,
  FolderOpenOutlined,
  DownloadOutlined,
  FolderOutlined,
  FileOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/useAuthStore';
import MermaidRenderer from '../../components/MermaidRenderer';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
  type: 'code' | 'table' | 'document' | 'html' | 'image' | 'json';
  title: string;
  content: string;
  language?: string;
  downloadUrl?: string;  // 文档下载链接
  filename?: string;      // 文档文件名
  token?: string;         // 文档预览/下载 token
  src?: string;           // 图片/HTML 加载地址
}

// Skill 执行状态管理
interface ExecutionLogEntry {
  type: 'round_start' | 'tool_call' | 'tool_result' | 'artifact' | 'round_end' | 'error' | 'done';
  data: {
    round: number;
    action: string;
    toolName?: string;
    status: 'pending' | 'success' | 'error';
    durationMs?: number;
    message: string;
  };
  artifacts?: Array<{ name: string; path: string; type: string; size: number }>;
}

interface ExecutionState {
  skillName: string;
  skillId: number;
  logs: ExecutionLogEntry[];
  artifacts: Array<{ name: string; path: string; type: string; size: number }>;
  status: 'running' | 'completed' | 'failed';
  startTime: number;
  output?: string;
  totalRounds?: number;
  totalDurationMs?: number;
}

interface ConversationSummary {
  threadId: string;
  messageCount: number;
  firstMessage: string;
}

interface WorkspaceFile {
  name: string;
  path: string;
  size: number;
  type: 'file' | 'dir' | 'directory';
  mimeType?: string;
  modifiedAt: string;
  children?: WorkspaceFile[];
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

  // Workspace 文件管理
  const [workspaceVisible, setWorkspaceVisible] = useState(false);
  const [workspaceFiles, setWorkspaceFiles] = useState<WorkspaceFile[]>([]);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);

  // 附件上传状态
  const [attachments, setAttachments] = useState<Array<{ name: string; type: string; dataUrl: string }>>([]);

  // Skill 执行状态
  const [executionState, setExecutionState] = useState<ExecutionState | null>(null);

  // Agent 名称
  const [agentName, setAgentName] = useState<string>('');

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
        
        .msg-bubble-wrapper .message-actions {
          opacity: 0;
          transition: opacity 0.2s;
          display: flex;
          gap: 4px;
          align-items: center;
          margin-top: 2px;
        }
        .msg-bubble-wrapper:hover .message-actions {
          opacity: 1;
        }
        .message-actions .ant-btn {
          opacity: 0.4;
          transition: opacity 0.15s;
        }
        .message-actions .ant-btn:hover {
          opacity: 1;
        }
        
        @keyframes blink-cursor {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .placeholder-cursor {
          animation: blink-cursor 1s ease-in-out infinite;
          color: #6366f1;
          font-weight: bold;
        }
        
        /* 智能体头像：裁掉 logo 外圈白边 */
        .agent-avatar-logo .ant-avatar-img img {
          clip-path: circle(46% at 50% 50%);
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ★ 解析产物：从 AI 内容中提取代码块、表格、文档下载链接、HTML、图片
  const parseArtifacts = useCallback((content: string): Artifact[] => {
    const artifacts: Artifact[] = [];
    const seen = new Set<string>();
    let idx = 0;
    let match: RegExpExecArray | null;

    // 匹配文档下载链接: [filename.docx](url/download/token)
    const docRegex = /\[([^\]]+\.(?:docx|xlsx|html|htm|pdf))\]\(([^)]*(?:download|api\/ai\/download)\/([^/\s)]+))\)/gi;
    while ((match = docRegex.exec(content)) !== null) {
      const key = `doc-${match[1]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      artifacts.push({
        id: `artifact-doc-${idx++}`,
        type: 'document',
        title: match[1],
        content: '',
        downloadUrl: match[2],
        filename: match[1],
        token: match[3],
      });
    }

    // 匹配 HTML 代码块
    const htmlCodeRegex = /```html\n?([\s\S]*?)```/g;
    while ((match = htmlCodeRegex.exec(content)) !== null) {
      const html = match[1].trim();
      if (html.length < 50 || seen.has(`html-${html.slice(0, 40)}`)) continue;
      seen.add(`html-${html.slice(0, 40)}`);
      artifacts.push({
        id: `artifact-html-${idx++}`,
        type: 'html',
        title: 'HTML 产物',
        content: html,
      });
    }

    // 匹配完整的 HTML 文档（非代码块内）
    const fullHtmlRegex = /(?:^|\n)((?:<!DOCTYPE html>|<html)[\s\S]*?<\/html>)/i;
    while ((match = fullHtmlRegex.exec(content)) !== null) {
      const html = match[1].trim();
      if (html.length < 100 || seen.has(`doc-${html.slice(0, 40)}`)) continue;
      seen.add(`doc-${html.slice(0, 40)}`);
      artifacts.push({
        id: `artifact-doc-${idx++}`,
        type: 'html',
        title: 'HTML 文档',
        content: html,
      });
    }

    // 匹配 JSON 代码块
    const jsonCodeRegex = /```json\n?([\s\S]*?)```/g;
    while ((match = jsonCodeRegex.exec(content)) !== null) {
      const json = match[1].trim();
      if (json.length < 50 || seen.has(`json-${json.slice(0, 40)}`)) continue;
      seen.add(`json-${json.slice(0, 40)}`);
      try {
        JSON.parse(json); // 验证是合法 JSON
        artifacts.push({
          id: `artifact-json-${idx++}`,
          type: 'json',
          title: 'JSON 数据',
          content: json,
        });
      } catch { /* ignore invalid JSON */ }
    }

    // 匹配图片引用: ![alt](url) 且 url 以图片扩展名结尾
    const imgRegex = /!\[([^\]]*)\]\(([^)]+\.(?:png|jpg|jpeg|gif|svg|webp)(?:\?[^)]*)?)\)/gi;
    while ((match = imgRegex.exec(content)) !== null) {
      if (seen.has(`img-${match[2]}`)) continue;
      seen.add(`img-${match[2]}`);
      artifacts.push({
        id: `artifact-img-${idx++}`,
        type: 'image',
        title: match[1] || '图片',
        content: '',
        src: match[2],
        filename: match[2].split('/').pop(),
      });
    }

    // 匹配代码块 ```lang\ncode\n```（排除已匹配的 html/json）
    const codeRegex = /```(\w*)\n?([\s\S]*?)```/g;
    while ((match = codeRegex.exec(content)) !== null) {
      const lang = match[1] || 'text';
      const code = match[2].trim();
      if (['html', 'json'].includes(lang)) continue; // 已处理
      if (code.length < 20) continue;
      const key = `code-${lang}-${code.slice(0, 40)}`;
      if (seen.has(key)) continue;
      seen.add(key);
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
    while ((match = tableRegex.exec(content)) !== null) {
      const key = `table-${match[0].slice(0, 40)}`;
      if (seen.has(key)) continue;
      seen.add(key);
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
    return /^(graph\s+(TD|LR|BT|RL)|sequenceDiagram|classDiagram|stateDiagram(-v2)?|erDiagram|gantt|pie|flowchart\s+(TD|LR|BT|RL)|journey|gitgraph|timeline|mindmap|xychart|block|packet|quadrantChart|requirementDiagram)/i.test(firstLine);
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

  // ★ 渲染消息内容（基于 react-markdown，支持表格、Mermaid、代码块、HTML/图片/JSON 内联预览）
  const renderMessageContent = (content: string, artifacts?: Artifact[], execution?: ExecutionState | null) => {
    const artifactElements: JSX.Element[] = [];
  
    if (artifacts && artifacts.length > 0) {
      artifacts.forEach((artifact) => {
        if (artifact.type === 'table') return;

        // ★ HTML 类型：内联 iframe 预览
        if (artifact.type === 'html') {
          artifactElements.push(
            <div key={artifact.id} style={{ marginTop: 10, border: '1px solid #e8e8e8', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{
                padding: '4px 10px', background: '#f8f9fb', borderBottom: '1px solid #e8e8e8',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12,
              }}>
                <span style={{ fontWeight: 500, color: '#6366f1' }}>🌐 HTML 预览</span>
                <Button size="small" type="link" onClick={() => openCanvas(artifact)} style={{ fontSize: 11, padding: 0 }}>
                  在 Canvas 中打开
                </Button>
              </div>
              <iframe
                srcDoc={artifact.content}
                style={{ width: '100%', height: 300, border: 'none' }}
                title={artifact.title}
                sandbox="allow-same-origin allow-scripts"
              />
            </div>
          );
          return;
        }

        // ★ 图片类型：内联图片预览
        if (artifact.type === 'image') {
          const imgSrc = artifact.src || artifact.content;
          artifactElements.push(
            <div key={artifact.id} style={{ marginTop: 10 }}>
              <div style={{
                padding: '4px 0', fontSize: 12, color: '#666', fontWeight: 500,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <PictureOutlined style={{ color: '#6366f1' }} />
                <span>{artifact.filename || artifact.title}</span>
                <Button size="small" type="link" onClick={() => openCanvas(artifact)} style={{ fontSize: 11, padding: 0 }}>
                  查看原图
                </Button>
              </div>
              <img
                src={imgSrc}
                alt={artifact.title}
                style={{ maxWidth: '100%', maxHeight: 400, borderRadius: 8, border: '1px solid #e8e8e8', cursor: 'pointer' }}
                onClick={() => openCanvas(artifact)}
                loading="lazy"
              />
            </div>
          );
          return;
        }

        // ★ JSON 类型：格式化显示
        if (artifact.type === 'json') {
          let formatted = '';
          try {
            formatted = JSON.stringify(JSON.parse(artifact.content), null, 2);
          } catch {
            formatted = artifact.content;
          }
          artifactElements.push(
            <div key={artifact.id} style={{ marginTop: 10, borderRadius: 8, overflow: 'hidden', border: '1px solid #e8e8e8' }}>
              <div style={{
                padding: '4px 10px', background: '#f8f9fb', borderBottom: '1px solid #e8e8e8',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12,
              }}>
                <span style={{ fontWeight: 500, color: '#6366f1' }}>📋 JSON 数据</span>
                <Space size={4}>
                  <Button size="small" type="link" onClick={() => openCanvas(artifact)} style={{ fontSize: 11, padding: 0 }}>
                    展开
                  </Button>
                  <Button
                    size="small" type="link"
                    onClick={() => { navigator.clipboard.writeText(artifact.content); }}
                    style={{ fontSize: 11, padding: 0 }}
                  >
                    复制
                  </Button>
                </Space>
              </div>
              <pre style={{ margin: 0, padding: 10, background: '#1e1e1e', color: '#d4d4d4', fontSize: 11, maxHeight: 200, overflow: 'auto', lineHeight: 1.5 }}>
                <code>{formatted}</code>
              </pre>
            </div>
          );
          return;
        }

        // ★ 文档类型：独立渲染卡片
        if (artifact.type === 'document') {
          artifactElements.push(
            <div
              key={artifact.id}
              className="artifact-card"
              style={{
                marginTop: 10,
                padding: '8px 12px',
                background: '#fff',
                border: '1px solid #e8e8e8',
                borderRadius: 8,
                cursor: 'pointer',
                transition: 'border-color 0.15s, box-shadow 0.15s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#6366f1';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(99,102,241,0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e8e8e8';
                e.currentTarget.style.boxShadow = 'none';
              }}
              onClick={() => openCanvas(artifact)}
            >
              <Space size={8}>
                <FileTextOutlined style={{ color: '#6366f1', fontSize: 15 }} />
                <Text style={{ fontSize: 13, fontWeight: 500 }}>{artifact.filename}</Text>
                <Text type="secondary" style={{ fontSize: 11 }}>点击预览</Text>
              </Space>
              <Button
                size="small"
                type="link"
                onClick={(e) => {
                  e.stopPropagation();
                  if (artifact.downloadUrl) {
                    window.open(artifact.downloadUrl, '_blank');
                  }
                }}
                style={{ fontSize: 11, color: '#6366f1', padding: '0 4px' }}
              >
                下载
              </Button>
            </div>
          );
          return;
        }
          
        const isMermaid = artifact.type === 'code' && isMermaidCode(artifact.content);

        artifactElements.push(
          <div
            key={artifact.id}
            className="artifact-card"
            style={{
              marginTop: 10,
              padding: '8px 12px',
              background: '#fafbfc',
              border: '1px solid #e8e8e8',
              borderRadius: 8,
              cursor: 'pointer',
              transition: 'border-color 0.15s, box-shadow 0.15s',
              position: 'relative',
            }}
            onMouseEnter={(e) => {
              if (isMermaid) return;
              e.currentTarget.style.borderColor = '#6366f1';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(99,102,241,0.08)';
            }}
            onMouseLeave={(e) => {
              if (isMermaid) return;
              e.currentTarget.style.borderColor = '#e8e8e8';
              e.currentTarget.style.boxShadow = 'none';
            }}
            onClick={() => !isMermaid && openCanvas(artifact)}
          >
            <Space size={8}>
              {isMermaid ? (
                <Tag color="purple" style={{ margin: 0, fontSize: 12 }}>
                  流程图
                </Tag>
              ) : (
                <>
                  <CodeOutlined style={{ color: '#6366f1', fontSize: 14 }} />
                  <Text style={{ fontSize: 13, fontWeight: 500 }}>{artifact.title}</Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>点击查看</Text>
                </>
              )}
            </Space>
            {isMermaid ? (
              <MermaidRenderer chart={artifact.content} id={`inline-mermaid-${artifact.id}`} />
            ) : artifact.type === 'code' && (
              <pre
                style={{
                  margin: '6px 0 0',
                  padding: 8,
                  background: '#1e1e1e',
                  color: '#d4d4d4',
                  borderRadius: 6,
                  fontSize: 11,
                  maxHeight: 60,
                  overflow: 'hidden',
                  lineHeight: 1.4,
                }}
              >
                <code>{artifact.content.slice(0, 200)}{artifact.content.length > 200 ? '...' : ''}</code>
              </pre>
            )}
            {!isMermaid && (
              <div
                className="artifact-actions"
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 8,
                  opacity: 0,
                  transition: 'opacity 0.15s',
                }}
              >
                <Tooltip title="复制">
                  <Button
                    size="small"
                    icon={<CopyOutlined />}
                    type="text"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(artifact.content);
                    }}
                    style={{ fontSize: 11, color: '#999', padding: '0 4px', height: 24 }}
                  />
                </Tooltip>
              </div>
            )}
          </div>
        );
      });
    }

    // 预处理：清理 <br> 标签（ReactMarkdown 自动处理其余所有 GFM 格式）
    const preprocessed = content.replace(/<br\s*\/?>/gi, '\n');

    // ReactMarkdown 自定义组件：渲染表格/Mermaid/代码块
    const renderContent = (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ children }) => (
            <div style={{ overflowX: 'auto', marginBottom: 12 }}>
              <table style={{
                width: '100%', borderCollapse: 'collapse', fontSize: 13,
                border: '1px solid #e2e8f0', borderRadius: 6,
              }}>
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => <thead style={{ background: '#f1f5f9' }}>{children}</thead>,
          th: ({ children }) => (
            <th style={{
              padding: '8px 12px', borderBottom: '2px solid #e2e8f0',
              textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap',
            }}>
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td style={{ padding: '6px 12px', borderBottom: '1px solid #e2e8f0' }}>
              {children}
            </td>
          ),
          code: ({ className, children, ...props }) => {
            const isInline = !className;
            if (isInline) {
              return <code style={{ background: '#f0f0f0', padding: '2px 6px', borderRadius: 4, fontSize: '0.9em' }}>{children}</code>;
            }
            const codeContent = String(children).replace(/\n$/, '');
            if (isMermaidCode(codeContent)) {
              return (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#6366f1', marginBottom: 8 }}>
                    📊 流程图
                  </div>
                  <MermaidRenderer chart={codeContent} id={`md-mermaid-${Math.random().toString(36).slice(2, 8)}`} />
                </div>
              );
            }
            return (
              <pre style={{
                background: '#1e1e1e', color: '#d4d4d4', borderRadius: 8,
                padding: 12, fontSize: 12, overflow: 'auto', lineHeight: 1.5, marginBottom: 12,
              }}>
                <code>{codeContent}</code>
              </pre>
            );
          },
          p: ({ children }) => (
            <Text style={{ whiteSpace: 'pre-wrap', display: 'block', marginBottom: 8, lineHeight: 1.7 }}>
              {children}
            </Text>
          ),
        }}
      >
        {preprocessed}
      </ReactMarkdown>
    );
  
    return (
      <div>
        {renderContent}
        {artifactElements}
        {execution && renderExecutionBox(execution)}
      </div>
    );
  };

  /**
   * 渲染 Skill 执行进度 Box（固定高度、可滚动）
   */
  const renderExecutionBox = (exec: ExecutionState): JSX.Element => {
    const isRunning = exec.status === 'running';
    const totalMs = exec.totalDurationMs || (Date.now() - exec.startTime);
    
    // 状态颜色
    const statusColor = isRunning ? '#6366f1' : exec.status === 'completed' ? '#10b981' : '#ef4444';
    const statusBg = isRunning ? '#eef2ff' : exec.status === 'completed' ? '#ecfdf5' : '#fef2f2';
    const statusText = isRunning ? '执行中...' : exec.status === 'completed' ? '执行完成' : '执行失败';

    // 工具调用统计
    const totalCalls = exec.logs.filter(l => l.type === 'tool_call').length;
    const successCalls = exec.logs.filter(l => l.type === 'tool_result' && l.data.status === 'success').length;
    const errorCalls = exec.logs.filter(l => l.type === 'tool_result' && l.data.status === 'error').length;

    return (
      <div style={{
        marginTop: 12,
        border: `1px solid ${isRunning ? '#c7d2fe' : '#d1d5db'}`,
        borderRadius: 10,
        overflow: 'hidden',
        background: '#fff',
      }}>
        {/* 头部 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          background: statusBg,
          borderBottom: `1px solid ${isRunning ? '#c7d2fe' : '#e5e7eb'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: statusColor,
              display: 'inline-block',
              animation: isRunning ? 'blink-cursor 1s ease-in-out infinite' : 'none',
            }} />
            <Text strong style={{ fontSize: 13 }}>{exec.skillName}</Text>
            <Tag color={isRunning ? 'processing' : exec.status === 'completed' ? 'success' : 'error'} style={{ fontSize: 11, margin: 0 }}>
              {statusText}
            </Tag>
          </div>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {exec.logs.length} 步 · {(totalMs / 1000).toFixed(1)}s
          </Text>
        </div>

        {/* 日志列表 — 固定高度可滚动 */}
        <div style={{
          maxHeight: 280,
          overflow: 'auto',
          padding: '4px 0',
        }}>
          {exec.logs.length === 0 ? (
            <div style={{ padding: '20px 16px', textAlign: 'center' }}>
              <Spin size="small" />
              <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>正在初始化...</Text>
            </div>
          ) : (
            exec.logs.map((log, i) => {
              const d = log.data;
              const isError = d.status === 'error';
              const isPending = d.status === 'pending';
              
              // 图标
              let icon = '🔄';
              if (log.type === 'tool_call') icon = '⚡';
              else if (log.type === 'tool_result') icon = isError ? '❌' : '✅';
              else if (log.type === 'round_start') icon = '📋';
              else if (log.type === 'round_end') icon = '📦';
              else if (log.type === 'artifact') icon = '📄';
              else if (log.type === 'error') icon = '🚨';
              else if (log.type === 'done') icon = '🎉';

              return (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  padding: '5px 12px',
                  borderLeft: `3px solid ${isError ? '#ef4444' : isPending ? '#6366f1' : 'transparent'}`,
                  background: isError ? '#fef2f2' : isPending ? '#f8f9fb' : 'transparent',
                  fontSize: 12,
                  lineHeight: 1.5,
                }}>
                  <span style={{ flexShrink: 0, fontSize: 13 }}>{icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{
                        fontSize: 12,
                        color: isError ? '#dc2626' : isPending ? '#6366f1' : '#374151',
                        fontWeight: isPending ? 500 : 400,
                      }}>
                        {d.message}
                      </Text>
                      {d.durationMs && (
                        <Text type="secondary" style={{ fontSize: 10, flexShrink: 0, marginLeft: 8 }}>
                          {d.durationMs}ms
                        </Text>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          {isRunning && (
            <div style={{ padding: '6px 12px', textAlign: 'center' }}>
              <Spin size="small" />
              <Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>AI 正在决策下一步...</Text>
            </div>
          )}
        </div>

        {/* 底部：产物统计 */}
        {exec.artifacts.length > 0 && (
          <div style={{
            padding: '8px 12px',
            borderTop: '1px solid #f0f0f0',
            background: '#fafafa',
          }}>
            <Text style={{ fontSize: 11, fontWeight: 600, color: '#6366f1' }}>
              📦 交付物 ({exec.artifacts.length})
            </Text>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              {exec.artifacts.map((a, i) => (
                <Tag key={i} color="blue" style={{ fontSize: 10, margin: 0 }}>
                  {a.name}
                </Tag>
              ))}
            </div>
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
    setAttachments([]);
    setInputValue('');
    setIsLoading(true);
    setExecutionState(null);

    // ★ 乐观渲染：立即显示占位消息，不等后端返回
    const placeholderId = `msg-assistant-opt-${Date.now()}`;
    setMessages((prev) => [...prev, {
      id: placeholderId,
      role: 'assistant',
      content: '▍',
      timestamp: new Date(),
    }]);

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
          attachments: attachments.length > 0 ? attachments.map(a => ({ name: a.name, type: a.type, dataUrl: a.dataUrl })) : undefined,
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

                // ★ 处理 Skill 执行事件
                if (data.type === 'execution_start') {
                  setExecutionState({
                    skillName: data.data.skillName,
                    skillId: data.data.skillId,
                    logs: [],
                    artifacts: [],
                    status: 'running',
                    startTime: Date.now(),
                  });
                  // 在对话中插入一个标记
                  assistantContent += `\n\n> **Skill 执行中**: ${data.data.skillName}\n`;
                  continue;
                }

                if (data.type === 'execution_progress' && data.data) {
                  const progress = data.data;
                  setExecutionState((prev) => {
                    if (!prev) return null;
                    const newLogs = [...prev.logs, {
                      type: progress.type,
                      data: progress.data,
                      artifacts: progress.artifacts,
                    }];
                    return {
                      ...prev,
                      logs: newLogs,
                      artifacts: progress.artifacts || prev.artifacts,
                    };
                  });
                  continue;
                }

                if (data.type === 'execution_done' && data.data) {
                  const doneData = data.data;
                  setExecutionState((prev) => {
                    if (!prev) return null;
                    return {
                      ...prev,
                      status: 'completed',
                      artifacts: doneData.artifacts || prev.artifacts,
                      totalRounds: doneData.totalRounds,
                      totalDurationMs: doneData.totalDurationMs,
                      output: doneData.output,
                    };
                  });
                  // 在对话中追加完成信息
                  assistantContent += `\n✅ **${doneData.skillName}** 执行完成！共 ${doneData.totalRounds} 轮，耗时 ${(doneData.totalDurationMs / 1000).toFixed(1)} 秒，产出 ${doneData.artifacts?.length || 0} 个交付物。`;
                  continue;
                }

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
      // 更新占位消息为错误信息
      setMessages((prev) => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg?.role === 'assistant' && lastMsg.id.startsWith('msg-assistant')) {
          return [...prev.slice(0, -1), {
            ...lastMsg,
            content: `⚠️ API 连接失败，请检查配置。\n\n错误信息: ${error.message}`,
            timestamp: new Date(),
          }];
        }
        return [...prev, {
          id: `msg-fallback-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ API 连接失败，请检查配置。\n\n错误信息: ${error.message}`,
          timestamp: new Date(),
        }];
      });
    }

    setIsLoading(false);
  };

  const clearChat = () => {
    setMessages([]);
    setCanvasOpen(false);
    setCurrentArtifact(null);
    setLeftWidth(100);
    setExecutionState(null);
  };

  // ★ 导出整个对话为 Word
  const exportChatAsWord = async () => {
    const fullContent = messages.map(m => (m.role === 'user' ? `用户: ${m.content}` : `助手: ${m.content}`)).join('\n\n');
    if (!fullContent.trim()) { message.warning('没有内容可导出'); return; }
    try {
      const API_BASE = import.meta.env.VITE_API_URL || 'https://skill-platform-backend-production.up.railway.app/api';
      const token = useAuthStore.getState().token;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const resp = await fetch(`${API_BASE}/ai/export-docx`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ content: fullContent, format: 'docx', filename: `对话记录_${Date.now()}.docx` }),
      });
      if (!resp.ok) { throw new Error('导出失败'); }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `对话记录_${Date.now()}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      message.error('导出失败: ' + (e.message || '未知错误'));
    }
  };

  // ★ 复制整个对话
  const copyAllMessages = () => {
    const text = messages.map(m => (m.role === 'user' ? `用户: ${m.content}` : `助手: ${m.content}`)).join('\n\n---\n\n');
    if (!text.trim()) { message.warning('没有内容可复制'); return; }
    navigator.clipboard.writeText(text);
    message.success('已复制全部对话');
  };

  // ★ 文件上传处理（限制 10MB）
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  const handleFileSelect = (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      message.warning(`文件「${file.name}」超过 10MB 大小限制，请压缩后重试`);
      return Upload.LIST_IGNORE;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setAttachments(prev => [...prev, { name: file.name, type: file.type, dataUrl }]);
    };
    reader.readAsDataURL(file);
    return false; // 阻止默认上传
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // ============ 会话管理 ============

  // 加载历史会话列表
  const loadConversations = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const resp = await fetch(`${API_BASE}/ai/conversations`);
      if (resp.ok) {
        const data = await resp.json();
        // 兼容全局拦截器包装格式 {success, data, timestamp}
        const list = Array.isArray(data) ? data : (data?.data || []);
        setConversations(list);
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
        // 兼容全局拦截器包装格式 {success, data, timestamp}
        const raw = data?.data || data;
        const historyMessages: Message[] = (raw.messages || []).map(
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

  // ★ 获取 Agent 名称
  useEffect(() => {
    if (!agentId) return;
    const token = useAuthStore.getState().token;
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    fetch(`${API_BASE}/agents/${agentId}`, { headers })
      .then(res => res.json())
      .then(data => {
        const agent = data?.data || data;
        if (agent?.name) setAgentName(agent.name);
      })
      .catch(() => {});
  }, [agentId]);

  // ★ 前端预热：唤醒 Railway 冷启动 + 每4分钟心跳保活
  useEffect(() => {
    const warmup = () => {
      fetch(`${API_BASE}/ai/health`, { method: 'GET', mode: 'cors' }).catch(() => {});
    };

    warmup(); // 组件挂载时立即预热（触发 Railway 容器启动）
    const interval = setInterval(warmup, 4 * 60 * 1000); // 每4分钟保活（Railway 空闲超时 5-15分钟）
    return () => clearInterval(interval);
  }, []);

  // ============ Workspace 文件管理 ============

  const loadWorkspaceFiles = useCallback(async () => {
    if (!currentThreadId) return;
    setLoadingWorkspace(true);
    try {
      const resp = await fetch(`${API_BASE}/workspace/${encodeURIComponent(currentThreadId)}/tree`);
      if (resp.ok) {
        const data = await resp.json();
        // 兼容全局拦截器双层包装 {success,data:{success,data:{tree}}} 和单层 {success,data:{tree}}
        const tree = data?.data?.data?.tree || data?.data?.tree || data?.tree || [];
        setWorkspaceFiles(tree);
      }
    } catch {
      message.error('加载工作区文件失败');
    } finally {
      setLoadingWorkspace(false);
    }
  }, [currentThreadId]);

  // 打开 workspace 面板时自动加载
  useEffect(() => {
    if (workspaceVisible) {
      loadWorkspaceFiles();
    }
  }, [workspaceVisible, loadWorkspaceFiles]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleWorkspaceFileClick = async (file: WorkspaceFile) => {
    if (file.type === 'directory' || file.type === 'dir') return;
    const downloadUrl = `${API_BASE}/workspace/${encodeURIComponent(currentThreadId)}/files?download=${encodeURIComponent(file.path)}`;

    // HTML 文件：直接内联预览
    if (file.mimeType === 'text/html' || file.name.endsWith('.html') || file.name.endsWith('.htm')) {
      try {
        const resp = await fetch(downloadUrl);
        const html = await resp.text();
        openCanvas({
          id: `workspace-html-${Date.now()}`,
          type: 'html',
          title: file.name,
          content: html,
          filename: file.name,
        });
      } catch {
        window.open(downloadUrl, '_blank');
      }
      return;
    }

    // 图片文件：Canvas 预览
    if (file.mimeType?.startsWith('image/')) {
      openCanvas({
        id: `workspace-img-${Date.now()}`,
        type: 'image',
        title: file.name,
        content: '',
        src: downloadUrl,
        filename: file.name,
        downloadUrl,
      });
      return;
    }

    // JSON 文件
    if (file.mimeType === 'application/json' || file.name.endsWith('.json')) {
      try {
        const resp = await fetch(downloadUrl);
        const text = await resp.text();
        openCanvas({
          id: `workspace-json-${Date.now()}`,
          type: 'json',
          title: file.name,
          content: text,
          filename: file.name,
        });
      } catch {
        window.open(downloadUrl, '_blank');
      }
      return;
    }

    const previewTypes = ['text/plain', 'text/markdown', 'text/csv',
      'application/json', 'image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/webp'];
    const canPreview = file.mimeType && previewTypes.includes(file.mimeType);

    if (canPreview) {
      window.open(downloadUrl, '_blank');
    } else {
      window.open(downloadUrl, '_blank');
    }
  };

  const handleDeleteWorkspaceFile = async (file: WorkspaceFile, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const resp = await fetch(
        `${API_BASE}/workspace/${encodeURIComponent(currentThreadId)}/files?delete=${encodeURIComponent(file.path)}`,
        { method: 'DELETE' },
      );
      if (resp.ok) {
        message.success(`已删除: ${file.name}`);
        loadWorkspaceFiles();
      } else {
        message.error('删除失败');
      }
    } catch {
      message.error('删除失败');
    }
  };

  const renderFileTree = (files: WorkspaceFile[], depth: number = 0): JSX.Element[] => {
    return files.map((file) => {
      const isDir = file.type === 'directory' || file.type === 'dir';
      const icon = isDir ? (
        <FolderOutlined style={{ color: '#faad14', fontSize: 15 }} />
      ) : (
        <FileOutlined style={{ color: '#6366f1', fontSize: 15 }} />
      );

      return (
        <div key={file.path}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 8px',
              paddingLeft: 16 + depth * 20,
              borderRadius: 6,
              cursor: isDir ? 'default' : 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f5f5'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            onClick={() => handleWorkspaceFileClick(file)}
          >
            <Space size={8} style={{ flex: 1, minWidth: 0 }}>
              {icon}
              <Text
                style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                title={file.name}
              >
                {file.name}
              </Text>
              {!isDir && (
                <Text type="secondary" style={{ fontSize: 11, flexShrink: 0 }}>
                  {formatFileSize(file.size)}
                </Text>
              )}
            </Space>
            {!isDir && (
              <Space size={2}>
                <Tooltip title="下载">
                  <Button
                    type="text"
                    size="small"
                    icon={<DownloadOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleWorkspaceFileClick(file);
                    }}
                    style={{ fontSize: 12, color: '#999' }}
                  />
                </Tooltip>
                <Tooltip title="删除">
                  <Button
                    type="text"
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={(e) => handleDeleteWorkspaceFile(file, e)}
                    style={{ fontSize: 12, color: '#999' }}
                    danger
                  />
                </Tooltip>
              </Space>
            )}
          </div>
          {isDir && file.children && file.children.length > 0 && (
            <div>{renderFileTree(file.children, depth + 1)}</div>
          )}
        </div>
      );
    });
  };

  // ★ 文档预览状态
  const [docPreviewHtml, setDocPreviewHtml] = useState<string>('');
  const [docPreviewLoading, setDocPreviewLoading] = useState(false);

  // 当文档 artifact 打开时，获取预览 HTML
  useEffect(() => {
    if (currentArtifact?.type === 'document' && currentArtifact.token) {
      setDocPreviewLoading(true);
      setDocPreviewHtml('');
      const previewUrl = `${API_BASE}/ai/preview/${currentArtifact.token}`;
      fetch(previewUrl)
        .then(res => res.text())
        .then(html => {
          setDocPreviewHtml(html);
          setDocPreviewLoading(false);
        })
        .catch(() => {
          setDocPreviewHtml('<p style="color:red;text-align:center;padding:40px;">预览加载失败，请尝试直接下载</p>');
          setDocPreviewLoading(false);
        });
    }
  }, [currentArtifact?.id, currentArtifact?.type, currentArtifact?.token]);

  // Canvas 内容渲染
  const renderCanvasContent = () => {
    if (!currentArtifact) {
      return (
        <Empty description="点击对话中的产物卡片查看详情" image={Empty.PRESENTED_IMAGE_SIMPLE}>
          <Text type="secondary">产物将在 Canvas 中展开展示</Text>
        </Empty>
      );
    }

    const { content, type, language, src, filename } = currentArtifact;

    // ★ HTML 预览：内嵌完整 iframe
    if (type === 'html') {
      return (
        <iframe
          srcDoc={content}
          style={{ width: '100%', height: '100%', border: 'none', borderRadius: 8 }}
          title="HTML 预览"
          sandbox="allow-same-origin allow-scripts"
        />
      );
    }

    // ★ 图片预览
    if (type === 'image') {
      const imgSrc = src || content;
      return (
        <div style={{ textAlign: 'center', padding: 20 }}>
          <img
            src={imgSrc}
            alt={filename || '图片'}
            style={{ maxWidth: '100%', maxHeight: 'calc(100vh - 200px)', borderRadius: 8, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}
          />
          <div style={{ marginTop: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>{filename}</Text>
          </div>
        </div>
      );
    }

    // ★ JSON 预览：格式化展示
    if (type === 'json') {
      let formatted = '';
      try {
        formatted = JSON.stringify(JSON.parse(content), null, 2);
      } catch {
        formatted = content;
      }
      return (
        <div>
          <div style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0', marginBottom: 12 }}>
            <Text type="secondary" style={{ fontSize: 12, fontFamily: 'monospace' }}>JSON · {formatted.split('\n').length} 行</Text>
          </div>
          <pre style={{ margin: 0, padding: 16, background: '#1e1e1e', color: '#d4d4d4', borderRadius: 8, overflow: 'auto', fontSize: 13, lineHeight: 1.6, maxHeight: 'calc(100vh - 250px)' }}>
            <code>{formatted}</code>
          </pre>
        </div>
      );
    }

    // ★ 文档预览：内嵌 iframe 展示 HTML（由后端 mammoth 转换）
    if (type === 'document') {
      if (docPreviewLoading) {
        return (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <Spin size="large" />
            <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>正在加载文档预览...</Text>
          </div>
        );
      }
      if (!docPreviewHtml) {
        return <Text type="secondary">正在准备预览...</Text>;
      }
      return (
        <iframe
          srcDoc={docPreviewHtml}
          style={{ width: '100%', height: '100%', border: 'none', borderRadius: 8 }}
          title="文档预览"
          sandbox="allow-same-origin"
        />
      );
    }

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
    <div ref={containerRef} style={{ height: isMobile ? '100vh' : 'calc(100vh - 56px - 32px)', display: 'flex', flexDirection: 'column' }}>
      {/* 顶部工具栏 */}
      <div style={{
        padding: isMobile ? '6px 10px' : '8px 16px',
        borderBottom: '1px solid #f0f0f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0,
        background: '#fff',
      }}>
        {isMobile ? (
          <Space size="small">
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/dashboard')}
              style={{ fontSize: 16, color: '#333' }}
            />
            <RobotOutlined style={{ color: '#6366f1', fontSize: 16 }} />
            <Text strong style={{ fontSize: 15 }}>{agentName || (agentId ? `Agent #${agentId}` : 'AI 对话')}</Text>
          </Space>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 26, height: 26, borderRadius: 7,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <RobotOutlined style={{ color: '#fff', fontSize: 13 }} />
            </div>
            <div>
              <Text strong style={{ fontSize: 14, display: 'block', lineHeight: 1.3 }}>
                {agentName || 'Agent 对话'}
              </Text>
            </div>
            <Tooltip title="点击复制 Thread ID">
              <Text
                style={{ fontSize: 10, color: '#ccc', cursor: 'pointer', marginLeft: 2 }}
                onClick={() => { navigator.clipboard.writeText(currentThreadId); message.success('Thread ID 已复制'); }}
              >
                #{currentThreadId.slice(-6)}
              </Text>
            </Tooltip>
          </div>
        )}
        <Space size="small">
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
              <Button
                type="text"
                size="small"
                onClick={newConversation}
                style={{ fontSize: 13, color: '#6366f1', fontWeight: 500 }}
              >
                新建
              </Button>
              <Tooltip title="工作区文件">
                <Button
                  icon={<FolderOpenOutlined />}
                  size="small"
                  type="text"
                  onClick={() => setWorkspaceVisible(true)}
                />
              </Tooltip>
            </>
          ) : (
            <>
              <Tooltip title="历史会话">
                <Button
                  icon={<HistoryOutlined />}
                  size="small"
                  type="text"
                  onClick={() => { loadConversations(); setHistoryVisible(true); }}
                />
              </Tooltip>
              <Tooltip title="清空对话">
                <Button
                  icon={<ClearOutlined />}
                  size="small"
                  type="text"
                  onClick={clearChat}
                />
              </Tooltip>
              <Button
                type="text"
                size="small"
                onClick={newConversation}
                style={{ fontSize: 13, color: '#6366f1', fontWeight: 500 }}
              >
                新建
              </Button>
              <Tooltip title="工作区文件">
                <Button
                  icon={<FolderOpenOutlined />}
                  size="small"
                  type="text"
                  onClick={() => setWorkspaceVisible(true)}
                />
              </Tooltip>
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
              background: '#f8f9fb',
            }}
          >
            {messages.length === 0 ? (
              <div style={{
                textAlign: 'center',
                paddingTop: isMobile ? '25vh' : '18vh',
                maxWidth: 400,
                margin: '0 auto',
              }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 14,
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 20px',
                  boxShadow: '0 4px 20px rgba(99,102,241,0.15)',
                }}>
                  <RobotOutlined style={{ color: '#fff', fontSize: 26 }} />
                </div>
                <Title level={4} style={{ marginBottom: 6, fontWeight: 600, fontSize: 18 }}>
                  {agentName || 'AI 对话'}
                </Title>
                <Text type="secondary" style={{ fontSize: 13, lineHeight: 1.6 }}>
                  输入问题，Agent 将为您分析解答
                </Text>
              </div>
            ) : (
              messages.map((msg, idx) => {
                const isLastAssistant = msg.role === 'assistant' && idx === messages.length - 1;
                const showGlobalActions = isLastAssistant && !isLoading;
                return (
                  <div
                    key={msg.id}
                    className="msg-bubble-wrapper"
                    style={{
                      display: 'flex',
                      marginBottom: 10,
                      flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                      alignItems: 'flex-start',
                    }}
                  >
                    <Avatar
                      src={msg.role === 'user' ? undefined : "/logo.png"}
                      icon={msg.role === 'user' ? <UserOutlined /> : undefined}
                      className={msg.role !== 'user' ? 'agent-avatar-logo' : undefined}
                      size={32}
                      style={{
                        backgroundColor: msg.role === 'user' ? '#10b981' : '#1a237e',
                        flexShrink: 0,
                      }}
                    />
                    <div
                      style={{
                        maxWidth: '82%',
                        marginLeft: msg.role === 'user' ? 0 : 8,
                        marginRight: msg.role === 'user' ? 8 : 0,
                        padding: msg.role === 'user' ? '6px 12px' : '8px 12px',
                        borderRadius: 10,
                        background: msg.role === 'user' ? '#e8f5e9' : '#fff',
                        boxShadow: msg.role === 'user' ? 'none' : '0 1px 2px rgba(0,0,0,0.04)',
                        border: msg.role === 'user' ? 'none' : '1px solid #f0f0f0',
                        lineHeight: 1.55,
                      }}
                    >
                      {msg.content === '▍' ? (
                        <span className="placeholder-cursor">▍ 正在生成...</span>
                      ) : (
                        renderMessageContent(msg.content, msg.artifacts, isLastAssistant ? executionState : null)
                      )}
                      
                      {/* 助手回复的 hover 操作按钮 */}
                      {msg.role === 'assistant' && (
                        <div className="message-actions">
                          <Tooltip title="复制此回复">
                            <Button
                              type="text"
                              size="small"
                              icon={<CopyOutlined />}
                              onClick={() => {
                                navigator.clipboard.writeText(msg.content);
                                message.success('已复制此回复');
                              }}
                              style={{ fontSize: 11, color: '#999', padding: '2px 4px' }}
                            />
                          </Tooltip>
                          
                          {showGlobalActions && (
                            <>
                              <span style={{ color: '#e8e8e8', fontSize: 12, margin: '0 4px' }}>|</span>
                              <Tooltip title="复制全部对话">
                                <Button
                                  type="text"
                                  size="small"
                                  icon={<CopyOutlined />}
                                  onClick={copyAllMessages}
                                  style={{ fontSize: 11, color: '#999', padding: '2px 4px' }}
                                />
                              </Tooltip>
                              <Tooltip title="导出 Word">
                                <Button
                                  type="text"
                                  size="small"
                                  icon={<FileTextOutlined />}
                                  onClick={exportChatAsWord}
                                  style={{ fontSize: 11, color: '#999', padding: '2px 4px' }}
                                />
                              </Tooltip>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '4px 0' }}>
                <Avatar
                  src="/logo.png"
                  className="agent-avatar-logo"
                  size={32}
                  style={{ backgroundColor: '#1a237e', flexShrink: 0 }}
                />
                <div style={{
                  padding: '6px 12px',
                  background: '#f8f9fb',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}>
                  <Spin size="small" />
                  <Text type="secondary" style={{ fontSize: 12 }}>思考中...</Text>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>



          {/* 输入区 */}
          <div style={{ padding: isMobile ? '6px 8px 8px' : '8px 16px 14px', borderTop: '1px solid #f0f0f0', background: '#fff', flexShrink: 0 }}>
            {/* 附件预览 */}
            {attachments.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8, padding: '4px 0' }}>
                {attachments.map((att, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '4px 8px', background: '#f0f5ff', borderRadius: 6,
                    border: '1px solid #d6e4ff', fontSize: 12,
                  }}>
                    {att.type.startsWith('image/') ? (
                      <img src={att.dataUrl} alt={att.name} style={{ width: 20, height: 20, borderRadius: 2, objectFit: 'cover' }} />
                    ) : (
                      <PaperClipOutlined style={{ color: '#6366f1' }} />
                    )}
                    <Text style={{ fontSize: 12, maxWidth: 120 }} ellipsis>{att.name}</Text>
                    <Button type="text" size="small" icon={<CloseOutlined />} onClick={() => removeAttachment(i)} style={{ fontSize: 10, width: 18, height: 18 }} />
                  </div>
                ))}
              </div>
            )}

            {/* 输入框容器 */}
            <div style={{
              borderRadius: 12,
              border: '1px solid #e0e0e0',
              background: '#f8f9fb',
              overflow: 'hidden',
              transition: 'border-color 0.2s',
            }}>
              <TextArea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="输入消息，@添加上下文，/使用命令"
                autoSize={{ minRows: isMobile ? 1 : 2, maxRows: 6 }}
                onPressEnter={(e) => {
                  if (!e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                disabled={isLoading}
                style={{ border: 'none', background: 'transparent', padding: '12px 14px 8px', fontSize: 14, resize: 'none', boxShadow: 'none' }}
              />
              {/* 工具栏 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px 6px 12px' }}>
                <Space size={4}>
                  <Upload beforeUpload={handleFileSelect} showUploadList={false} accept="image/*,.pdf,.doc,.docx,.txt,.xls,.xlsx,.csv">
                    <Tooltip title="上传附件">
                      <Button type="text" icon={<PaperClipOutlined />} size="small" style={{ color: '#8a8a8a', fontSize: 16 }} />
                    </Tooltip>
                  </Upload>
                  <Upload beforeUpload={handleFileSelect} showUploadList={false} accept="image/*">
                    <Tooltip title="上传图片">
                      <Button type="text" icon={<PictureOutlined />} size="small" style={{ color: '#8a8a8a', fontSize: 16 }} />
                    </Tooltip>
                  </Upload>
                  <Select
                    value={selectedModel}
                    onChange={setSelectedModel}
                    size="small"
                    style={{ width: 110, fontSize: 12 }}
                    bordered={false}
                    options={[
                      { value: 'qwen-turbo', label: 'Turbo' },
                      { value: 'qwen-plus', label: 'Plus' },
                      { value: 'qwen-max', label: 'Max' },
                    ]}
                  />
                </Space>
                <Space size={2}>
                  <Text type="secondary" style={{ fontSize: 11, color: '#bbb' }}>↵ Enter</Text>
                  <Button
                    type="primary"
                    shape="circle"
                    icon={<SendOutlined />}
                    onClick={sendMessage}
                    loading={isLoading}
                    size="small"
                    style={{ background: '#6366f1', border: 'none', width: 28, height: 28 }}
                  />
                </Space>
              </div>
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
            <div style={{ padding: '10px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, background: '#fff' }}>
              <Space>
                <AppstoreOutlined style={{ color: '#6366f1' }} />
                <Text strong>🎨 Canvas</Text>
                {currentArtifact && (
                  <Tag color="blue">{currentArtifact.title}</Tag>
                )}
              </Space>
              <Space>
                {currentArtifact?.type !== 'document' && currentArtifact?.type !== 'html' && currentArtifact?.type !== 'image' && currentArtifact?.type !== 'json' && (
                  <>
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
                  </>
                )}
                {currentArtifact && currentArtifact.type !== 'document' && currentArtifact.type !== 'image' && currentArtifact.type !== 'html' && (
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
                {(currentArtifact?.type === 'document' || currentArtifact?.type === 'image') && currentArtifact.downloadUrl && (
                  <Button
                    size="small"
                    type="primary"
                    icon={currentArtifact.type === 'image' ? <PictureOutlined /> : <FileTextOutlined />}
                    onClick={() => {
                      window.open(currentArtifact.downloadUrl, '_blank');
                    }}
                  >
                    下载
                  </Button>
                )}
                {currentArtifact?.type === 'html' && (
                  <Button
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={() => {
                      navigator.clipboard.writeText(currentArtifact.content);
                    }}
                  >
                    复制源码
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
        width={isMobile ? '100%' : 340}
        styles={{ body: { padding: isMobile ? 8 : 16 } }}
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

      {/* Workspace 工作区抽屉 */}
      <Drawer
        title={
          <Space>
            <FolderOpenOutlined style={{ color: '#6366f1' }} />
            <span>工作区文件</span>
            <Text type="secondary" style={{ fontSize: 11, fontWeight: 'normal' }}>
              #{currentThreadId.slice(-6)}
            </Text>
          </Space>
        }
        placement="right"
        open={workspaceVisible}
        onClose={() => setWorkspaceVisible(false)}
        width={isMobile ? '100%' : 380}
        styles={{ body: { padding: isMobile ? 8 : 12 } }}
        extra={
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={loadWorkspaceFiles}
            loading={loadingWorkspace}
          >
            刷新
          </Button>
        }
      >
        {loadingWorkspace ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="default" />
            <Text type="secondary" style={{ display: 'block', marginTop: 12 }}>加载中...</Text>
          </div>
        ) : workspaceFiles.length === 0 ? (
          <Empty
            description={
              <span>
                暂无文件<br />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  AI 生成的文档和报告将自动保存到这里
                </Text>
              </span>
            }
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <div style={{ maxHeight: 'calc(100vh - 180px)', overflow: 'auto' }}>
            {renderFileTree(workspaceFiles)}
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default AgentChatCanvas;
