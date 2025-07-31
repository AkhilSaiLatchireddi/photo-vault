// import { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminSetUserPasswordCommand, AdminInitiateAuthCommand } from '@aws-sdk/client-cognito-identity-provider';
// import jwt from 'jsonwebtoken';
// import bcrypt from 'bcrypt';
// import { PrismaClient } from '@prisma/client';

// const prisma = new PrismaClient();

// const cognitoClient = new CognitoIdentityProviderClient({
//   region: process.env.AWS_REGION || 'us-east-1',
//   credentials: {
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
//   },
// });

// export interface User {
//   id: string;
//   email: string;
//   cognitoId: string;
//   firstName: string;
//   lastName: string;
//   avatar?: string;
// }

// export interface AuthTokens {
//   accessToken: string;
//   refreshToken: string;
//   user: User;
// }

// export class AuthService {
//   private readonly userPoolId = process.env.COGNITO_USER_POOL_ID!;
//   private readonly clientId = process.env.COGNITO_CLIENT_ID!;
//   private readonly clientSecret = process.env.COGNITO_CLIENT_SECRET!;
//   private readonly jwtSecret = process.env.JWT_SECRET!;

//   /**
//    * Register a new user
//    */
//   async register(userData: {
//     email: string;
//     password: string;
//     firstName: string;
//     lastName: string;
//   }): Promise<AuthTokens> {
//     try {
//       // Create user in Cognito
//       const createUserCommand = new AdminCreateUserCommand({
//         UserPoolId: this.userPoolId,
//         Username: userData.email,
//         UserAttributes: [
//           { Name: 'email', Value: userData.email },
//           { Name: 'email_verified', Value: 'true' },
//           { Name: 'given_name', Value: userData.firstName },
//           { Name: 'family_name', Value: userData.lastName },
//         ],
//         TemporaryPassword: userData.password,
//         MessageAction: 'SUPPRESS', // Don't send welcome email
//       });

//       const cognitoUser = await cognitoClient.send(createUserCommand);
//       const cognitoId = cognitoUser.User?.Username!;

//       // Set permanent password
//       const setPasswordCommand = new AdminSetUserPasswordCommand({
//         UserPoolId: this.userPoolId,
//         Username: cognitoId,
//         Password: userData.password,
//         Permanent: true,
//       });

//       await cognitoClient.send(setPasswordCommand);

//       // Create user in our database
//       const user = await prisma.user.create({
//         data: {
//           email: userData.email,
//           cognitoId,
//           firstName: userData.firstName,
//           lastName: userData.lastName,
//         },
//       });

//       // Generate tokens
//       const tokens = this.generateTokens(user);

//       return {
//         ...tokens,
//         user: {
//           id: user.id,
//           email: user.email,
//           cognitoId: user.cognitoId,
//           firstName: user.firstName,
//           lastName: user.lastName,
//           avatar: user.avatar,
//         },
//       };
//     } catch (error) {
//       console.error('Registration error:', error);
//       throw new Error('Failed to register user');
//     }
//   }

//   /**
//    * Login user
//    */
//   async login(email: string, password: string): Promise<AuthTokens> {
//     try {
//       // Authenticate with Cognito
//       const authCommand = new AdminInitiateAuthCommand({
//         UserPoolId: this.userPoolId,
//         ClientId: this.clientId,
//         AuthFlow: 'ADMIN_NO_SRP_AUTH',
//         AuthParameters: {
//           USERNAME: email,
//           PASSWORD: password,
//           SECRET_HASH: this.calculateSecretHash(email),
//         },
//       });

//       const authResult = await cognitoClient.send(authCommand);
      
//       if (!authResult.AuthenticationResult?.AccessToken) {
//         throw new Error('Authentication failed');
//       }

//       // Get user from database
//       const user = await prisma.user.findUnique({
//         where: { email },
//       });

//       if (!user) {
//         throw new Error('User not found in database');
//       }

//       // Generate our own tokens
//       const tokens = this.generateTokens(user);

//       return {
//         ...tokens,
//         user: {
//           id: user.id,
//           email: user.email,
//           cognitoId: user.cognitoId,
//           firstName: user.firstName,
//           lastName: user.lastName,
//           avatar: user.avatar,
//         },
//       };
//     } catch (error) {
//       console.error('Login error:', error);
//       throw new Error('Invalid credentials');
//     }
//   }

//   /**
//    * Verify JWT token
//    */
//   async verifyToken(token: string): Promise<User | null> {
//     try {
//       const decoded = jwt.verify(token, this.jwtSecret) as any;
      
//       const user = await prisma.user.findUnique({
//         where: { id: decoded.userId },
//       });

//       if (!user) {
//         return null;
//       }

//       return {
//         id: user.id,
//         email: user.email,
//         cognitoId: user.cognitoId,
//         firstName: user.firstName,
//         lastName: user.lastName,
//         avatar: user.avatar,
//       };
//     } catch (error) {
//       console.error('Token verification error:', error);
//       return null;
//     }
//   }

//   /**
//    * Refresh access token
//    */
//   async refreshToken(refreshToken: string): Promise<AuthTokens> {
//     try {
//       const decoded = jwt.verify(refreshToken, this.jwtSecret) as any;
      
//       if (decoded.type !== 'refresh') {
//         throw new Error('Invalid refresh token');
//       }

//       const user = await prisma.user.findUnique({
//         where: { id: decoded.userId },
//       });

//       if (!user) {
//         throw new Error('User not found');
//       }

//       const tokens = this.generateTokens(user);

//       return {
//         ...tokens,
//         user: {
//           id: user.id,
//           email: user.email,
//           cognitoId: user.cognitoId,
//           firstName: user.firstName,
//           lastName: user.lastName,
//           avatar: user.avatar,
//         },
//       };
//     } catch (error) {
//       console.error('Refresh token error:', error);
//       throw new Error('Invalid refresh token');
//     }
//   }

//   /**
//    * Update user profile
//    */
//   async updateProfile(userId: string, updates: {
//     firstName?: string;
//     lastName?: string;
//     avatar?: string;
//   }): Promise<User> {
//     try {
//       const user = await prisma.user.update({
//         where: { id: userId },
//         data: updates,
//       });

//       return {
//         id: user.id,
//         email: user.email,
//         cognitoId: user.cognitoId,
//         firstName: user.firstName,
//         lastName: user.lastName,
//         avatar: user.avatar,
//       };
//     } catch (error) {
//       console.error('Profile update error:', error);
//       throw new Error('Failed to update profile');
//     }
//   }

//   /**
//    * Generate JWT tokens
//    */
//   private generateTokens(user: any) {
//     const accessToken = jwt.sign(
//       { 
//         userId: user.id,
//         email: user.email,
//         type: 'access'
//       },
//       this.jwtSecret,
//       { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
//     );

//     const refreshToken = jwt.sign(
//       { 
//         userId: user.id,
//         type: 'refresh'
//       },
//       this.jwtSecret,
//       { expiresIn: '30d' }
//     );

//     return { accessToken, refreshToken };
//   }

//   /**
//    * Calculate secret hash for Cognito
//    */
//   private calculateSecretHash(username: string): string {
//     const message = username + this.clientId;
//     return Buffer.from(
//       require('crypto')
//         .createHmac('sha256', this.clientSecret)
//         .update(message)
//         .digest()
//     ).toString('base64');
//   }
// }

// export const authService = new AuthService();
