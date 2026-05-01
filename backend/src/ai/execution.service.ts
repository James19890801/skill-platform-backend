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

@Injectable()
export class ExecutionService {
  private readonly logger = new Logger(ExecutionService.name);
  private readonly PYTHON_PATH = 'python3';
  private readonly MAX_OUTPUT_LENGTH = 50_000;
  private readonly DEFAULT_TIMEOUT_MS = 30_000;

  async executePython(code: string, timeoutMs?: number): Promise<ExecutionResult> {
    const startTime = Date.now();
    const tmpDir = await mkdtemp(join(tmpdir(), 'pyexec-'));
    const filePath = join(tmpDir, 'script.py');

    try {
      this.sanitizePythonCode(code);
      await writeFile(filePath, code, 'utf-8');
      const timeout = timeoutMs || this.DEFAULT_TIMEOUT_MS;

      const { stdout, stderr } = await execFileAsync(
        this.PYTHON_PATH, [filePath],
        { timeout, maxBuffer: this.MAX_OUTPUT_LENGTH, env: { ...process.env, PYTHONUNBUFFERED: '1' } },
      );

      const duration = Date.now() - startTime;
      let output = '';
      if (stdout) output += stdout;
      if (stderr) output += `\n[STDERR]\n${stderr}`;
      output = output.slice(0, this.MAX_OUTPUT_LENGTH);

      return { success: true, output: output.trim() || '代码执行完成（无输出）', durationMs: duration };
    } catch (err: any) {
      const duration = Date.now() - startTime;
      if (err?.stderr) {
        return { success: false, output: '', error: err.stderr.slice(0, 5000), durationMs: duration };
      }
      if (err?.code === 'ETIMEDOUT') {
        return { success: false, output: '', error: `执行超时（${(timeoutMs || this.DEFAULT_TIMEOUT_MS) / 1000}秒）`, durationMs: duration };
      }
      return { success: false, output: '', error: `执行错误: ${err?.message || String(err)}`, durationMs: duration };
    } finally {
      try { await unlink(filePath); } catch { /* ignore */ }
      try { const { rmdir } = await import('fs/promises'); await rmdir(tmpDir); } catch { /* ignore */ }
    }
  }

  async searchWeb(query: string, maxResults: number = 5): Promise<ExecutionResult> {
    const code = `
import sys, json
try:
    from duckduckgo_search import DDGS
    results = []
    with DDGS() as ddgs:
        for i, r in enumerate(ddgs.text(${JSON.stringify(query)}, max_results=${maxResults})):
            results.append({
                "title": r.get("title", ""),
                "snippet": r.get("body", ""),
                "url": r.get("href", "")
            })
    print(json.dumps(results, ensure_ascii=False))
except ImportError:
    print(json.dumps({"error": "duckduckgo-search \u672a\u5b89\u88c5"}))
except Exception as e:
    print(json.dumps({"error": str(e)}))
`;
    return this.executePython(code, 15_000);
  }

  async analyzeData(dataJson: string, analysisType: string): Promise<ExecutionResult> {
    const code = `
import json, sys
try:
    import pandas as pd
    import numpy as np
    data = json.loads(${JSON.stringify(dataJson)})
    if isinstance(data, list) and all(isinstance(r, dict) for r in data):
        df = pd.DataFrame(data)
    elif isinstance(data, dict):
        df = pd.DataFrame([data])
    else:
        print(json.dumps({"error": "\u65e0\u6cd5\u8bc6\u522b\u6570\u636e\u683c\u5f0f"}))
        sys.exit(0)
    result = {"columns": list(df.columns), "rows": len(df)}
    if ${JSON.stringify(analysisType)} == "summary":
        result["describe"] = json.loads(df.describe(include='all').to_json(force_ascii=False))
        result["dtypes"] = {str(k): str(v) for k, v in df.dtypes.items()}
        result["missing"] = json.loads(df.isnull().sum().to_json())
    elif ${JSON.stringify(analysisType)} == "correlation":
        numeric_df = df.select_dtypes(include=[np.number])
        if len(numeric_df.columns) > 1:
            result["correlation"] = json.loads(numeric_df.corr().to_json(force_ascii=False))
        else:
            result["error"] = "\u9700\u8981\u81f3\u5c112\u5217\u6570\u503c\u5217\u8fdb\u884c\u76f8\u5173\u6027\u5206\u6790"
    elif ${JSON.stringify(analysisType)} == "distribution":
        for col in df.select_dtypes(include=[np.number]).columns:
            result[col] = {"min": float(df[col].min()), "max": float(df[col].max()), "mean": float(df[col].mean()), "median": float(df[col].median()), "std": float(df[col].std())}
    elif ${JSON.stringify(analysisType)} == "value_counts":
        for col in df.select_dtypes(include=["object"]).columns:
            counts = df[col].value_counts().head(10).to_dict()
            result[col + "_top10"] = {str(k): int(v) for k, v in counts.items()}
    else:
        result["info"] = f"\u5206\u6790\u65b9\u6cd5 {JSON.stringify(analysisType)} \u53ef\u7528\u7c7b\u578b: summary, correlation, distribution, value_counts"
    print(json.dumps(result, ensure_ascii=False, default=str))
except ImportError:
    print(json.dumps({"error": "\u9700\u8981\u5b89\u88c5 pandas: pip install pandas numpy"}))
except Exception as e:
    print(json.dumps({"error": str(e)}))
`;
    return this.executePython(code, 30_000);
  }

