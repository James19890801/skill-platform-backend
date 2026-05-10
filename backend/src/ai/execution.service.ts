import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, mkdtemp } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

const execFileAsync = promisify(execFile);

export interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  durationMs: number;
}

type WebSearchProvider = 'auto' | 'bing' | 'duckduckgo';

@Injectable()
export class ExecutionService {
  private readonly logger = new Logger(ExecutionService.name);
  private readonly PYTHON_PATH = 'python3';
  private readonly MAX_OUTPUT_LENGTH = 50_000;
  private readonly DEFAULT_TIMEOUT_MS = 30_000;

  /**
   * 执行 Python 代码（沙箱模式）
   * - 写入临时文件后执行
   * - 超时控制
   * - 输出截断保护
   */
  async executePython(code: string, timeoutMs?: number): Promise<ExecutionResult> {
    const startTime = Date.now();
    const tmpDir = await mkdtemp(join(tmpdir(), 'pyexec-'));
    const filePath = join(tmpDir, 'script.py');

    try {
      // 安全检查：禁止危险操作
      this.sanitizePythonCode(code);

      await writeFile(filePath, code, 'utf-8');
      const timeout = timeoutMs || this.DEFAULT_TIMEOUT_MS;

      const { stdout, stderr } = await execFileAsync(
        this.PYTHON_PATH,
        [filePath],
        {
          timeout,
          maxBuffer: this.MAX_OUTPUT_LENGTH,
          env: { ...process.env, PYTHONUNBUFFERED: '1' },
        },
      );

      const duration = Date.now() - startTime;
      let output = '';
      if (stdout) output += stdout;
      if (stderr) output += `\n[STDERR]\n${stderr}`;
      output = output.slice(0, this.MAX_OUTPUT_LENGTH);

      return {
        success: true,
        output: output.trim() || '代码执行完成（无输出）',
        durationMs: duration,
      };
    } catch (err: any) {
      const duration = Date.now() - startTime;
      if (err?.stderr) {
        return {
          success: false,
          output: '',
          error: err.stderr.slice(0, 5000),
          durationMs: duration,
        };
      }
      if (err?.code === 'ETIMEDOUT') {
        return {
          success: false,
          output: '',
          error: `执行超时（${(timeoutMs || this.DEFAULT_TIMEOUT_MS) / 1000}秒）`,
          durationMs: duration,
        };
      }
      return {
        success: false,
        output: '',
        error: `执行错误: ${err?.message || String(err)}`,
        durationMs: duration,
      };
    } finally {
      // 清理临时文件
      try { await unlink(filePath); } catch { /* ignore */ }
      try { const { rmdir } = await import('fs/promises'); await rmdir(tmpDir); } catch { /* ignore */ }
    }
  }

  /**
   * 搜索网络。
   * - 默认优先 Bing：有 BING_SEARCH_API_KEY 时走官方接口；没有 Key 时走 Bing HTML 轻量检索
   * - DuckDuckGo 作为可选兜底，减少必须购买外部服务的压力
   */
  async searchWeb(query: string, maxResults: number = 5, provider: WebSearchProvider = 'bing'): Promise<ExecutionResult> {
    const normalized = provider || 'bing';
    if (normalized === 'bing' || normalized === 'auto') {
      const bingResult = await this.searchBing(query, maxResults);
      if (bingResult.success || normalized === 'bing') {
        return bingResult;
      }
    }
    return this.searchDuckDuckGo(query, maxResults);
  }

