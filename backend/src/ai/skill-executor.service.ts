import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import OpenAI from 'openai';
import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { Skill } from '../entities/skill.entity';
import { SkillExecution } from '../entities/skill-execution.entity';
import { ToolBridgeService } from './tool-bridge.service';
import { WorkspaceService } from '../workspace/workspace.service';
import { SkillLoaderService } from '../skill-runtime/skill-loader.service';
import { SkillRuntimeTraceService } from '../skill-runtime/skill-runtime-trace.service';
import {
  SkillPackage,
  SkillPackageFile,
  buildSkillWorkspaceId,
} from '../skill-runtime/skill-package';

const execFileAsync = promisify(execFile);

/**
 * 执行日志条目
 */
export interface ExecutionLogEntry {
  round: number;
  action: string;       // 'think' | 'tool_call' | 'tool_result' | 'generate'
  toolName?: string;
  status: 'pending' | 'success' | 'error';
  durationMs?: number;
  message: string;
}

/**
 * Skill 执行结果
 */
export interface SkillExecutionResult {
  executionId: number;
  status: string;
  output: string;
  workspaceId: string;
  artifacts: Array<{ name: string; path: string; type: string; size: number }>;
  totalRounds: number;
  totalDurationMs: number;
  logs: ExecutionLogEntry[];
}

/**
 * 进度回调函数
 * 当执行引擎有新的进度时被调用，用于实时推送到前端显示
 */
export type ProgressCallback = (progress: {
  type: 'round_start' | 'tool_call' | 'tool_result' | 'artifact' | 'round_end' | 'error' | 'done';
  data: ExecutionLogEntry;
  artifacts?: Array<{ name: string; path: string; type: string; size: number }>;
}) => void;

/**
 * SkillExecutorService — Phase 3 核心执行引擎
 *
 * 职责：
 * 1. 加载已发布 Skill 的执行配置（agentPrompt / content / toolDefinition / files）
 * 2. 创建多轮工具调用循环（Skill → AI 思考 → 调用工具 → 产出 → 下一步）
 * 3. 自动将所有产物保存到 workspace
 * 4. 记录完整的执行日志和产物清单
 */
@Injectable()
export class SkillExecutorService {
  private readonly logger = new Logger(SkillExecutorService.name);
  private client: OpenAI;
  private readonly model = 'qwen-plus';
  private readonly MAX_ROUNDS = 15;        // 最大工具调用轮数
  private readonly MAX_ARTIFACTS = 20;     // 单次执行最大产物数
  private readonly ENTRYPOINT_SCRIPT_TIMEOUT_MS = Math.max(Number(process.env.SKILL_ENTRYPOINT_SCRIPT_TIMEOUT_MS || 30000), 5000);

  constructor(
    @InjectRepository(Skill)
    private skillRepository: Repository<Skill>,
    @InjectRepository(SkillExecution)
    private executionRepository: Repository<SkillExecution>,
    private toolBridge: ToolBridgeService,
    private workspaceService: WorkspaceService,
    private skillLoader: SkillLoaderService,
    private runtimeTrace: SkillRuntimeTraceService,
  ) {
    this.client = new OpenAI({
      apiKey: process.env.QWEN_API_KEY || '',
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      timeout: 30_000,
      maxRetries: 1,
    });
  }

