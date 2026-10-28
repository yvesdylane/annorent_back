import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../db/databaseService.js';
import { LocalStorageService } from '../storage/localStorageService.js';
import { ApplyKycDto } from './dto/applyKycDto.js';

@Injectable()
export class KycService {
  constructor(private readonly db: DatabaseService, private readonly storage: LocalStorageService) {}

  async apply(userId: string, dto: ApplyKycDto) {
    const existing = await this.db.query(
      `SELECT id, status FROM public.kyc_submissions WHERE user_id = $1 AND status IN ('pending','under_review')`,
      [userId],
    );
    if (existing.rows[0]) {
      throw new BadRequestException('You already have an active KYC submission');
    }

    const verified = await this.db.query(
      `SELECT kyc_status, role FROM public.users WHERE user_id = $1`,
      [userId],
    );
    if (verified.rows[0]?.kyc_status === 'verified') {
      throw new BadRequestException('You are already verified');
    }

    const result = await this.db.query(
      `INSERT INTO public.kyc_submissions (user_id, applicant_type, status, document_type, document_number, full_legal_name, date_of_birth, phone_number, taxpayer_id_number)
       VALUES ($1, 'individual', 'pending', $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [userId, dto.documentType, dto.documentNumber, dto.fullLegalName, dto.dateOfBirth, dto.phoneNumber || null, dto.taxpayerIdNumber],
    );

    await this.db.query(`UPDATE public.users SET kyc_status = 'pending' WHERE user_id = $1`, [userId]);

    return result.rows[0];
  }

  async getStatus(userId: string) {
    const result = await this.db.query(
      `SELECT * FROM public.kyc_submissions WHERE user_id = $1 ORDER BY submitted_at DESC LIMIT 1`,
      [userId],
    );
    if (!result.rows[0]) {
      return { status: 'not_submitted' };
    }
    const submission = result.rows[0];
    const docs = await this.db.query(
      `SELECT id, type, storage_path, mime_type, size_bytes, uploaded_at FROM public.kyc_documents WHERE submission_id = $1`,
      [submission.id],
    );
    return { submission, documents: docs.rows };
  }

  async uploadDocument(userId: string, submissionId: string, type: string, file: Express.Multer.File) {
    const sub = await this.db.query(
      `SELECT id, user_id, status FROM public.kyc_submissions WHERE id = $1`,
      [submissionId],
    );
    if (!sub.rows[0]) throw new NotFoundException('Submission not found');
    if (sub.rows[0].user_id !== userId) throw new ForbiddenException();
    if (!['pending', 'rejected'].includes(sub.rows[0].status)) {
      throw new BadRequestException('Cannot upload documents for this submission');
    }

    const allowedTypes = ['id_front', 'id_back', 'selfie_with_id', 'taxpayer_id_proof'];
    if (!allowedTypes.includes(type)) throw new BadRequestException('Invalid document type');

    const uploaded = await this.storage.uploadFile({
      file,
      subdir: `kyc/${userId}/${submissionId}`,
      maxSizeBytes: 1500000,
    });

    const result = await this.db.query(
      `INSERT INTO public.kyc_documents (submission_id, type, storage_path, mime_type, size_bytes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [submissionId, type, uploaded.relativePath, file.mimetype, file.size],
    );

    return result.rows[0];
  }

  async submit(userId: string, submissionId: string) {
    const sub = await this.db.query(
      `SELECT id, user_id, status FROM public.kyc_submissions WHERE id = $1`,
      [submissionId],
    );
    if (!sub.rows[0]) throw new NotFoundException('Submission not found');
    if (sub.rows[0].user_id !== userId) throw new ForbiddenException();
    if (!['pending', 'rejected'].includes(sub.rows[0].status)) {
      throw new BadRequestException('Cannot submit this application');
    }

    const docs = await this.db.query(
      `SELECT type FROM public.kyc_documents WHERE submission_id = $1`,
      [submissionId],
    );
    const types = docs.rows.map((r: any) => r.type);
    const required = ['id_front', 'id_back', 'selfie_with_id', 'taxpayer_id_proof'];
    for (const r of required) {
      if (!types.includes(r)) throw new BadRequestException(`Missing required document: ${r}`);
    }

    await this.db.query(
      `UPDATE public.kyc_submissions SET status = 'under_review', submitted_at = COALESCE(submitted_at, now()), updated_at = now() WHERE id = $1`,
      [submissionId],
    );

    return { message: 'KYC submitted for review' };
  }

  async listSubmissions(status?: string) {
    let query = `SELECT s.*, u.email, u.name FROM public.kyc_submissions s JOIN public.users u ON u.user_id = s.user_id`;
    const params: any[] = [];
    if (status) {
      query += ` WHERE s.status = $1`;
      params.push(status);
    }
    query += ` ORDER BY s.submitted_at DESC`;
    const result = await this.db.query(query, params);
    return result.rows;
  }

  async getSubmission(submissionId: string) {
    const result = await this.db.query(
      `SELECT s.*, u.email, u.name FROM public.kyc_submissions s JOIN public.users u ON u.user_id = s.user_id WHERE s.id = $1`,
      [submissionId],
    );
    if (!result.rows[0]) throw new NotFoundException('Submission not found');
    const docs = await this.db.query(
      `SELECT * FROM public.kyc_documents WHERE submission_id = $1`,
      [submissionId],
    );
    return { submission: result.rows[0], documents: docs.rows };
  }

  async approve(submissionId: string, reviewerId: string) {
    const sub = await this.db.query(`SELECT user_id FROM public.kyc_submissions WHERE id = $1`, [submissionId]);
    if (!sub.rows[0]) throw new NotFoundException('Submission not found');
    const userId = sub.rows[0].user_id;

    await this.db.query(
      `UPDATE public.kyc_submissions SET status = 'verified', reviewed_by = $2, reviewed_at = now(), updated_at = now() WHERE id = $1`,
      [submissionId, reviewerId],
    );
    await this.db.query(
      `UPDATE public.users SET kyc_status = 'verified', role = 'owner', updated_at = now() WHERE user_id = $1`,
      [userId],
    );

    return { message: 'KYC approved' };
  }

  async reject(submissionId: string, reviewerId: string, rejectionReason: string) {
    const sub = await this.db.query(`SELECT user_id FROM public.kyc_submissions WHERE id = $1`, [submissionId]);
    if (!sub.rows[0]) throw new NotFoundException('Submission not found');

    await this.db.query(
      `UPDATE public.kyc_submissions SET status = 'rejected', rejection_reason = $2, reviewed_by = $3, reviewed_at = now(), updated_at = now() WHERE id = $1`,
      [submissionId, rejectionReason, reviewerId],
    );
    await this.db.query(
      `UPDATE public.users SET kyc_status = 'rejected', updated_at = now() WHERE user_id = $1`,
      [sub.rows[0].user_id],
    );

    return { message: 'KYC rejected' };
  }

  getStorageService() {
    return this.storage;
  }
}
