// services/data-service/src/server.ts

import 'reflect-metadata';
import express, { Application, Request, Response, RequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

// โหลด swagger-ui-express ด้วย require แล้ว cast type ให้ตรงกับ express ของเรา
const swaggerUiModule = require('swagger-ui-express') as {
  serve: RequestHandler[];
  setup: (swaggerDoc: any, opts?: any) => RequestHandler;
};

// โหลด swagger-jsdoc ด้วย require เพื่อไม่ต้องรอ types
const swaggerJSDoc = require('swagger-jsdoc');

import { AppDataSource } from './utils/dataSource';
import routes from './routes';
import { authenticateToken } from './middlewares/auth';
import { errorHandler } from './middlewares/errorHandler';
import { PORT } from './configs/config';
import { swaggerOptions } from './utils/swagger';

async function startServer() {
  try {
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
      res.sendStatus(200);
    });

    // --- Dynamic Swagger setup ---
    const opts = {
      ...swaggerOptions,
      definition: {
        ...swaggerOptions.definition,
        servers: [
          {
            url: `http://localhost:${PORT}`,
            description: 'Local dev server',
          },
        ],
      },
    };
    const swaggerSpec = swaggerJSDoc(opts);

    // Serve Swagger UI at /api-docs
    const serveHandlers: RequestHandler[] = swaggerUiModule.serve;
    const setupHandler: RequestHandler = swaggerUiModule.setup(swaggerSpec, { explorer: true });
    app.use('/api-docs', ...serveHandlers, setupHandler);

    // 5) Protected routes
    app.use('/api', authenticateToken, routes);

    // 6) Global error handler
    app.use(errorHandler);

    // 7) Start server
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server is running on http://localhost:${PORT}`);
      console.log(`📖 Swagger UI available at http://localhost:${PORT}/api-docs`);
    });

    // 8) Graceful shutdown
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
    console.error('❌ Error during DataSource initialization:', err);
    process.exit(1);
  }
}

startServer();
