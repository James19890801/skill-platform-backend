import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface WorkspaceFile {
  name: string;
  path: string;       // 相对路径
  size: number;
  type: string;       // file | dir
  mimeType?: string;
  modifiedAt: string;
}

export interface WorkspaceTree {
  threadId: string;
  files: WorkspaceFile[];
}

/**
 * WorkspaceService
 *
 * 为每个 conversation thread 提供持久化的文件工作区。
 * 文件存储在磁盘上（/app/data/workspaces/{threadId}/），
 * 服务重启后不会丢失。
 */
@Injectable()
export class WorkspaceService {
  private readonly logger = new Logger(WorkspaceService.name);
  private readonly baseDir: string;

  constructor() {
    this.baseDir = process.env.WORKSPACE_DIR || path.resolve(process.cwd(), '..', 'data', 'workspaces');
    this.ensureDir(this.baseDir);
    this.logger.log(`Workspace 根目录: ${this.baseDir}`);
  }

  /** 获取 thread 的 workspace 目录 */
  getWorkspaceDir(threadId: string): string {
    const dir = path.join(this.baseDir, this.sanitize(threadId));
    this.ensureDir(dir);
    return dir;
  }

  /** 写入文件 */
  async writeFile(
    threadId: string,
    fileName: string,
    content: string | Buffer,
    mimeType?: string,
  ): Promise<WorkspaceFile> {
    const dir = this.getWorkspaceDir(threadId);
    const safeName = this.sanitizeFileName(fileName);
    const filePath = path.join(dir, safeName);

    // 确保父目录存在
    const parentDir = path.dirname(filePath);
    this.ensureDir(parentDir);

    if (typeof content === 'string') {
      fs.writeFileSync(filePath, content, 'utf-8');
    } else {
      fs.writeFileSync(filePath, content);
    }

    const stat = fs.statSync(filePath);
    const mime = mimeType || this.guessMimeType(safeName);

    this.logger.log(`文件已写入 workspace: ${threadId}/${safeName} (${stat.size} bytes)`);

    return {
      name: safeName,
      path: safeName,
      size: stat.size,
      type: 'file',
      mimeType: mime,
      modifiedAt: stat.mtime.toISOString(),
    };
  }

  /** 读取文件 */
  readFile(threadId: string, fileName: string): { content: Buffer; mimeType: string } | null {
    const dir = this.getWorkspaceDir(threadId);
    const filePath = path.join(dir, this.sanitizeFileName(fileName));

    // 安全检查：确保文件在 workspace 内
    if (!filePath.startsWith(dir)) {
      this.logger.warn(`路径穿越尝试: ${fileName}`);
      return null;
    }

    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return null;
    }

    const content = fs.readFileSync(filePath);
    const mimeType = this.guessMimeType(fileName);

    return { content, mimeType };
  }

  /** 列出 workspace 中的所有文件 */
  listFiles(threadId: string): WorkspaceFile[] {
    const dir = this.getWorkspaceDir(threadId);
    if (!fs.existsSync(dir)) return [];

    const result: WorkspaceFile[] = [];
    this.walkDir(dir, dir, result);
    return result.sort((a, b) => {
      // 目录在前，然后按名称排序
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  /** 获取文件树（递归结构） */
  getFileTree(threadId: string): any[] {
    const dir = this.getWorkspaceDir(threadId);
    return this.buildTree(dir, dir);
  }

  /** 删除文件 */
  deleteFile(threadId: string, fileName: string): boolean {
    const dir = this.getWorkspaceDir(threadId);
    const filePath = path.join(dir, this.sanitizeFileName(fileName));

    if (!filePath.startsWith(dir)) return false;
    if (!fs.existsSync(filePath)) return false;

    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      fs.rmSync(filePath, { recursive: true });
    } else {
      fs.unlinkSync(filePath);
    }

    this.logger.log(`文件已删除: ${threadId}/${fileName}`);
    return true;
  }

  /** 清理指定 thread 的 workspace */
  cleanWorkspace(threadId: string): void {
    const dir = this.getWorkspaceDir(threadId);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true });
      this.logger.log(`Workspace 已清理: ${threadId}`);
    }
  }

  // ============================================
  // 私有方法
  // ============================================

  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /** 递归遍历目录 */
  private walkDir(baseDir: string, currentDir: string, result: WorkspaceFile[]): void {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relPath = path.relative(baseDir, fullPath);
      const stat = fs.statSync(fullPath);

      result.push({
        name: entry.name,
        path: relPath,
        size: stat.size,
        type: entry.isDirectory() ? 'dir' : 'file',
        mimeType: entry.isFile() ? this.guessMimeType(entry.name) : undefined,
        modifiedAt: stat.mtime.toISOString(),
      });
    }
  }

  /** 构建递归文件树 */
  private buildTree(baseDir: string, currentDir: string): any[] {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    const result: any[] = [];

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relPath = path.relative(baseDir, fullPath);
      const stat = fs.statSync(fullPath);

      const node: any = {
        name: entry.name,
        path: relPath,
        type: entry.isDirectory() ? 'directory' : 'file',
        size: stat.size,
        modifiedAt: stat.mtime.toISOString(),
      };

      if (entry.isDirectory()) {
        node.children = this.buildTree(baseDir, fullPath);
      } else {
        node.mimeType = this.guessMimeType(entry.name);
      }

      result.push(node);
    }

    return result.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  /** 根据扩展名猜测 MIME 类型 */
  private guessMimeType(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.html': 'text/html',
      '.htm': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.csv': 'text/csv',
      '.xml': 'application/xml',
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.webp': 'image/webp',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.zip': 'application/zip',
      '.gz': 'application/gzip',
      '.tar': 'application/x-tar',
      '.mp3': 'audio/mpeg',
      '.mp4': 'video/mp4',
      '.py': 'text/x-python',
      '.ts': 'text/typescript',
      '.yaml': 'text/yaml',
      '.yml': 'text/yaml',
    };
    return mimeMap[ext] || 'application/octet-stream';
  }

  /** 清理文件名中的危险字符 */
  private sanitizeFileName(name: string): string {
    return name.replace(/\.\./g, '').replace(/[\/\\]/g, '_');
  }

  /** 清理 threadId */
  private sanitize(id: string): string {
    return id.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 64);
  }
}

