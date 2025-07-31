import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

/**
 * Validation middleware factory
 */
const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    
    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors,
      });
    }

    next();
  };
};

/**
 * User registration validation schema
 */
const registrationSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),
  
  password: Joi.string()
    .min(8)
    .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])'))
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character',
      'any.required': 'Password is required',
    }),
  
  firstName: Joi.string()
    .min(1)
    .max(50)
    .required()
    .messages({
      'string.min': 'First name cannot be empty',
      'string.max': 'First name cannot exceed 50 characters',
      'any.required': 'First name is required',
    }),
  
  lastName: Joi.string()
    .min(1)
    .max(50)
    .required()
    .messages({
      'string.min': 'Last name cannot be empty',
      'string.max': 'Last name cannot exceed 50 characters',
      'any.required': 'Last name is required',
    }),
});

/**
 * User login validation schema
 */
const loginSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),
  
  password: Joi.string()
    .required()
    .messages({
      'any.required': 'Password is required',
    }),
});

/**
 * Profile update validation schema
 */
const profileUpdateSchema = Joi.object({
  firstName: Joi.string()
    .min(1)
    .max(50)
    .optional()
    .messages({
      'string.min': 'First name cannot be empty',
      'string.max': 'First name cannot exceed 50 characters',
    }),
  
  lastName: Joi.string()
    .min(1)
    .max(50)
    .optional()
    .messages({
      'string.min': 'Last name cannot be empty',
      'string.max': 'Last name cannot exceed 50 characters',
    }),
  
  avatar: Joi.string()
    .uri()
    .optional()
    .messages({
      'string.uri': 'Avatar must be a valid URL',
    }),
});

/**
 * File upload validation schema
 */
const fileUploadSchema = Joi.object({
  files: Joi.array()
    .items(Joi.object({
      filename: Joi.string().required(),
      mimeType: Joi.string().valid(
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/heic',
        'video/mp4',
        'video/quicktime',
        'video/x-msvideo'
      ).required(),
      size: Joi.number().max(104857600).required(), // 100MB max
    }))
    .min(1)
    .required(),
  
  albumId: Joi.string().optional(),
});

/**
 * Album creation validation schema
 */
const albumCreateSchema = Joi.object({
  name: Joi.string()
    .min(1)
    .max(100)
    .required()
    .messages({
      'string.min': 'Album name cannot be empty',
      'string.max': 'Album name cannot exceed 100 characters',
      'any.required': 'Album name is required',
    }),
  
  description: Joi.string()
    .max(500)
    .optional()
    .messages({
      'string.max': 'Description cannot exceed 500 characters',
    }),
});

/**
 * Search validation schema
 */
const searchSchema = Joi.object({
  query: Joi.string()
    .min(1)
    .max(100)
    .required()
    .messages({
      'string.min': 'Search query cannot be empty',
      'string.max': 'Search query cannot exceed 100 characters',
      'any.required': 'Search query is required',
    }),
  
  page: Joi.number()
    .integer()
    .min(1)
    .default(1)
    .optional(),
  
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(20)
    .optional(),
  
  fileType: Joi.string()
    .valid('image', 'video', 'all')
    .default('all')
    .optional(),
  
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
});

// Export validation middlewares
export const validateRegistration = validate(registrationSchema);
export const validateLogin = validate(loginSchema);
export const validateProfileUpdate = validate(profileUpdateSchema);
export const validateFileUpload = validate(fileUploadSchema);
export const validateAlbumCreate = validate(albumCreateSchema);
export const validateSearch = validate(searchSchema);
