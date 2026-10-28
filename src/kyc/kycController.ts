import { Body, Controller, Get, Param, Post, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard.js';
import { AdminGuard } from '../auth/guards/adminGuard.js';
import { KycService } from './kycService.js';
import { ApplyKycDto } from './dto/applyKycDto.js';
import { RejectKycDto } from './dto/rejectKycDto.js';
import * as fs from 'fs';
import type { Response } from 'express';

@Controller('owner/kyc')
@UseGuards(JwtAuthGuard)
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Post('apply')
  apply(@Req() req: any, @Body() dto: ApplyKycDto) {
    const userId = req.user?.userId || req.user?.sub;
    return this.kycService.apply(userId, dto);
  }

  @Get('status')
  getStatus(@Req() req: any) {
    const userId = req.user?.userId || req.user?.sub;
    return this.kycService.getStatus(userId);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  upload(@Req() req: any, @Query('submissionId') submissionId: string, @Query('type') type: string, @UploadedFile() file: Express.Multer.File) {
    const userId = req.user?.userId || req.user?.sub;
    return this.kycService.uploadDocument(userId, submissionId, type, file);
  }

  @Post('submit')
  submit(@Req() req: any, @Body() body: any) {
    const userId = req.user?.userId || req.user?.sub;
    const submissionId = body.submissionId;
    return this.kycService.submit(userId, submissionId);
  }

  @Get('documents/:documentId/download')
  async download(@Req() req: any, @Param('documentId') documentId: string, @Res() res: Response) {
    const userId = req.user?.userId || req.user?.sub;
    // Get document
    const db = (this.kycService as any).db;
    const result = await db.query(
      `SELECT d.storage_path, d.mime_type, s.user_id FROM public.kyc_documents d JOIN public.kyc_submissions s ON s.id = d.submission_id WHERE d.id = $1`,
      [documentId],
    );
    if (!result.rows[0]) return res.status(404).send('Not found');
    if (result.rows[0].user_id !== userId) return res.status(403).send('Forbidden');
    const storage = this.kycService.getStorageService();
    const absPath = storage.getAbsolutePath(result.rows[0].storage_path);
    if (!fs.existsSync(absPath)) return res.status(404).send('File not found');
    res.setHeader('Content-Type', result.rows[0].mime_type || 'application/octet-stream');
    const stream = fs.createReadStream(absPath);
    return stream.pipe(res);
  }
}

@Controller('admin/kyc')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminKycController {
  constructor(private readonly kycService: KycService) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.kycService.listSubmissions(status);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.kycService.getSubmission(id);
  }

  @Post(':id/approve')
  approve(@Req() req: any, @Param('id') id: string) {
    const reviewerId = req.user?.userId || req.user?.sub;
    return this.kycService.approve(id, reviewerId);
  }

  @Post(':id/reject')
  reject(@Req() req: any, @Param('id') id: string, @Body() dto: RejectKycDto) {
    const reviewerId = req.user?.userId || req.user?.sub;
    return this.kycService.reject(id, reviewerId, dto.rejectionReason);
  }

  @Get('documents/:documentId/download')
  async download(@Param('documentId') documentId: string, @Res() res: Response) {
    const db = (this.kycService as any).db;
    const result = await db.query(
      `SELECT d.storage_path, d.mime_type FROM public.kyc_documents d WHERE d.id = $1`,
      [documentId],
    );
    if (!result.rows[0]) return res.status(404).send('Not found');
    const storage = this.kycService.getStorageService();
    const absPath = storage.getAbsolutePath(result.rows[0].storage_path);
    if (!fs.existsSync(absPath)) return res.status(404).send('File not found');
    res.setHeader('Content-Type', result.rows[0].mime_type || 'application/octet-stream');
    const stream = fs.createReadStream(absPath);
    return stream.pipe(res);
  }
}
