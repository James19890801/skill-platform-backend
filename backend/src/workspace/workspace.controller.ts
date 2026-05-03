import { Controller, Get, Post, Delete, Param, Query, Res, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';
import { WorkspaceService } from './workspace.service';

/**
 * Workspace API — 为每个 conversation thread 提供文件工作区
 *
 * 端点：
 *   GET    /api/workspace/:threadId/tree              — 获取文件树
 *   GET    /api/workspace/:threadId/files              — 列出所有文件（平铺）
 *   GET    /api/workspace/:threadId/files?download=xxx — 下载指定文件
 *   POST   /api/workspace/:threadId/files?name=xxx     — 上传/写入文件
 *   DELETE /api/workspace/:threadId/files?delete=xxx   — 删除指定文件
 */
@Controller('api/workspace')
export class WorkspaceController {
  private readonly logger = new Logger(WorkspaceController.name);

  constructor(private readonly workspaceService: WorkspaceService) {}

  @Get(':threadId/tree')
  async getTree(@Param('threadId') threadId: string) {
    const tree = this.workspaceService.getFileTree(threadId);
    return { success: true, data: { threadId, tree } };
  }

  @Get(':threadId/files')
  async handleFiles(
    @Param('threadId') threadId: string,
    @Query('download') downloadPath: string,
    @Res() res: Response,
  ) {
    // 下载模式：?download=relative/path/to/file.docx
    if (downloadPath) {
      const file = this.workspaceService.readFile(threadId, downloadPath);
      if (!file) {
        throw new HttpException(
          { success: false, message: '文件不存在' },
          HttpStatus.NOT_FOUND,
        );
      }

      const previewTypes = ['text/html', 'text/plain', 'text/markdown', 'text/csv',
        'application/json', 'image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/webp'];
      const isPreview = previewTypes.includes(file.mimeType);

      res.setHeader('Content-Type', file.mimeType);
      if (!isPreview) {
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(downloadPath)}"`);
      }
      res.send(file.content);
      return; // 手动发送响应后不返回值，避免拦截器包装
    }

    // 列表模式（默认）
    const files = this.workspaceService.listFiles(threadId);
    return res.json({ success: true, data: { threadId, files, total: files.length } });
  }

  @Post(':threadId/files')
  async writeFile(
    @Param('threadId') threadId: string,
    @Query('name') fileName: string,
    @Query('type') mimeType: string,
    @Res() res: Response,
  ) {
    if (!fileName) {
      throw new HttpException(
        { success: false, message: '缺少文件名参数 ?name=xxx' },
        HttpStatus.BAD_REQUEST,
      );
    }

    // 读取请求体
    const chunks: Buffer[] = [];
    res.req.on('data', (chunk: Buffer) => chunks.push(chunk));
    await new Promise<void>((resolve) => res.req.on('end', resolve));

    const content = Buffer.concat(chunks);
    const file = await this.workspaceService.writeFile(
      threadId,
      fileName,
      content,
      mimeType,
    );

    return res.json({ success: true, data: file });
  }

  @Delete(':threadId/files')
  async deleteFile(
    @Param('threadId') threadId: string,
    @Query('delete') fileName: string,
  ) {
    if (!fileName) {
      throw new HttpException(
        { success: false, message: '缺少文件名参数 ?delete=xxx' },
        HttpStatus.BAD_REQUEST,
      );
    }
    const deleted = this.workspaceService.deleteFile(threadId, fileName);
    if (!deleted) {
      throw new HttpException(
        { success: false, message: '文件不存在或删除失败' },
        HttpStatus.NOT_FOUND,
      );
    }
    return { success: true, message: `已删除: ${fileName}` };
  }
}

