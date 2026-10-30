import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../db/databaseService.js';
import { LocalStorageService } from '../storage/localStorageService.js';
import * as sharp from 'sharp';

@Injectable()
export class KycService {
  constructor(private readonly db: DatabaseService, private readonly storage: LocalStorageService) {}

  private getFile(files: any, keys: string[]): Express.Multer.File | undefined {
    for (const key of keys) {
      if (files[key] && files[key][0]) return files[key][0];
    }
    return undefined;
  }

  private async validateAndPrepareFile(file: Express.Multer.File): Promise<Express.Multer.File> {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Only PDF and images (JPG, PNG, WEBP) are allowed');
    }
    if ((file.mimetype === 'application/pdf')) {
      if (file.size > 1500000) {
        throw new BadRequestException('PDF file too large. Max size is 1.5MB. Please compress/change the file');
      }
      return file;
    }
    if (file.size <= 1500000) {
      return file;
    }
    try {
      const compressed = await (sharp as any)(file.buffer).jpeg({ quality: 80 }).toBuffer();
      if (compressed.length <= 1500000) {
        return { ...file, buffer: compressed, mimetype: 'image/jpeg', size: compressed.length } as Express.Multer.File;
      }
      throw new BadRequestException('Image too large even after compression. Max size is 1.5MB. Please change the file');
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException('Image too large. Max size is 1.5MB. Please compress/change the file');
    }
  }

  async applyAll(userId: string, body: any, files: any) {
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
    if (verified.rows[0]?.role === 'owner') {
      throw new BadRequestException('You are already an owner');
    }

    const applicantType = body.applicantType || body.applicant_type || 'individual';

    if (applicantType === 'individual') {
      const documentType = body.documentType || body.document_type;
      const documentNumber = body.documentNumber || body.document_number;
      const fullLegalName = body.fullLegalName || body.full_legal_name || body.legalName;
      const dateOfBirth = body.dateOfBirth || body.date_of_birth;
      const taxpayerIdNumber = body.taxpayerIdNumber || body.taxpayer_id_number || body.niuNumber || body.niu_number;
      if (!documentType || !documentNumber || !fullLegalName || !dateOfBirth || !taxpayerIdNumber) {
        throw new BadRequestException('Missing required fields for individual KYC');
      }
      const idFront = this.getFile(files, ['id_front', 'idFront']);
      const idBack = this.getFile(files, ['id_back', 'idBack']);
      const selfie = this.getFile(files, ['selfie_with_id', 'selfieWithId']);
      const taxpayerProof = this.getFile(files, ['taxpayer_id_proof', 'taxpayerIdProof']);
      if (!idFront) throw new BadRequestException('Missing required file: id_front');
      if (!idBack) throw new BadRequestException('Missing required file: id_back');
      if (!selfie) throw new BadRequestException('Missing required file: selfie_with_id');
      if (!taxpayerProof) throw new BadRequestException('Missing required file: taxpayer_id_proof');

      const [f1, f2, f3, f4] = await Promise.all([
        this.validateAndPrepareFile(idFront),
        this.validateAndPrepareFile(idBack),
        this.validateAndPrepareFile(selfie),
        this.validateAndPrepareFile(taxpayerProof),
      ]);

      const client = await (this.db as any).pool.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query(
          `INSERT INTO public.kyc_submissions (user_id, applicant_type, status, document_type, document_number, full_legal_name, date_of_birth, phone_number, taxpayer_id_number)
           VALUES ($1, 'individual', 'under_review', $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [userId, documentType, documentNumber, fullLegalName, dateOfBirth, body.phoneNumber || body.phone_number || null, taxpayerIdNumber],
        );
        const submission = result.rows[0];
        const upload = async (file: Express.Multer.File, type: string) => {
          const uploaded = await this.storage.uploadFile({ file, subdir: `kyc/${userId}/${submission.id}`, maxSizeBytes: 1500000 });
          await client.query(
            `INSERT INTO public.kyc_documents (submission_id, type, storage_path, mime_type, size_bytes) VALUES ($1,$2,$3,$4,$5)`,
            [submission.id, type, uploaded.relativePath, file.mimetype, file.size],
          );
        };
        await upload(f1, 'id_front');
        await upload(f2, 'id_back');
        await upload(f3, 'selfie_with_id');
        await upload(f4, 'taxpayer_id_proof');
        await client.query(`UPDATE public.users SET kyc_status = 'pending' WHERE user_id = $1`, [userId]);
        await client.query('COMMIT');
        return { message: 'KYC submitted for review', submission };
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    if (applicantType === 'business') {
      const businessName = body.businessName || body.business_name;
      const rccmNumber = body.rccmNumber || body.rccm_number;
      if (!businessName || !rccmNumber) {
        throw new BadRequestException('Missing required fields for business KYC');
      }
      const rccm = this.getFile(files, ['rccm']);
      const legalRepIdFront = this.getFile(files, ['legal_rep_id_front', 'legalRepIdFront']);
      const legalRepIdBack = this.getFile(files, ['legal_rep_id_back', 'legalRepIdBack']);
      const legalRepSelfie = this.getFile(files, ['legal_rep_selfie_with_id', 'legalRepSelfieWithId']);
      if (!rccm) throw new BadRequestException('Missing required file: rccm');
      if (!legalRepIdFront) throw new BadRequestException('Missing required file: legal_rep_id_front');
      if (!legalRepIdBack) throw new BadRequestException('Missing required file: legal_rep_id_back');
      if (!legalRepSelfie) throw new BadRequestException('Missing required file: legal_rep_selfie_with_id');

      const [f1, f2, f3, f4] = await Promise.all([
        this.validateAndPrepareFile(rccm),
        this.validateAndPrepareFile(legalRepIdFront),
        this.validateAndPrepareFile(legalRepIdBack),
        this.validateAndPrepareFile(legalRepSelfie),
      ]);

      const taxpayerProof = this.getFile(files, ['taxpayer_id_proof', 'taxpayerIdProof', 'niu']);
      if (taxpayerProof) {
        const fp = await this.validateAndPrepareFile(taxpayerProof);
        (files as any).__taxpayer = fp;
      }

      const client = await (this.db as any).pool.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query(
          `INSERT INTO public.kyc_submissions (user_id, applicant_type, status, document_type, document_number, full_legal_name, date_of_birth, phone_number, taxpayer_id_number, business_name, rccm_number, niu_number, legal_representative_name, legal_representative_phone)
           VALUES ($1, 'business', 'under_review', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           RETURNING *`,
          [
            userId,
            body.documentType || body.document_type || 'cni',
            body.documentNumber || body.document_number || '',
            body.fullLegalName || body.full_legal_name || body.legalRepresentativeName || body.legal_representative_name || businessName,
            body.dateOfBirth || body.date_of_birth || '1970-01-01',
            body.phoneNumber || body.phone_number || body.legalRepresentativePhone || body.legal_representative_phone || null,
            body.taxpayerIdNumber || body.taxpayer_id_number || body.niuNumber || body.niu_number || '',
            businessName,
            rccmNumber,
            body.niuNumber || body.niu_number || null,
            body.legalRepresentativeName || body.legal_representative_name || null,
            body.legalRepresentativePhone || body.legal_representative_phone || null,
          ],
        );
        const submission = result.rows[0];
        const upload = async (file: Express.Multer.File, type: string) => {
          const uploaded = await this.storage.uploadFile({ file, subdir: `kyc/${userId}/${submission.id}`, maxSizeBytes: 1500000 });
          await client.query(
            `INSERT INTO public.kyc_documents (submission_id, type, storage_path, mime_type, size_bytes) VALUES ($1,$2,$3,$4,$5)`,
            [submission.id, type, uploaded.relativePath, file.mimetype, file.size],
          );
        };
        await upload(f1, 'rccm');
        await upload(f2, 'legal_rep_id_front');
        await upload(f3, 'legal_rep_id_back');
        await upload(f4, 'legal_rep_selfie_with_id');
        if ((files as any).__taxpayer) await upload((files as any).__taxpayer, 'taxpayer_id_proof');
        await client.query(`UPDATE public.users SET kyc_status = 'pending' WHERE user_id = $1`, [userId]);
        await client.query('COMMIT');
        return { message: 'KYC submitted for review', submission };
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    throw new BadRequestException('Invalid applicant type');
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
      `SELECT id, user_id, status, applicant_type FROM public.kyc_submissions WHERE id = $1`,
      [submissionId],
    );
    if (!sub.rows[0]) throw new NotFoundException('Submission not found');
    if (sub.rows[0].user_id !== userId) throw new ForbiddenException();
    if (!['pending', 'rejected'].includes(sub.rows[0].status)) {
      throw new BadRequestException('Cannot upload documents for this submission');
    }

    const individualTypes = ['id_front', 'id_back', 'selfie_with_id', 'taxpayer_id_proof'];
    const businessTypes = ['rccm', 'niu', 'taxpayer_id_proof', 'legal_rep_id_front', 'legal_rep_id_back', 'legal_rep_selfie_with_id', 'id_front', 'id_back', 'selfie_with_id'];
    const allowedTypes = sub.rows[0].applicant_type === 'business' ? businessTypes : individualTypes;
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
      `SELECT id, user_id, status, applicant_type FROM public.kyc_submissions WHERE id = $1`,
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

    if (sub.rows[0].applicant_type === 'business') {
      const required = ['rccm', 'legal_rep_id_front', 'legal_rep_id_back', 'legal_rep_selfie_with_id'];
      for (const r of required) {
        if (!types.includes(r)) throw new BadRequestException(`Missing required document: ${r}`);
      }
    } else {
      const required = ['id_front', 'id_back', 'selfie_with_id', 'taxpayer_id_proof'];
      for (const r of required) {
        if (!types.includes(r)) throw new BadRequestException(`Missing required document: ${r}`);
      }
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
    const subResult = await this.db.query(
      `SELECT user_id, applicant_type, business_name, rccm_number, niu_number, legal_representative_name, legal_representative_phone, full_legal_name FROM public.kyc_submissions WHERE id = $1`,
      [submissionId],
    );
    if (!subResult.rows[0]) throw new NotFoundException('Submission not found');
    const sub = subResult.rows[0];
    const userId = sub.user_id;
    const businessName = sub.business_name || sub.full_legal_name || 'Business';

    await this.db.query(
      `UPDATE public.kyc_submissions SET status = 'verified', reviewed_by = $2, reviewed_at = now(), updated_at = now() WHERE id = $1`,
      [submissionId, reviewerId],
    );
    await this.db.query(
      `UPDATE public.users SET kyc_status = 'verified', role = 'owner', updated_at = now() WHERE user_id = $1`,
      [userId],
    );

    await this.db.query(
      `INSERT INTO public.business_accounts (user_id, business_name, tax_info, verification_status, applicant_type, type, rccm_number, niu_number, legal_representative_name, legal_representative_phone, kyc_submission_id, verified_at)
       VALUES ($1, $2, $3, 'verified', $4, $4, $5, $6, $7, $8, $9, now())
       ON CONFLICT (user_id) DO UPDATE SET
         business_name = EXCLUDED.business_name,
         tax_info = EXCLUDED.tax_info,
         verification_status = 'verified',
         applicant_type = EXCLUDED.applicant_type,
         type = EXCLUDED.type,
         rccm_number = EXCLUDED.rccm_number,
         niu_number = EXCLUDED.niu_number,
         legal_representative_name = EXCLUDED.legal_representative_name,
         legal_representative_phone = EXCLUDED.legal_representative_phone,
         kyc_submission_id = EXCLUDED.kyc_submission_id,
         verified_at = now(),
         updated_at = now()`,
      [
        userId,
        businessName,
        sub.niu_number || sub.rccm_number || null,
        sub.applicant_type,
        sub.rccm_number || null,
        sub.niu_number || null,
        sub.legal_representative_name || null,
        sub.legal_representative_phone || null,
        submissionId,
      ],
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
