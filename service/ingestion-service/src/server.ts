// services/data-service/src/server.ts

import 'reflect-metadata';
import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { AppDataSource } from './utils/dataSource';
import { errorHandler } from './middleware/errorHandler';
import { PORT } from './configs/config';

async function startServer() {
  try {
    // global unhandled error listeners
    process.on('unhandledRejection', (reason) => {
      console.error('Unhandled Rejection:', reason);
    });
    process.on('uncaughtException', (err) => {
      console.error('Uncaught Exception:', err);
      process.exit(1);
    });

    // 1) Initialize DB connection
    await AppDataSource.initialize();
    console.log('✅ DataSource has been initialized');

    const app: Application = express();

    // 2) Security & logging middleware
    app.use(helmet());
    app.use(cors());
    app.use(morgan('combined'));
    app.use(express.json());

    // 3) Health-check endpoint
    app.get('/health', (_req: Request, res: Response) => {
      res.json({ status: 'ok', ts: new Date().toISOString() });
    });

    // 4) (Optional) Mount other routers here if/when added
    // e.g., app.use('/api', someRouter);

    // 5) Global error handler (should be after all routes)
    app.use(errorHandler);

    // 6) Start server
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server is running on http://localhost:${PORT}`);
    });

    // 7) Graceful shutdown
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
