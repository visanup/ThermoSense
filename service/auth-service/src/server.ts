// services/auth-service/src/server.ts
import 'reflect-metadata';
import express, { Request, Response, RequestHandler } from 'express';
import cors from 'cors';
// โหลด swagger-ui-express ด้วย require แล้ว cast type ให้ตรงกับ express ของเรา
const swaggerUiModule = require('swagger-ui-express') as {
  serve: RequestHandler[];
  setup: (swaggerDoc: any, opts?: any) => RequestHandler;
};

// โหลด swagger-jsdoc ด้วย require เพื่อไม่ต้องรอ types
const swaggerJSDoc = require('swagger-jsdoc');
import { DataSource } from 'typeorm';
import { createAuthRouter } from './routes/authRoutes';
import { User } from './models/user.model';
import { RefreshToken } from './models/refreshToken.model';
import { DATABASE_URL, PORT } from './configs/config';
import { swaggerOptions } from './utils/swagger';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: DATABASE_URL,
  schema: 'auth',
  entities: [User, RefreshToken],
  synchronize: true,
});

AppDataSource.initialize()
  .then(() => {
    const app = express();

    // --- Middleware ---
    app.use(cors());
    app.use(express.json());

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

    // Redirect root → Swagger UI
    app.get('/', (_req: Request, res: Response) => {
      res.redirect('/api-docs');
    });

    // Serve Swagger UI at /api-docs
    // แยก serve ออกมาเป็น array ของ RequestHandler แล้ว spread เข้าไป
    const serveHandlers = swaggerUiModule.serve;
    const setupHandler = swaggerUiModule.setup(swaggerSpec, { explorer: true });
    app.use('/api-docs', ...serveHandlers, setupHandler);

    // --- API Routes ---
    app.use('/api/auth', createAuthRouter(AppDataSource));

    // --- Start Server ---
    app.listen(PORT, () => {
      console.log(`🛡️  Auth service running on port ${PORT}`);
      console.log(`📖  Swagger UI: http://localhost:${PORT}/api-docs`);
    });
  })
  .catch((error) => {
    console.error('❌ Error initializing data source', error);
    process.exit(1);
  });