  async searchBing(query: string, maxResults: number = 5): Promise<ExecutionResult> {
    const startTime = Date.now();
    const limit = Math.max(1, Math.min(Number(maxResults) || 5, 10));
    const apiKey = process.env.BING_SEARCH_API_KEY || process.env.BING_API_KEY;
    const endpoint = process.env.BING_SEARCH_ENDPOINT || 'https://api.bing.microsoft.com/v7.0/search';

    try {
      if (apiKey) {
        const url = new URL(endpoint);
        url.searchParams.set('q', query);
        url.searchParams.set('count', String(limit));
        url.searchParams.set('mkt', process.env.BING_SEARCH_MARKET || 'zh-CN');
        const res = await fetch(url, {
          headers: { 'Ocp-Apim-Subscription-Key': apiKey },
          signal: AbortSignal.timeout(12000),
        });
        if (!res.ok) {
          throw new Error(`Bing API returned ${res.status}`);
        }
        const body = await res.json() as any;
        const results = (body.webPages?.value || []).slice(0, limit).map((item: any) => ({
          title: item.name || '',
          snippet: item.snippet || '',
          url: item.url || '',
          provider: 'bing',
        }));
        return {
          success: true,
          output: JSON.stringify(results, null, 2),
          durationMs: Date.now() - startTime,
        };
      }

      const url = new URL('https://www.bing.com/search');
      url.searchParams.set('q', query);
      url.searchParams.set('count', String(limit));
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 SkillPlatformRuntime/1.0',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        },
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) {
        throw new Error(`Bing HTML returned ${res.status}`);
      }
      const html = await res.text();
      const results = this.parseBingResults(html, limit);
      if (results.length === 0) {
        throw new Error('Bing did not return parsable results');
      }
      return {
        success: true,
        output: JSON.stringify(results, null, 2),
        durationMs: Date.now() - startTime,
      };
    } catch (err: any) {
      return {
        success: false,
        output: '',
        error: `Bing 搜索失败: ${err?.message || String(err)}`,
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * 使用 DuckDuckGo 搜索网络（无需 API Key）。
   */
  private async searchDuckDuckGo(query: string, maxResults: number = 5): Promise<ExecutionResult> {
    const code = `
import sys, json
try:
    from duckduckgo_search import DDGS
    results = []
    with DDGS() as ddgs:
        for i, r in enumerate(ddgs.text(\"${this.escapePythonString(query)}\", max_results=${maxResults})):
            results.append({
                \"title\": r.get(\"title\", \"\"),
                \"snippet\": r.get(\"body\", \"\"),
                \"url\": r.get(\"href\", \"\")
            })
    print(json.dumps(results, ensure_ascii=False))
except ImportError:
    print(json.dumps({\"error\": \"duckduckgo-search 未安装\"}))
except Exception as e:
    print(json.dumps({\"error\": str(e)}))
`;
    return this.executePython(code, 15_000);
  }

  private parseBingResults(html: string, maxResults: number): Array<{ title: string; snippet: string; url: string; provider: string }> {
    const blocks = html.match(/<li class="b_algo"[\s\S]*?<\/li>/gi) || [];
    const results: Array<{ title: string; snippet: string; url: string; provider: string }> = [];
    for (const block of blocks) {
      const linkMatch = block.match(/<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
      if (!linkMatch) continue;
      const snippetMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
      const url = this.decodeHtml(linkMatch[1]);
      if (!/^https?:\/\//i.test(url)) continue;
      results.push({
        title: this.cleanHtml(linkMatch[2]),
        snippet: snippetMatch ? this.cleanHtml(snippetMatch[1]) : '',
        url,
        provider: 'bing',
      });
      if (results.length >= maxResults) break;
    }
    return results;
  }

  private cleanHtml(value: string): string {
    return this.decodeHtml(value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
  }

  private decodeHtml(value: string): string {
    return value
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  /**
   * 数据分析（基于 pandas 的通用分析）
   */
  async analyzeData(dataJson: string, analysisType: string): Promise<ExecutionResult> {
    const code = `
import json, sys
try:
    import pandas as pd
    import numpy as np

    data = json.loads(\"\"\"${this.escapePythonString(dataJson)}\"\"\")

    if isinstance(data, list) and all(isinstance(r, dict) for r in data):
        df = pd.DataFrame(data)
    elif isinstance(data, dict):
        df = pd.DataFrame([data])
    else:
        print(json.dumps({\"error\": \"无法识别数据格式\"}))
        sys.exit(0)

    result = {\"columns\": list(df.columns), \"rows\": len(df)}

    if \"${analysisType}\" == \"summary\":
        result[\"describe\"] = json.loads(df.describe(include='all').to_json(force_ascii=False))
        result[\"dtypes\"] = {str(k): str(v) for k, v in df.dtypes.items()}
        result[\"missing\"] = json.loads(df.isnull().sum().to_json())
    elif \"${analysisType}\" == \"correlation\":
        numeric_df = df.select_dtypes(include=[np.number])
        if len(numeric_df.columns) > 1:
            result[\"correlation\"] = json.loads(numeric_df.corr().to_json(force_ascii=False))
        else:
            result[\"error\"] = \"需要至少2列数值列进行相关性分析\"
    elif \"${analysisType}\" == \"distribution\":
        for col in df.select_dtypes(include=[np.number]).columns:
            result[col] = {
                \"min\": float(df[col].min()),
                \"max\": float(df[col].max()),
                \"mean\": float(df[col].mean()),
                \"median\": float(df[col].median()),
                \"std\": float(df[col].std())
            }
    elif \"${analysisType}\" == \"value_counts\":
        for col in df.select_dtypes(include=[\"object\"]).columns:
            counts = df[col].value_counts().head(10).to_dict()
            result[f\"{col}_top10\"] = {str(k): int(v) for k, v in counts.items()}
    else:
        result[\"info\"] = f\"分析方法 '${analysisType}' 可用类型: summary, correlation, distribution, value_counts\"

    print(json.dumps(result, ensure_ascii=False, default=str))
except ImportError:
    print(json.dumps({\"error\": \"需要安装 pandas: pip install pandas numpy\"}))
except Exception as e:
    print(json.dumps({\"error\": str(e)}))
`;
    return this.executePython(code, 30_000);
  }

  /**
   * 生成图表（基于 matplotlib）
   */
  async generateChart(
    dataJson: string,
    chartType: string,
    xField?: string,
    yField?: string,
    title?: string,
  ): Promise<ExecutionResult> {
    const code = `
import json, sys, base64, io
try:
    import pandas as pd
    import numpy as np
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt

    plt.rcParams['font.sans-serif'] = ['DejaVu Sans', 'SimHei', 'Arial']
    plt.rcParams['axes.unicode_minus'] = False

    data = json.loads(\"\"\"${this.escapePythonString(dataJson)}\"\"\")
    if isinstance(data, list) and all(isinstance(r, dict) for r in data):
        df = pd.DataFrame(data)
    else:
        print(json.dumps({\"error\": \"数据格式错误\"}))
        sys.exit(0)

    fig, ax = plt.subplots(figsize=(10, 6))
    x = df[\"${this.escapePythonString(xField || '')}\"] if \"${xField || ''}\" else df.index
    y = df[\"${this.escapePythonString(yField || '')}\"] if \"${yField || ''}\" else df.iloc[:, 0]

    if \"${chartType}\" == \"bar\":
        ax.bar(range(len(y)), y.values if hasattr(y, 'values') else y)
        if hasattr(x, 'values'):
            ax.set_xticks(range(len(x)))
            ax.set_xticklabels(x.values, rotation=45, ha='right')
    elif \"${chartType}\" == \"line\":
        ax.plot(range(len(y)), y.values if hasattr(y, 'values') else y, marker='o')
        if hasattr(x, 'values'):
            ax.set_xticks(range(len(x)))
            ax.set_xticklabels(x.values, rotation=45, ha='right')
    elif \"${chartType}\" == \"pie\":
        ax.pie(y.values if hasattr(y, 'values') else y, labels=x.values if hasattr(x, 'values') else x, autopct='%1.1f%%')
        ax.set_ylabel('')
    elif \"${chartType}\" == \"scatter\":
        ax.scatter(x.values if hasattr(x, 'values') else x, y.values if hasattr(y, 'values') else y)
    elif \"${chartType}\" == \"histogram\":
        ax.hist(y.values if hasattr(y, 'values') else y, bins=20, edgecolor='black')

    ax.set_title(\"${this.escapePythonString(title || '')}\")
    ax.grid(True, alpha=0.3)
    fig.tight_layout()

    buf = io.BytesIO()
    fig.savefig(buf, format='png', dpi=120)
    buf.seek(0)
    img_b64 = base64.b64encode(buf.read()).decode('utf-8')
    plt.close(fig)

    print(json.dumps({\"image\": f\"data:image/png;base64,{img_b64}\", \"format\": \"png\"}))
except ImportError:
    print(json.dumps({\"error\": \"需要安装 matplotlib pandas numpy\"}))
except Exception as e:
    print(json.dumps({\"error\": str(e)}))
`;
    return this.executePython(code, 30_000);
  }

  /**
   * Python 字符串转义（用于嵌入到 Python 代码字符串中）
   */
  private escapePythonString(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }

  /**
   * 安全检查
   */
  private sanitizePythonCode(code: string): void {
    const dangerousPatterns = [
      /os\.system/i,
      /subprocess/i,
      /shutil\.rmtree/i,
      /pathlib.*\.unlink/i,
      /__import__\s*\(\s*['"]os['"]/i,
      /eval\s*\(/i,
      /exec\s*\(/i,
    ];
    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        throw new Error(`安全限制：禁止使用危险操作 (匹配: ${pattern})`);
      }
    }
  }
}
