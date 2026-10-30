import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

function sanitizeString(str: string): string {
  if (typeof str !== 'string') return str;
  return str
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
}

function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return sanitizeString(obj);
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item));
  }
  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }
  return obj;
}

@Injectable()
export class SanitizeMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    if (req.body) {
      req.body = sanitizeObject(req.body);
    }
    if (req.query) {
      const sanitized = sanitizeObject(req.query);
      for (const key in req.query) {
        if (Object.prototype.hasOwnProperty.call(req.query, key)) {
          delete (req.query as any)[key];
        }
      }
      Object.assign(req.query, sanitized);
    }
    if (req.params) {
      const sanitized = sanitizeObject(req.params);
      for (const key in req.params) {
        if (Object.prototype.hasOwnProperty.call(req.params, key)) {
          delete (req.params as any)[key];
        }
      }
      Object.assign(req.params, sanitized);
    }
    next();
  }
}