  /**
   * 执行一个 Skill
   *
   * @param skillId   - Skill 的 ID
   * @param userInput - 用户输入（本次执行的具体任务描述）
   * @param threadId  - 关联的对话线程 ID（用于 workspace 文件存储）
   * @returns          - 执行结果
   */
  async execute(
    skillId: number,
    userInput: string,
    threadId?: string,
    onProgress?: ProgressCallback,
    options?: { executionId?: number },
  ): Promise<SkillExecutionResult> {
    const startTime = Date.now();

    // 1. 加载 Skill
    const { skill, pkg } = await this.skillLoader.loadPublishedPackage(skillId);

    // 2. 创建执行会话
    let savedExecution = options?.executionId
      ? await this.executionRepository.findOne({ where: { id: options.executionId } })
      : null;

    if (savedExecution) {
      savedExecution.status = 'running';
      savedExecution.input = JSON.stringify({ userInput });
      savedExecution.startedAt = new Date();
      savedExecution.packageHash = pkg.packageHash;
      savedExecution.logs = savedExecution.logs || '[]';
      savedExecution.artifacts = savedExecution.artifacts || '[]';
      if (threadId) savedExecution.threadId = threadId;
    } else {
      savedExecution = this.executionRepository.create({
        skillId,
        threadId: threadId || `skill-${skillId}-${Date.now()}`,
        status: 'running',
        input: JSON.stringify({ userInput }),
        startedAt: new Date(),
        packageHash: pkg.packageHash,
        logs: '[]',
        artifacts: '[]',
      });
    }
    savedExecution = await this.executionRepository.save(savedExecution);
    const execId = savedExecution.id;
    const actualThreadId = buildSkillWorkspaceId(skillId, execId, threadId || savedExecution.threadId);
    savedExecution.workspaceId = actualThreadId;
    await this.executionRepository.update(execId, { workspaceId: actualThreadId, packageHash: pkg.packageHash });

    const logs: ExecutionLogEntry[] = [];
    const artifacts: Array<{ name: string; path: string; type: string; size: number }> = [];
    let eventSequence = await this.runtimeTrace.getLastSequence(execId);

    const emitRuntimeEvent = (eventType: string, payload: unknown, status = 'info') => {
      eventSequence += 1;
      void this.runtimeTrace.recordEvent({
        executionId: execId,
        skillId,
        sequence: eventSequence,
        eventType,
        status,
        payload,
      }).catch((err) => this.logger.warn(`运行事件写入失败: ${err instanceof Error ? err.message : String(err)}`));
    };

    const addLog = (entry: ExecutionLogEntry) => {
      logs.push(entry);
      savedExecution.logs = JSON.stringify(logs);
      this.executionRepository.update(execId, { logs: savedExecution.logs });
      emitRuntimeEvent(`skill.${entry.action}`, entry, entry.status);
    };

    let round = 0;

    try {
      emitRuntimeEvent('skill.started', {
        skillId,
        executionId: execId,
        workspaceId: actualThreadId,
        packageHash: pkg.packageHash,
        version: pkg.version,
      });

      // 3. 注入 Skill 文件到 workspace（前置准备）
      if (pkg.files.length > 0) {
        await this.injectSkillFiles(pkg, actualThreadId, addLog);
      }

      const entrypointOutput = await this.tryRunEntrypointScript(pkg, actualThreadId, userInput, artifacts, addLog, savedExecution, execId, skillId);
      if (entrypointOutput) {
        const entrypointRounds = 1;
        savedExecution.status = 'completed';
        savedExecution.output = entrypointOutput;
        savedExecution.artifacts = JSON.stringify(artifacts);
        savedExecution.logs = JSON.stringify(logs);
        savedExecution.totalRounds = entrypointRounds;
        savedExecution.totalDurationMs = Date.now() - startTime;
        savedExecution.completedAt = new Date();
        await this.executionRepository.save(savedExecution);
        emitRuntimeEvent('skill.completed', {
          executionId: execId,
          status: 'completed',
          totalRounds: entrypointRounds,
          totalDurationMs: savedExecution.totalDurationMs,
          artifacts,
        }, 'success');

        const result: SkillExecutionResult = {
          executionId: execId,
          status: 'completed',
          output: entrypointOutput,
          workspaceId: actualThreadId,
          artifacts,
          totalRounds: entrypointRounds,
          totalDurationMs: savedExecution.totalDurationMs,
          logs,
        };
        if (onProgress) {
          onProgress({
            type: 'done',
            data: logs[logs.length - 1] || { round: 0, action: 'generate', status: 'success', message: '执行完成' },
            artifacts: [...artifacts],
          });
        }
        return result;
      }

      // 4. 构建系统提示
      const systemPrompt = this.buildSystemPrompt(skill, pkg);

      // 5. 解析工具定义
      const tools = await this.buildTools(pkg);

      // 6. 多轮工具调用循环
      const messages: Array<any> = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userInput },
      ];

