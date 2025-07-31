import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { databaseService, User } from './database.service';

export interface AuthUser {
  id: number;
  username: string;
  email: string;
}

export interface LoginResponse {
  success: boolean;
  user?: AuthUser;
  token?: string;
  message?: string;
}

export interface RegisterResponse {
  success: boolean;
  user?: AuthUser;
  token?: string;
  message?: string;
}

class AuthService {
  private jwtSecret: string;
  private jwtExpiresIn: string;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';
  }

  /**
   * Register a new user
   */
  async register(username: string, email: string, password: string): Promise<RegisterResponse> {
    try {
      // Validate input
      if (!username || !email || !password) {
        return {
          success: false,
          message: 'Username, email, and password are required',
        };
      }

      if (password.length < 6) {
        return {
          success: false,
          message: 'Password must be at least 6 characters long',
        };
      }

      // Check if user already exists
      const existingUserByEmail = await databaseService.getUserByEmail(email);
      if (existingUserByEmail) {
        return {
          success: false,
          message: 'Email already registered',
        };
      }

      const existingUserByUsername = await databaseService.getUserByUsername(username);
      if (existingUserByUsername) {
        return {
          success: false,
          message: 'Username already taken',
        };
      }

      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Create user
      const user = await databaseService.createUser(username, email, hashedPassword);

      // Generate JWT token
      const token = this.generateToken({
        id: user.id,
        username: user.username,
        email: user.email,
      });

      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
        },
        token,
      };
    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        message: 'Registration failed. Please try again.',
      };
    }
  }

  /**
   * Login user
   */
  async login(emailOrUsername: string, password: string): Promise<LoginResponse> {
    try {
      if (!emailOrUsername || !password) {
        return {
          success: false,
          message: 'Email/username and password are required',
        };
      }

      // Find user by email or username
      let user: User | null = null;
      
      if (emailOrUsername.includes('@')) {
        user = await databaseService.getUserByEmail(emailOrUsername);
      } else {
        user = await databaseService.getUserByUsername(emailOrUsername);
      }

      if (!user) {
        return {
          success: false,
          message: 'Invalid credentials',
        };
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return {
          success: false,
          message: 'Invalid credentials',
        };
      }

      // Generate JWT token
      const token = this.generateToken({
        id: user.id,
        username: user.username,
        email: user.email,
      });

      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
        },
        token,
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        message: 'Login failed. Please try again.',
      };
    }
  }

  /**
   * Verify JWT token
   */
  async verifyToken(token: string): Promise<AuthUser | null> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      
      // Get user from database to ensure they still exist
      const user = await databaseService.getUserById(decoded.id);
      if (!user) {
        return null;
      }

      return {
        id: user.id,
        username: user.username,
        email: user.email,
      };
    } catch (error) {
      console.error('Token verification error:', error);
      return null;
    }
  }

  /**
   * Generate JWT token
   */
  private generateToken(user: AuthUser): string {
    return jwt.sign(
      {
        id: user.id,
        username: user.username,
        email: user.email,
      },
      this.jwtSecret,
      {
        expiresIn: this.jwtExpiresIn,
      } as jwt.SignOptions
    );
  }

  /**
   * Get user profile
   */
  async getProfile(userId: number): Promise<AuthUser | null> {
    try {
      const user = await databaseService.getUserById(userId);
      if (!user) {
        return null;
      }

      return {
        id: user.id,
        username: user.username,
        email: user.email,
      };
    } catch (error) {
      console.error('Get profile error:', error);
      return null;
    }
  }
}

export const authService = new AuthService();
