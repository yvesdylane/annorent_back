import { Body, Controller, Get, Param, Post, Query, Req, Res, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard.js';
import { AdminGuard } from '../auth/guards/adminGuard.js';
import { KycService } from './kycService.js';
import { RejectKycDto } from './dto/rejectKycDto.js';
import * as fs from 'fs';
import type { Response } from 'express';

@Controller('owner/kyc')
@UseGuards(JwtAuthGuard)
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Post('apply')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'id_front', maxCount: 1 },
      { name: 'idBack', maxCount: 1 },
      { name: 'id_back', maxCount: 1 },
      { name: 'selfie_with_id', maxCount: 1 },
      { name: 'selfieWithId', maxCount: 1 },
      { name: 'taxpayer_id_proof', maxCount: 1 },
      { name: 'taxpayerIdProof', maxCount: 1 },
      { name: 'rccm', maxCount: 1 },
      { name: 'niu', maxCount: 1 },
      { name: 'legal_rep_id_front', maxCount: 1 },
      { name: 'legalRepIdFront', maxCount: 1 },
      { name: 'legal_rep_id_back', maxCount: 1 },
      { name: 'legalRepIdBack', maxCount: 1 },
      { name: 'legal_rep_selfie_with_id', maxCount: 1 },
      { name: 'legalRepSelfieWithId', maxCount: 1 },
    ]),
  )
  apply(@Req() req: any, @Body() body: any, @UploadedFiles() files: any) {
    const userId = req.user?.userId || req.user?.sub;
    return this.kycService.applyAll(userId, body, files || {});
  }

  @Get('status')
  getStatus(@Req() req: any) {
    const userId = req.user?.userId || req.user?.sub;
    return this.kycService.getStatus(userId);
  }

  @Get('documents/:documentId/download')
  async download(@Req() req: any, @Param('documentId') documentId: string, @Res() res: Response) {
    const userId = req.user?.userId || req.user?.sub;
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
