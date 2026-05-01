/**
 * MermaidRenderer - Mermaid 流程图渲染组件
 * 接收 Mermaid 语法字符串，渲染为可交互的 SVG 流程图
 */
import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { Spin } from 'antd';

mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  themeVariables: {
    primaryColor: '#6366f1',
    primaryTextColor: '#1e293b',
    primaryBorderColor: '#6366f1',
    lineColor: '#94a3b8',
    secondaryColor: '#f1f5f9',
    tertiaryColor: '#f8fafc',
    fontSize: '14px',
  },
  flowchart: {
    useMaxWidth: true,
    htmlLabels: true,
    curve: 'basis',
  },
  sequence: {
    showSequenceNumbers: false,
  },
  securityLevel: 'loose',
});

// 抑制 Mermaid 内部的 console.error 污染（渲染失败已有降级处理）
const originalError = console.error;
if (!(window as any).__MERMAID_PATCHED) {
  (window as any).__MERMAID_PATCHED = true;
  console.error = (...args: any[]) => {
    const msg = args.join(' ');
    if (msg.includes('mermaid') || msg.includes('Syntax error') || msg.includes('Parse error')) return;
    originalError.apply(console, args);
  };
  mermaid.parseError = () => {};
}

// 定期清理 Mermaid 散落在 body 层的错误 DOM 元素（流式渲染时的累积问题）
function cleanupMermaidErrors() {
  if (typeof document === 'undefined') return;
  try {
    // 清理所有 Mermaid 在 body 上创建的带有 error 的内容
    document.querySelectorAll('g.error, text.error, [class*="mermaid-error"], .error-icon, .error-text')
      .forEach(el => el.remove());
    // 清理 Mermaid 添加到 body 的零散错误 SVG（没有在容器内的 SVG）
    document.querySelectorAll('body > svg.error, body > div.error, body > [data-error]')
      .forEach(el => el.remove());
  } catch {}
}

// 每 2 秒清理一次（轻量级）
if (typeof window !== 'undefined' && !(window as any).__MERMAID_CLEANUP_INIT) {
  (window as any).__MERMAID_CLEANUP_INIT = true;
  setInterval(cleanupMermaidErrors, 2000);
}

interface Props {
  chart: string;
  id?: string;
}

const MermaidRenderer: React.FC<Props> = ({ chart, id: externalId }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderId = useRef(externalId || `mermaid-${Math.random().toString(36).slice(2, 9)}`);
  const renderAttempted = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    // 每次 chart 变化时：清除之前的计时器和渲染标记
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    renderAttempted.current = false;
    setStatus('loading');

    // 防抖：300ms 内没有新变化才真正开始渲染
    debounceTimer.current = setTimeout(() => {
      if (!containerRef.current) return;
      if (renderAttempted.current) return;
      renderAttempted.current = true;

      const doRender = async () => {
        try {
          // 彻底清理容器内的所有内容
          containerRef.current!.innerHTML = '';

          // 预处理：给含中文的节点内容加引号，提升兼容性
          const preprocessedChart = chart
            .replace(/\[([^\]]*[\u4e00-\u9fff][^\]]*)\]/g, '["$1"]')
            .replace(/\{([^}]*[\u4e00-\u9fff][^}]*)\}/g, '{"$1"}')
            // 处理中文全角括号 -> 半角（Mermaid 对全角括号解析有问题）
            .replace(/（/g, '(').replace(/）/g, ')')
            // 移除 node 描述中的多余换行
            .replace(/\[([^\]]*)\n/g, '[$1');

          const { svg } = await mermaid.render(renderId.current, preprocessedChart);
          if (containerRef.current) {
            containerRef.current.innerHTML = svg;
            setStatus('success');
          }
        } catch (e: any) {
          // 出错时：先清理 mermaid 可能已写入的 DOM 元素
          if (containerRef.current) {
            containerRef.current.innerHTML = '';
            containerRef.current.innerHTML = `<pre style="background:#1e1e1e;color:#d4d4d4;padding:12px;border-radius:8px;overflow:auto;font-size:12px;line-height:1.5;margin:0">${escapeHtml(chart)}</pre>`;
          }
          setStatus('error');
        }
      };
      doRender();
    }, 300);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [chart]);

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 8,
        border: '1px solid #e2e8f0',
        padding: 16,
        marginBottom: 12,
        overflow: 'auto',
        minHeight: status === 'loading' ? 100 : 'auto',
      }}
    >
      {status === 'loading' && (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Spin size="small" />
          <div style={{ color: '#999', fontSize: 12, marginTop: 8 }}>流程图渲染中...</div>
        </div>
      )}
      <div ref={containerRef} style={{ display: status === 'loading' ? 'none' : 'block' }} />
    </div>
  );
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export default MermaidRenderer;
