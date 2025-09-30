import { auth0Service } from '../auth0.service';
import * as jwt from 'jsonwebtoken';

// Mock dependencies
jest.mock('jsonwebtoken');
jest.mock('jwks-rsa');
jest.mock('../database.service', () => ({
  databaseService: {
    getUserByAuth0Id: jest.fn(),
    createAuth0User: jest.fn(),
    updateAuth0User: jest.fn()
  }
}));

const mockJwt = jwt as jest.Mocked<typeof jwt>;
const mockJwksClient = require('jwks-rsa');

describe('Auth0Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default environment
    process.env.AUTH0_DOMAIN = 'test-domain.auth0.com';
    process.env.AUTH0_AUDIENCE = 'https://api.photovault.com';
  });

  afterEach(() => {
    // Clean up environment
    delete process.env.AUTH0_DOMAIN;
    delete process.env.AUTH0_AUDIENCE;
  });

  describe('verifyToken', () => {
    it('should verify valid token successfully', async () => {
      const mockToken = 'valid.jwt.token';
      const mockDecoded = {
        header: { kid: 'test-key-id' },
        payload: {
          sub: 'auth0|123456',
          email: 'test@example.com',
          name: 'Test User',
          email_verified: true
        }
      };
      const mockAuth0User = {
        sub: 'auth0|123456',
        email: 'test@example.com',
        name: 'Test User',
        email_verified: true
      };

      // Mock JWT decode
      mockJwt.decode.mockReturnValue(mockDecoded);
      
      // Mock JWT verify
      (mockJwt.verify as jest.Mock).mockReturnValue(mockAuth0User);

      // Mock JWKS client
      const mockGetSigningKey = jest.fn().mockImplementation((kid, callback) => {
        callback(null, {
          getPublicKey: () => 'mock-public-key'
        });
      });
      mockJwksClient.mockReturnValue({
        getSigningKey: mockGetSigningKey
      });

      const result = await auth0Service.verifyToken(mockToken);

      expect(mockJwt.decode).toHaveBeenCalledWith(mockToken, { complete: true });
      expect(mockJwt.verify).toHaveBeenCalledWith(
        mockToken,
        'mock-public-key',
        {
          algorithms: ['RS256'],
          audience: 'https://api.photovault.com',
          issuer: 'https://test-domain.auth0.com/'
        }
      );
      expect(result).toEqual(mockAuth0User);
    });

    it('should return null for invalid token', async () => {
      const mockToken = 'invalid.token';

      mockJwt.decode.mockReturnValue(null);

      const result = await auth0Service.verifyToken(mockToken);

      expect(result).toBeNull();
    });

    it('should handle verification errors', async () => {
      const mockToken = 'valid.jwt.token';
      const mockDecoded = {
        header: { kid: 'test-key-id' },
        payload: {}
      };

      mockJwt.decode.mockReturnValue(mockDecoded);
      mockJwt.verify.mockImplementation(() => {
        throw new Error('Token verification failed');
      });

      const mockGetSigningKey = jest.fn().mockImplementation((kid, callback) => {
        callback(null, {
          getPublicKey: () => 'mock-public-key'
        });
      });
      mockJwksClient.mockReturnValue({
        getSigningKey: mockGetSigningKey
      });

      const result = await auth0Service.verifyToken(mockToken);

      expect(result).toBeNull();
    });

    it('should handle JWKS key retrieval errors', async () => {
      const mockToken = 'valid.jwt.token';
      const mockDecoded = {
        header: { kid: 'test-key-id' },
        payload: {}
      };

      mockJwt.decode.mockReturnValue(mockDecoded);

      const mockGetSigningKey = jest.fn().mockImplementation((kid, callback) => {
        callback(new Error('Key retrieval failed'), null);
      });
      mockJwksClient.mockReturnValue({
        getSigningKey: mockGetSigningKey
      });

      const result = await auth0Service.verifyToken(mockToken);

      expect(result).toBeNull();
    });
  });

  describe('syncUser', () => {
    const mockAuth0User = {
      sub: 'auth0|123456',
      email: 'test@example.com',
      name: 'Test User',
      nickname: 'testuser',
      picture: 'https://example.com/avatar.jpg',
      email_verified: true
    };

    it('should create new user if not exists', async () => {
      const { databaseService } = require('../database.service');
      
      databaseService.getUserByAuth0Id.mockResolvedValue(null);
      databaseService.createAuth0User.mockResolvedValue({
        _id: 'user-mongo-id',
        auth0Id: 'auth0|123456',
        username: 'testuser',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg',
        emailVerified: true
      });

      const result = await auth0Service.syncUser(mockAuth0User);

      expect(databaseService.getUserByAuth0Id).toHaveBeenCalledWith('auth0|123456');
      expect(databaseService.createAuth0User).toHaveBeenCalledWith({
        auth0Id: 'auth0|123456',
        username: 'testuser',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg',
        emailVerified: true
      });
      expect(result).toEqual({
        id: 'user-mongo-id',
        auth0Id: 'auth0|123456',
        username: 'testuser',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg',
        emailVerified: true
      });
    });

    it('should update existing user', async () => {
      const { databaseService } = require('../database.service');
      
      const existingUser = {
        _id: 'user-mongo-id',
        auth0Id: 'auth0|123456',
        username: 'testuser',
        email: 'old@example.com',
        name: 'Old Name'
      };

      const updatedUser = {
        _id: 'user-mongo-id',
        auth0Id: 'auth0|123456',
        username: 'testuser',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg',
        emailVerified: true
      };

      databaseService.getUserByAuth0Id.mockResolvedValue(existingUser);
      databaseService.updateAuth0User.mockResolvedValue(updatedUser);

      const result = await auth0Service.syncUser(mockAuth0User);

      expect(databaseService.updateAuth0User).toHaveBeenCalledWith('user-mongo-id', {
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg',
        emailVerified: true
      });
      expect(result).toEqual({
        id: 'user-mongo-id',
        auth0Id: 'auth0|123456',
        username: 'testuser',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg',
        emailVerified: true
      });
    });

    it('should generate username from email if no nickname', async () => {
      const { databaseService } = require('../database.service');
      
      const auth0UserNoNickname = {
        ...mockAuth0User,
        nickname: undefined,
        name: undefined
      };

      databaseService.getUserByAuth0Id.mockResolvedValue(null);
      databaseService.createAuth0User.mockResolvedValue({
        _id: 'user-mongo-id',
        auth0Id: 'auth0|123456',
        username: 'test', // Generated from email
        email: 'test@example.com'
      });

      await auth0Service.syncUser(auth0UserNoNickname);

      expect(databaseService.createAuth0User).toHaveBeenCalledWith({
        auth0Id: 'auth0|123456',
        username: 'test',
        email: 'test@example.com',
        name: undefined,
        picture: 'https://example.com/avatar.jpg',
        emailVerified: true
      });
    });

    it('should handle sync errors', async () => {
      const { databaseService } = require('../database.service');
      
      databaseService.getUserByAuth0Id.mockRejectedValue(new Error('Database error'));

      await expect(auth0Service.syncUser(mockAuth0User))
        .rejects.toThrow('Database error');
    });
  });

  describe('getUserByAuth0Id', () => {
    it('should return user by Auth0 ID', async () => {
      const { databaseService } = require('../database.service');
      
      const mockUser = {
        _id: 'user-mongo-id',
        auth0Id: 'auth0|123456',
        username: 'testuser',
        email: 'test@example.com',
        name: 'Test User'
      };

      databaseService.getUserByAuth0Id.mockResolvedValue(mockUser);

      const result = await auth0Service.getUserByAuth0Id('auth0|123456');

      expect(databaseService.getUserByAuth0Id).toHaveBeenCalledWith('auth0|123456');
      expect(result).toEqual({
        id: 'user-mongo-id',
        auth0Id: 'auth0|123456',
        username: 'testuser',
        email: 'test@example.com',
        name: 'Test User',
        picture: undefined,
        emailVerified: undefined
      });
    });

    it('should return null if user not found', async () => {
      const { databaseService } = require('../database.service');
      
      databaseService.getUserByAuth0Id.mockResolvedValue(null);

      const result = await auth0Service.getUserByAuth0Id('nonexistent-id');

      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      const { databaseService } = require('../database.service');
      
      databaseService.getUserByAuth0Id.mockRejectedValue(new Error('Database error'));

      const result = await auth0Service.getUserByAuth0Id('auth0|123456');

      expect(result).toBeNull();
    });
  });

  describe('processAuth0Token', () => {
    it('should process token and sync user successfully', async () => {
      const mockToken = 'valid.jwt.token';
      const mockAuth0User = {
        sub: 'auth0|123456',
        email: 'test@example.com',
        name: 'Test User'
      };
      const mockAuthUser = {
        id: 'user-mongo-id',
        auth0Id: 'auth0|123456',
        username: 'testuser',
        email: 'test@example.com',
        name: 'Test User'
      };

      // Mock verifyToken method
      jest.spyOn(auth0Service, 'verifyToken').mockResolvedValue(mockAuth0User);
      
      // Mock syncUser method
      jest.spyOn(auth0Service, 'syncUser').mockResolvedValue(mockAuthUser);

      const result = await auth0Service.processAuth0Token(mockToken);

      expect(auth0Service.verifyToken).toHaveBeenCalledWith(mockToken);
      expect(auth0Service.syncUser).toHaveBeenCalledWith(mockAuth0User);
      expect(result).toEqual(mockAuthUser);
    });

    it('should return null for invalid token', async () => {
      const mockToken = 'invalid.token';

      jest.spyOn(auth0Service, 'verifyToken').mockResolvedValue(null);

      const result = await auth0Service.processAuth0Token(mockToken);

      expect(result).toBeNull();
    });

    it('should handle processing errors', async () => {
      const mockToken = 'valid.jwt.token';

      jest.spyOn(auth0Service, 'verifyToken').mockRejectedValue(new Error('Verification failed'));

      const result = await auth0Service.processAuth0Token(mockToken);

      expect(result).toBeNull();
    });
  });

  describe('service initialization', () => {
    it('should handle missing Auth0 configuration', () => {
      delete process.env.AUTH0_DOMAIN;
      delete process.env.AUTH0_AUDIENCE;

      // Test that service can be created without throwing
      const { Auth0Service } = require('../auth0.service');
      expect(() => new Auth0Service()).not.toThrow();
    });

    it('should initialize with valid configuration', () => {
      process.env.AUTH0_DOMAIN = 'test.auth0.com';
      process.env.AUTH0_AUDIENCE = 'https://api.test.com';

      const { Auth0Service } = require('../auth0.service');
      expect(() => new Auth0Service()).not.toThrow();
    });
  });
});
