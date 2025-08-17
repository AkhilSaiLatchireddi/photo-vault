import { Request } from 'express';
import { databaseService } from '../services/database.service';

export async function ensureUserExists(req: Request) {
  const userId = req.auth?.payload.sub;
  const userEmail = req.auth?.payload.email as string | undefined;
  const userName = req.auth?.payload.name as string | undefined;
  const userPicture = req.auth?.payload.picture as string | undefined;
  const emailVerified = req.auth?.payload.email_verified as boolean | undefined;
  
  if (!userId) {
    throw new Error('User not authenticated');
  }

  // Get user from database or create if doesn't exist
  let user = await databaseService.getUserByAuth0Id(userId);
  
  if (!user) {
    // Extract username from email or use a default
    const username = userEmail ? userEmail.split('@')[0] : `user_${Date.now()}`;
    
    // Create user with Auth0 data
    user = await databaseService.createAuth0User({
      auth0Id: userId,
      username: username,
      email: userEmail || '',
      name: userName,
      picture: userPicture,
      emailVerified: emailVerified
    });
  }
  
  return user;
}