      let finalOutput = '';
      while (round < pkg.maxRounds) {
        round++;
        const roundStart = Date.now();

        addLog({
          round,
          action: 'think',
          status: 'pending',
          message: `第 ${round} 轮：AI 思考中...`,
        });
        if (onProgress) onProgress({ type: 'round_start', data: logs[logs.length - 1] });

        // 6a. AI 响应（带工具）
        const completion = await this.client.chat.completions.create({
          model: this.model,
          messages,
          tools: tools.length > 0 ? tools : undefined,
          tool_choice: tools.length > 0 ? 'auto' : undefined,
          temperature: 0.7,
          max_tokens: 4096,
        } as any);

        const msg = completion.choices[0]?.message;
        if (!msg) {
          addLog({ round, action: 'think', status: 'error', message: 'AI 未返回有效响应' });
          break;
        }

        // 6b. 如果有工具调用 → 执行工具
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          messages.push(msg as any);

          for (const tc of msg.tool_calls) {
            const toolStart = Date.now();
            let stepId: number | undefined;
            try {
              const args = JSON.parse(tc.function.arguments);
              const step = await this.runtimeTrace.startStep({
                executionId: execId,
                skillId,
                stepKey: `${round}:${tc.id}`,
                type: 'tool',
                toolName: tc.function.name,
                input: args,
              });
              stepId = step.id;
              addLog({
                round,
                action: 'tool_call',
                toolName: tc.function.name,
                status: 'pending',
                message: `调用工具: ${tc.function.name}(${JSON.stringify(args).slice(0, 200)})`,
              });
              if (onProgress) onProgress({ type: 'tool_call', data: logs[logs.length - 1] });

              const result = await this.toolBridge.executeRemote(tc.function.name, args);

              if (result.success) {
                const duration = Date.now() - toolStart;
                addLog({
                  round,
                  action: 'tool_result',
                  toolName: tc.function.name,
                  status: 'success',
                  durationMs: duration,
                  message: `工具 ${tc.function.name} 执行成功 (${duration}ms)`,
                });
                await this.runtimeTrace.completeStep(stepId, 'completed', result.result, undefined, duration);
                if (onProgress) onProgress({ type: 'tool_result', data: logs[logs.length - 1], artifacts: [...artifacts] });

                // 捕获产物：检查结果中是否有 workspace 文件
                if (result.result?.workspaceFile) {
                  await this.recordArtifact(artifacts, result.result.workspaceFile, savedExecution, execId, skillId);
                }
                if (result.result?.files && Array.isArray(result.result.files)) {
                  for (const f of result.result.files) {
                    await this.recordArtifact(artifacts, f, savedExecution, execId, skillId);
                  }
                }

                messages.push({
                  role: 'tool',
                  tool_call_id: tc.id,
                  content: JSON.stringify(result.result || { success: true }),
                } as any);
              } else {
                const duration = Date.now() - toolStart;
                addLog({
                  round,
                  action: 'tool_result',
                  toolName: tc.function.name,
                  status: 'error',
                  durationMs: duration,
                  message: `工具 ${tc.function.name} 执行失败: ${result.error || '未知错误'}`,
                });
                await this.runtimeTrace.completeStep(stepId, 'failed', result, result.error || '工具执行失败', duration);
                if (onProgress) onProgress({ type: 'tool_result', data: logs[logs.length - 1], artifacts: [...artifacts] });
                messages.push({
                  role: 'tool',
                  tool_call_id: tc.id,
                  content: JSON.stringify({ error: result.error || '工具执行失败' }),
                } as any);
              }
            } catch (err: any) {
              addLog({
                round,
                action: 'tool_result',
                toolName: tc.function.name,
                status: 'error',
                message: `工具异常: ${err.message || String(err)}`,
              });
              await this.runtimeTrace.completeStep(stepId, 'failed', undefined, err.message || String(err), Date.now() - toolStart);
              if (onProgress) onProgress({ type: 'error', data: logs[logs.length - 1], artifacts: [...artifacts] });
              messages.push({
                role: 'tool',
                tool_call_id: tc.id,
                content: JSON.stringify({ error: `工具执行异常: ${err.message}` }),
              } as any);
            }
          }

          // 6c. 本轮工具全部执行完毕，继续下一轮
          continue;
        }

        // 6d. 没有工具调用 → AI 输出最终结果
        finalOutput = msg.content || '';
        const roundDuration = Date.now() - roundStart;
        addLog({
          round,
          action: 'generate',
          status: 'success',
          durationMs: roundDuration,
          message: `AI 生成最终回复 (${roundDuration}ms)`,
        });
        if (onProgress) onProgress({ type: 'round_end', data: logs[logs.length - 1], artifacts: [...artifacts] });

