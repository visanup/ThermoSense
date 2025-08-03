// services/data-service/src/server.ts
import 'reflect-metadata';
import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { AppDataSource } from './utils/dataSource';
import routes from './routes';
import { authenticateToken } from './middlewares/auth';
import { errorHandler } from './middlewares/errorHandler';
import { PORT } from './configs/config';

async function startServer() {
  try {
    // Global safety handlers
    process.on('unhandledRejection', (reason) => {
      console.error('Unhandled Rejection:', reason);
    });
    process.on('uncaughtException', (err) => {
      console.error('Uncaught Exception:', err);
    });

    // Initialize DB
    await AppDataSource.initialize();
    console.log('✅ DataSource has been initialized');

    const app: Application = express();
    app.set('trust proxy', true);

    // Middleware
    app.use(helmet());
    app.use(
      cors({
        origin:
          process.env.CORS_ALLOWED_ORIGINS === '*'
            ? true
            : process.env.CORS_ALLOWED_ORIGINS
            ? process.env.CORS_ALLOWED_ORIGINS.split(',')
            : undefined,
        credentials: process.env.CORS_ALLOW_CREDENTIALS === 'true',
        methods: process.env.CORS_ALLOW_METHODS
          ? process.env.CORS_ALLOW_METHODS.split(',')
          : undefined,
        allowedHeaders: process.env.CORS_ALLOW_HEADERS
          ? process.env.CORS_ALLOW_HEADERS.split(',')
          : undefined,
      })
    );
    app.use(morgan('combined'));
    app.use(express.json({ limit: '1mb' }));

    // Health
    app.get('/health', (_req: Request, res: Response) => {
      res.sendStatus(200);
    });

    // Protected API
    app.use('/api', authenticateToken, routes);

    // Error handler
    app.use(errorHandler);

    // Start
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server is running on http://localhost:${PORT}`);
    });

    // Graceful shutdown
    const shutdown = () => {
      console.log('⚡️ Shutting down server...');
      server.close(async () => {
        await AppDataSource.destroy();
        console.log('✅ DataSource has been destroyed');
        process.exit(0);
      });
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (err) {
    console.error('❌ Error during startup:', err);
    process.exit(1);
  }
}

startServer();
