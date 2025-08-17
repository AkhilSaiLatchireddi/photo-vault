import { Request } from 'express';
import { VerifyJwtResult } from 'express-oauth2-jwt-bearer';

declare global {
  namespace Express {
    interface Request {
      auth?: VerifyJwtResult & {
        sub: string;
        iss: string;
        aud: string | string[];
        iat: number;
        exp: number;
        azp?: string;
        scope?: string;
        [key: string]: any;
      };
    }
  }
}

export {};
