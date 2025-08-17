import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      auth?: {
        header: Record<string, any>;
        payload: {
          sub: string;
          iss: string;
          aud: string | string[];
          iat: number;
          exp: number;
          scope?: string;
          permissions?: string[];
          [key: string]: any;
        };
      };
      user?: {
        id: string;
        username: string;
        email: string;
        sub: string;
        [key: string]: any;
      };
    }
  }
}
