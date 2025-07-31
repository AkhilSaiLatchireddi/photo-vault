// import express from 'express';
// // import { authService } from '../services/auth.service';
// import { authMiddleware } from '../middleware/auth.middleware';
// import { validateRegistration, validateLogin } from '../validators/auth.validator';

// const router = express.Router();

// /**
//  * POST /api/auth/register
//  * Register a new user
//  */
// router.post('/register', validateRegistration, async (req, res) => {
//   try {
//     const { email, password, firstName, lastName } = req.body;

//     const result = await authService.register({
//       email,
//       password,
//       firstName,
//       lastName,
//     });

//     res.status(201).json({
//       success: true,
//       message: 'User registered successfully',
//       data: result,
//     });
//   } catch (error: any) {
//     console.error('Registration error:', error);
//     res.status(400).json({
//       success: false,
//       message: error.message || 'Registration failed',
//     });
//   }
// });

// /**
//  * POST /api/auth/login
//  * Login user
//  */
// router.post('/login', validateLogin, async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     const result = await authService.login(email, password);

//     res.json({
//       success: true,
//       message: 'Login successful',
//       data: result,
//     });
//   } catch (error: any) {
//     console.error('Login error:', error);
//     res.status(401).json({
//       success: false,
//       message: error.message || 'Login failed',
//     });
//   }
// });

// /**
//  * POST /api/auth/refresh
//  * Refresh access token
//  */
// router.post('/refresh', async (req, res) => {
//   try {
//     const { refreshToken } = req.body;

//     if (!refreshToken) {
//       return res.status(400).json({
//         success: false,
//         message: 'Refresh token is required',
//       });
//     }

//     const result = await authService.refreshToken(refreshToken);

//     res.json({
//       success: true,
//       message: 'Token refreshed successfully',
//       data: result,
//     });
//   } catch (error: any) {
//     console.error('Refresh token error:', error);
//     res.status(401).json({
//       success: false,
//       message: error.message || 'Token refresh failed',
//     });
//   }
// });

// /**
//  * GET /api/auth/profile
//  * Get user profile
//  */
// router.get('/profile', authMiddleware, async (req, res) => {
//   try {
//     res.json({
//       success: true,
//       data: req.user,
//     });
//   } catch (error: any) {
//     console.error('Profile fetch error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to fetch profile',
//     });
//   }
// });

// /**
//  * PUT /api/auth/profile
//  * Update user profile
//  */
// router.put('/profile', authMiddleware, async (req, res) => {
//   try {
//     const { firstName, lastName, avatar } = req.body;
//     const userId = req.user!.id;

//     const updatedUser = await authService.updateProfile(userId, {
//       firstName,
//       lastName,
//       avatar,
//     });

//     res.json({
//       success: true,
//       message: 'Profile updated successfully',
//       data: updatedUser,
//     });
//   } catch (error: any) {
//     console.error('Profile update error:', error);
//     res.status(400).json({
//       success: false,
//       message: error.message || 'Profile update failed',
//     });
//   }
// });

// /**
//  * POST /api/auth/logout
//  * Logout user (client-side token removal)
//  */
// router.post('/logout', authMiddleware, async (req, res) => {
//   try {
//     // For JWT tokens, logout is handled client-side by removing the token
//     // In a production app, you might want to maintain a blacklist of tokens
//     res.json({
//       success: true,
//       message: 'Logout successful',
//     });
//   } catch (error: any) {
//     console.error('Logout error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Logout failed',
//     });
//   }
// });

// export default router;