  async generateChart(dataJson: string, chartType: string, xField?: string, yField?: string, title?: string): Promise<ExecutionResult> {
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
    data = json.loads(${JSON.stringify(dataJson)})
    if isinstance(data, list) and all(isinstance(r, dict) for r in data):
        df = pd.DataFrame(data)
    else:
        print(json.dumps({"error": "\u6570\u636e\u683c\u5f0f\u9519\u8bef"}))
        sys.exit(0)
    fig, ax = plt.subplots(figsize=(10, 6))
    x = df[${JSON.stringify(xField || '')}] if ${JSON.stringify(xField || '')} else df.index
    y = df[${JSON.stringify(yField || '')}] if ${JSON.stringify(yField || '')} else df.iloc[:, 0]
    if ${JSON.stringify(chartType)} == "bar":
        ax.bar(range(len(y)), y.values if hasattr(y, 'values') else y)
        if hasattr(x, 'values'):
            ax.set_xticks(range(len(x)))
            ax.set_xticklabels(x.values, rotation=45, ha='right')
    elif ${JSON.stringify(chartType)} == "line":
        ax.plot(range(len(y)), y.values if hasattr(y, 'values') else y, marker='o')
        if hasattr(x, 'values'):
            ax.set_xticks(range(len(x)))
            ax.set_xticklabels(x.values, rotation=45, ha='right')
    elif ${JSON.stringify(chartType)} == "pie":
        ax.pie(y.values if hasattr(y, 'values') else y, labels=x.values if hasattr(x, 'values') else x, autopct='%1.1f%%')
        ax.set_ylabel('')
    elif ${JSON.stringify(chartType)} == "scatter":
        ax.scatter(x.values if hasattr(x, 'values') else x, y.values if hasattr(y, 'values') else y)
    elif ${JSON.stringify(chartType)} == "histogram":
        ax.hist(y.values if hasattr(y, 'values') else y, bins=20, edgecolor='black')
    ax.set_title(${JSON.stringify(title || '')})
    ax.grid(True, alpha=0.3)
    fig.tight_layout()
    buf = io.BytesIO()
    fig.savefig(buf, format='png', dpi=120)
    buf.seek(0)
    img_b64 = base64.b64encode(buf.read()).decode('utf-8')
    plt.close(fig)
    print(json.dumps({"image": img_b64, "format": "png"}))
except ImportError:
    print(json.dumps({"error": "\u9700\u8981\u5b89\u88c5 matplotlib pandas numpy"}))
except Exception as e:
    print(json.dumps({"error": str(e)}))
`;
    return this.executePython(code, 30_000);
  }

  private sanitizePythonCode(code: string): void {
    const dangerousPatterns = [
      /os\.system/i, /subprocess/i, /shutil\.rmtree/i,
      /pathlib.*\.unlink/i, /__import__\s*\(\s*['"]os['"]/i,
      /eval\s*\(/i, /exec\s*\(/i,
    ];
    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        throw new Error(`\u5b89\u5168\u9650\u5236\uff1a\u7981\u6b62\u4f7f\u7528\u5371\u9669\u64cd\u4f5c (\u5339\u914d: ${pattern})`);
      }
    }
  }
}