// services/auth-service/src/utils/swagger.ts
import { PORT } from '../configs/config';
/**
 * Configuration object for swagger-jsdoc.
 * We define our own minimal type here to avoid issues importing
 * the `Options` type from 'swagger-jsdoc'.
 */
interface SwaggerJsdocOptions {
  definition: {
    openapi: string;
    info: {
      title: string;
      version: string;
      description: string;
    };
    servers: { url: string; description?: string }[];
    components?: Record<string, any>;
    security?: Array<Record<string, any>>;
  };
  apis: string[];
}

export const swaggerOptions: SwaggerJsdocOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Auth Service API',
      version: '1.0.0',
      description: 'Authentication & Authorization endpoints',
    },
    servers: [
      {
        // will be overridden dynamically in server.ts to use the real PORT
        url: `http://localhost:${PORT}`,
        description: 'Local dev server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT Authorization header using the Bearer scheme. Enter only the token, without Bearer prefix.'
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: [
    // adjust paths to match your project structure
    './src/routes/**/*.ts',
    './src/models/**/*.ts',
  ],
};