        // 尝试从 AI 回复中提取产物信息（HTML 报告等）
        // 如果 AI 回复中包含 generate_html_report 或 generate_document 的显式结果，
        // 这些已经在工具执行阶段被捕获到 artifacts 中了。

        break;
      }

      // 7. 如果达到最大轮数仍未结束，强制终止
      if (round >= pkg.maxRounds && !finalOutput) {
        finalOutput = `执行已达到最大 ${pkg.maxRounds} 轮限制，强制终止。`;
        addLog({
          round,
          action: 'think',
          status: 'error',
          message: `超过最大轮数 ${pkg.maxRounds}，执行终止`,
        });
      }

      // 8. 保存最终产物到 workspace（如果 AI 回复中有 HTML 等内容）
      if (finalOutput) {
        await this.saveFinalArtifacts(finalOutput, actualThreadId, artifacts, addLog, savedExecution, execId, skillId);
      }

      // 9. 更新执行会话为完成状态
      savedExecution.status = 'completed';
      savedExecution.output = finalOutput;
      savedExecution.artifacts = JSON.stringify(artifacts);
      savedExecution.logs = JSON.stringify(logs);
      savedExecution.totalRounds = round;
      savedExecution.totalDurationMs = Date.now() - startTime;
      savedExecution.completedAt = new Date();
      await this.executionRepository.save(savedExecution);
      emitRuntimeEvent('skill.completed', {
        executionId: execId,
        status: 'completed',
        totalRounds: round,
        totalDurationMs: savedExecution.totalDurationMs,
        artifacts,
      }, 'success');

      const result: SkillExecutionResult = {
        executionId: execId,
        status: 'completed',
        output: finalOutput,
        workspaceId: actualThreadId,
        artifacts,
        totalRounds: round,
        totalDurationMs: Date.now() - startTime,
        logs,
      };
      if (onProgress) onProgress({ type: 'done', data: logs[logs.length - 1] || { round: 0, action: 'generate', status: 'success', message: '执行完成' }, artifacts: [...artifacts] });

      return result;
    } catch (err: any) {
      // 异常处理：标记执行失败
      savedExecution.status = 'failed';
      savedExecution.output = `执行异常: ${err.message}`;
      savedExecution.totalDurationMs = Date.now() - startTime;
      savedExecution.completedAt = new Date();
      await this.executionRepository.save(savedExecution);
      emitRuntimeEvent('skill.failed', {
        executionId: execId,
        status: 'failed',
        error: err.message,
        totalRounds: round,
      }, 'error');

      addLog({
        round: 0,
        action: 'think',
        status: 'error',
        message: `执行异常: ${err.message}`,
      });
      if (onProgress) onProgress({ type: 'error', data: logs[logs.length - 1], artifacts: [...artifacts] });

      return {
        executionId: execId,
        status: 'failed',
        output: `Skill 执行失败: ${err.message}`,
        workspaceId: actualThreadId,
        artifacts,
        totalRounds: round,
        totalDurationMs: Date.now() - startTime,
        logs,
      };
    }
  }

  // ============================================
  // 查询方法
  // ============================================

  /**
   * 获取指定 Skill 的历史执行记录
   */
  async getHistory(skillId: number): Promise<SkillExecution[]> {
    return this.executionRepository.find({
      where: { skillId },
      order: { createdAt: 'DESC' },
      take: 20,
    });
  }

  /**
   * 获取单次执行详情
   */
  async getExecution(executionId: number): Promise<SkillExecution | null> {
    return this.executionRepository.findOne({
      where: { id: executionId },
      relations: ['skill'],
    });
  }

  // ============================================
  // 私有方法
  // ============================================

  /**
   * 构建系统提示词（Skill 的 agentPrompt + content + 执行指引）
   */
  private buildSystemPrompt(skill: Skill, pkg: SkillPackage): string {
    const parts: string[] = [];

    // 优先使用 agentPrompt（针对 agent 执行类型的最佳系统提示）
    if (pkg.agentPrompt) {
      parts.push(pkg.agentPrompt);
    } else {
      parts.push(`你是一个专业的 AI 助手，正在执行 Skill「${pkg.name}」。`);
      if (pkg.description) {
        parts.push(`\n## Skill 描述\n${pkg.description}`);
      }
    }

    // 注入 Skill content（详细步骤、原则、输入输出）
    parts.push(`\n## Skill 详情\n${pkg.instructions}`);

    // 注入 Skill 元信息
    parts.push(`\n## 元信息\n- 命名空间: ${pkg.namespace}`);
    parts.push(`- 版本: ${pkg.version}`);
    parts.push(`- 包指纹: ${pkg.packageHash}`);
    parts.push(`- 领域: ${pkg.domain}/${pkg.subDomain}`);
    parts.push(`- 能力名称: ${pkg.abilityName}`);
    if (skill.scope) parts.push(`- 范围: ${skill.scope}`);

    // 执行指引
    parts.push(`\n## 执行原则
1. 仔细阅读 Skill 定义，理解你的角色和任务
2. 按 Skill 中描述的步骤顺序执行
3. 每个步骤完成后，使用适当的工具产出交付物
4. 所有生成的文件（文档、HTML、代码等）会自动保存到工作区
5. 完成所有步骤后，给用户一个完整的总结报告
6. 在总结中包含所有产物的名称和用途`);

    return parts.join('\n\n');
  }

  /**
   * 构建工具列表（Skill 的 toolDefinition + 平台基础工具）
   */
  private async buildTools(pkg: SkillPackage): Promise<any[]> {
    const tools: any[] = [...pkg.tools];

    // 2. 平台基础工具（通过 ToolBridge 获取）
    try {
      const platformTools = await this.toolBridge.getTools();
      // 去重：避免自定义工具被平台工具覆盖
      const customNames = new Set(tools.map((t: any) => t.function?.name));
      for (const pt of platformTools) {
        if (!customNames.has(pt.function?.name)) {
          tools.push(pt);
        }
      }
    } catch (err) {
      this.logger.warn(`获取平台工具列表失败: ${err instanceof Error ? err.message : String(err)}`);
    }

    return tools;
  }

  /**
   * 将 Skill 捆绑的文件注入到 workspace
   */
  private async injectSkillFiles(
    pkg: SkillPackage,
    threadId: string,
    addLog: (entry: ExecutionLogEntry) => void,
  ): Promise<void> {
    try {
      const files = pkg.files;
      if (!Array.isArray(files) || files.length === 0) return;

      for (const file of files) {
        try {
          if (file.content && file.path) {
            const content = this.decodeSkillFile(file);
            const mimeType = file.mimeType || this.guessMimeType(file.name);
            await this.workspaceService.writeFile(threadId, file.path, content, mimeType);
            addLog({
              round: 0,
              action: 'tool_call',
              toolName: 'inject_file',
              status: 'success',
              message: `注入文件到 workspace: ${file.path} (${file.type || 'unknown'})`,
            });
          }
        } catch (fileErr) {
          this.logger.warn(`Skill文件注入失败: ${file.path}: ${fileErr instanceof Error ? fileErr.message : String(fileErr)}`);
        }
      }
    } catch {
      this.logger.warn(`SkillPackage #${pkg.id} files 注入失败，跳过文件注入`);
    }
  }

  /**
   * 执行 Skill 包声明的脚本入口。
   *
   * 入口脚本适用于“产物型 Skill”：脚本可以调用模型或其他受控逻辑生成文件，
   * 平台负责记录真实执行耗时和产物，避免聊天层口头伪造结果。
   */
  private async tryRunEntrypointScript(
    pkg: SkillPackage,
    threadId: string,
    userInput: string,
    artifacts: Array<{ name: string; path: string; type: string; size: number }>,
    addLog: (entry: ExecutionLogEntry) => void,
    execution: any,
    execId: number,
    skillId: number,
  ): Promise<string | null> {
    const entrypoint = pkg.entrypointScript?.trim();
    if (!entrypoint) return null;

    const matchingFiles = pkg.files.filter((candidate) => (
      candidate.path === entrypoint ||
      candidate.name === entrypoint ||
      candidate.path.endsWith(`/${entrypoint}`)
    ));
    const file = matchingFiles.find((candidate) => typeof candidate.content === 'string' && candidate.content.trim().length > 0) ?? matchingFiles[0];
    if (!file) {
      addLog({
        round: 0,
        action: 'tool_result',
        toolName: 'entrypoint_script',
        status: 'error',
        message: `入口脚本不存在: ${entrypoint}`,
      });
      return null;
    }

    const ext = path.extname(file.path).toLowerCase();
    if (ext !== '.js' && ext !== '.mjs' && ext !== '.cjs') {
      addLog({
        round: 0,
        action: 'tool_result',
        toolName: 'entrypoint_script',
        status: 'error',
        message: `入口脚本格式不支持: ${file.path}`,
      });
      return null;
    }

    const workspaceDir = this.workspaceService.getWorkspaceDir(threadId);
    const scriptName = `entrypoint_${Date.now()}_${path.basename(file.path).replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const scriptPath = path.join(workspaceDir, scriptName);
    const scriptContent = this.decodeSkillFile(file);
    const start = Date.now();

    try {
      await fs.writeFile(scriptPath, scriptContent);
      addLog({
        round: 0,
        action: 'tool_call',
        toolName: 'entrypoint_script',
        status: 'pending',
        message: `执行入口脚本: ${file.path}`,
      });

      const { stdout, stderr } = await execFileAsync(
        process.execPath,
        [scriptPath, workspaceDir, userInput || ''],
        {
          cwd: workspaceDir,
          timeout: this.ENTRYPOINT_SCRIPT_TIMEOUT_MS,
          maxBuffer: 1024 * 1024,
          env: { ...process.env, SKILL_USER_INPUT: userInput || '' },
        },
      );

      const duration = Date.now() - start;
      const outputPath = await this.pickEntrypointOutputPath(workspaceDir, stdout);
      if (!outputPath) {
        addLog({
          round: 0,
          action: 'tool_result',
          toolName: 'entrypoint_script',
          status: 'error',
          durationMs: duration,
          message: `入口脚本未返回可登记产物${stderr ? `: ${stderr.slice(0, 500)}` : ''}`,
        });
        return null;
      }

      const stat = await fs.stat(outputPath);
      const name = path.basename(outputPath);
      await this.recordArtifact(artifacts, {
        name,
        path: name,
        type: 'file',
        size: stat.size,
        mimeType: this.guessMimeType(name),
      }, execution, execId, skillId);

      addLog({
        round: 0,
        action: 'tool_result',
        toolName: 'entrypoint_script',
        status: 'success',
        durationMs: duration,
        message: `入口脚本执行成功，生成产物: ${name}`,
      });

      return [
        `入口脚本执行完成。`,
        `生成产物: ${name}`,
        `workspace: ${threadId}`,
        stderr ? `stderr: ${stderr.slice(0, 1000)}` : '',
      ].filter(Boolean).join('\n');
    } catch (err: any) {
      addLog({
        round: 0,
        action: 'tool_result',
        toolName: 'entrypoint_script',
        status: 'error',
        durationMs: Date.now() - start,
        message: `入口脚本执行失败: ${err?.message || String(err)}`,
      });
      return null;
    } finally {
      try {
        await fs.unlink(scriptPath);
      } catch { /* ignore */ }
    }
  }

  private async pickEntrypointOutputPath(workspaceDir: string, stdout: string): Promise<string | null> {
    const candidates = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => path.isAbsolute(line) && line.startsWith(workspaceDir));

    for (let i = candidates.length - 1; i >= 0; i -= 1) {
      const candidate = candidates[i];
      if (path.extname(candidate).toLowerCase() === '.html') {
        return candidate;
      }
    }

    try {
      const entries = await fs.readdir(workspaceDir, { withFileTypes: true });
      const htmlFiles = await Promise.all(entries
        .filter((entry) => entry.isFile() && path.extname(entry.name).toLowerCase() === '.html')
        .map(async (entry) => {
          const filePath = path.join(workspaceDir, entry.name);
          const stat = await fs.stat(filePath);
          return { filePath, mtimeMs: stat.mtimeMs };
        }));

      htmlFiles.sort((a, b) => b.mtimeMs - a.mtimeMs);
      return htmlFiles[0]?.filePath || null;
    } catch {
      return null;
    }
  }

  /**
   * 将 AI 输出的最终产物保存到 workspace
   */
  private async saveFinalArtifacts(
    output: string,
    threadId: string,
    artifacts: Array<{ name: string; path: string; type: string; size: number }>,
    addLog: (entry: ExecutionLogEntry) => void,
    execution?: any,
    execId?: number,
    skillId?: number,
  ): Promise<void> {
    // 如果 AI 的回复中包含大型 Markdown 或 HTML 内容，保存为文档
    if (output.length > 500 && !this.isHtmlInArtifacts(artifacts)) {
      // 检测是否有 HTML
      const hasHtml = output.includes('<!DOCTYPE html>') || output.includes('<html');
      if (hasHtml) {
        const filename = `skill_output_${Date.now()}.html`;
        try {
          const file = await this.workspaceService.writeFile(threadId, filename, output, 'text/html');
          await this.recordArtifact(artifacts, file, execution, execId, skillId);
          addLog({
            round: 0,
            action: 'tool_result',
            toolName: 'save_artifact',
            status: 'success',
            message: `保存 HTML 产物: ${filename}`,
          });
        } catch (err) {
          this.logger.warn(`保存 HTML 产物失败: ${err}`);
        }
      }
    }

    // 检测 AI 回复中是否包含代码块 → 另外保存为独立文件
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    let match: RegExpExecArray | null;
    let codeIdx = 1;
    while ((match = codeBlockRegex.exec(output)) !== null && artifacts.length < this.MAX_ARTIFACTS) {
      const lang = match[1] || 'txt';
      const code = match[2].trim();
      if (code.length > 200) {
        const ext = this.langToExt(lang);
        const filename = `code_${codeIdx}.${ext}`;
        try {
          const file = await this.workspaceService.writeFile(threadId, filename, code);
          await this.recordArtifact(artifacts, file, execution, execId, skillId);
          codeIdx++;
        } catch { /* ignore */ }
      }
    }
  }

  /**
   * 记录产物到列表
   */
  private async recordArtifact(
    artifacts: Array<{ name: string; path: string; type: string; size: number }>,
    file: any,
    execution: any,
    execId?: number,
    skillId?: number,
  ): Promise<void> {
    if (!file || !file.name) return;
    // 去重
    if (artifacts.some(a => a.path === file.path)) return;
    if (artifacts.length >= this.MAX_ARTIFACTS) return;

    artifacts.push({
      name: file.name,
      path: file.path,
      type: file.type || 'file',
      size: file.size || 0,
    });

    // 更新数据库中的 artifacts 字段
    if (execution && execId) {
      execution.artifacts = JSON.stringify(artifacts);
      try {
        await this.executionRepository.update(execId, { artifacts: execution.artifacts });
      } catch { /* ignore */ }
    }
    if (execId && skillId) {
      try {
        await this.runtimeTrace.recordArtifact({
          executionId: execId,
          skillId,
          name: file.name,
          path: file.path,
          type: file.type || 'file',
          size: file.size || 0,
          mimeType: file.mimeType,
        });
      } catch { /* ignore */ }
    }
  }

  private decodeSkillFile(file: SkillPackageFile): string | Buffer {
    if (!file.content) return '';
    if (file.encoding === 'base64') {
      return Buffer.from(file.content, 'base64');
    }
    return file.content;
  }

  /**
   * 检查产物列表中是否已包含 HTML
   */
  private isHtmlInArtifacts(artifacts: Array<{ name: string; path: string; type: string; size: number }>): boolean {
    return artifacts.some(a => a.name.endsWith('.html') || a.name.endsWith('.htm'));
  }

  /**
   * 根据语言标识推断文件扩展名
   */
  private langToExt(lang: string): string {
    const map: Record<string, string> = {
      python: 'py', py: 'py',
      javascript: 'js', js: 'js', ts: 'ts', typescript: 'ts',
      html: 'html', htm: 'html',
      css: 'css', scss: 'scss',
      json: 'json', yaml: 'yaml', yml: 'yml', xml: 'xml',
      markdown: 'md', md: 'md',
      sql: 'sql', bash: 'sh', sh: 'sh', shell: 'sh',
      text: 'txt', txt: 'txt',
      csv: 'csv',
    };
    return map[lang.toLowerCase()] || 'txt';
  }

  /**
   * 根据文件名猜测 MIME 类型
   */
  private guessMimeType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const mimeMap: Record<string, string> = {
      py: 'text/x-python',
      js: 'application/javascript',
      ts: 'text/typescript',
      html: 'text/html',
      htm: 'text/html',
      css: 'text/css',
      json: 'application/json',
      md: 'text/markdown',
      txt: 'text/plain',
      csv: 'text/csv',
      yaml: 'text/yaml',
      yml: 'text/yaml',
      xml: 'application/xml',
      sh: 'application/x-sh',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      pdf: 'application/pdf',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
    };
    return mimeMap[ext] || 'text/plain';
  }
}
