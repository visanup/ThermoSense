// service/watcher-service/src/server.ts

import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { AppDataSource } from './utils/dataSource';
import { errorHandler } from './middleware/errorHandler';
import { PORT } from './configs/config';
import { watchRawAndProcessedBuckets } from './services/watchRawBucket.service';
import { startReconciliationLoop } from './services/reconciliation.service';

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

    // 1) Init DB
    await AppDataSource.initialize();
    console.log('✅ DataSource has been initialized');

    // 2) Create app and middleware
    const app = express();
    app.use(helmet());
    app.use(cors());
    app.use(morgan('combined'));
    app.use(express.json());

    // 3) Health check
    app.get('/health', (_req, res) => {
      console.log('Health check hit');
      res.json({ status: 'ok', ts: new Date().toISOString() });
    });

    // 4) Error handler (after routes)
    app.use(errorHandler);

    // 5) Listen
    const server = app.listen(PORT, () => {
      console.log(`🚀 Watcher service running on http://localhost:${PORT}`);

      // เริ่มเฝ้าดูทั้ง raw + processed buckets
      try {
        watchRawAndProcessedBuckets();
      } catch (e) {
        console.error('❌ Failed to start bucket watchers:', e);
      }

      // เริ่ม reconciliation loop
      try {
        startReconciliationLoop();
      } catch (e) {
        console.error('❌ Failed to start reconciliation loop:', e);
      }
    });

    // 6) Graceful shutdown
    const shutdown = () => {
      console.log('⚡️ Shutting down server...');
      server.close(async () => {
        try {
          await AppDataSource.destroy();
          console.log('✅ DataSource has been destroyed');
        } catch (e) {
          console.warn('⚠️ Error during DataSource destroy:', e);
        }
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
