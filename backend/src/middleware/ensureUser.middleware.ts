import { Request, Response, NextFunction } from 'express';
import * as db from '../services/database.service';

export const ensureUserMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sub = req.auth?.payload?.sub as string | undefined;
    if (!sub) return res.status(401).json({ success: false, message: 'Invalid authentication payload' });

    let user = await db.getUserByAuth0Id(sub);

    if (!user) {
      // Pull email + name from the JWT payload (Auth0 adds these when the right scopes are requested)
      const payload = req.auth!.payload as Record<string, unknown>;
      const email = (payload.email ?? payload[`${process.env.AUTH0_DOMAIN}/email`] ?? '') as string;
      const name = (payload.name as string | undefined) ?? email.split('@')[0] ?? 'user';
      const picture = payload.picture as string | undefined;

      // Generate a clean username: prefer email prefix, fall back to short ID from sub
      const emailPrefix = email ? email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '') : '';
      const shortId = sub.includes('|') ? sub.split('|')[1].substring(0, 8) : sub.substring(0, 8);
      const username = emailPrefix || shortId || 'user';

      user = await db.createUser({
        auth0Id: sub,
        email,
        username,
        name,
        picture,
      });
    }

    req.user = { id: user.userId, username: user.username, email: user.email, sub };
    next();
  } catch (error) {
    console.error('Error in ensureUserMiddleware:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
