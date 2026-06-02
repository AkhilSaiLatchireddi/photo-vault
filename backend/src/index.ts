import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import profileRoutes from './routes/profile.routes';
import filesRoutes from './routes/files.routes';
import albumsRoutes from './routes/albums.routes';
import publicRoutes from './routes/public.routes';
import peopleRoutes from './routes/people.routes';

if (process.env.NODE_ENV !== 'production') dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.set('trust proxy', 1);

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://akhilsailatchireddi.github.io',
];

app.use(helmet({ contentSecurityPolicy: process.env.NODE_ENV === 'production' }));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 300 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: req => req.path === '/health',
}));

const corsOptions = {
  origin: ALLOWED_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, _res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

app.get('/health', (_req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString(), env: process.env.NODE_ENV });
});

// Temporary debug endpoint — decodes token header without verification
app.get('/debug-token', (req, res) => {
  const auth = req.headers.authorization || '';
  const token = auth.replace('Bearer ', '');
  if (!token) return res.json({ error: 'No token provided' });
  try {
    const [headerB64] = token.split('.');
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString());
    const [, payloadB64] = token.split('.');
    const payload = payloadB64 ? JSON.parse(Buffer.from(payloadB64, 'base64url').toString()) : null;
    res.json({
      tokenType: token.includes('.') ? 'JWT' : 'opaque',
      header,
      audience: payload?.aud,
      issuer: payload?.iss,
      subject: payload?.sub,
      tokenLength: token.length,
    });
  } catch (e) {
    res.json({ error: 'Failed to decode', tokenLength: token.length, tokenStart: token.substring(0, 20) });
  }
});

app.use('/api/profile', profileRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/albums', albumsRoutes);
app.use('/api/people', peopleRoutes);
app.use('/api/public/albums', publicRoutes);

app.use('*', (_req, res) => res.status(404).json({ error: 'Not Found' }));

app.use((err: Error & { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
  });
});

if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
  app.listen(PORT, () => console.log(`VowVault API running on port ${PORT}`));
}

export default app;
