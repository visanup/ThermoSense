// services/auth-service/src/utils/swagger.ts
// services/data-service/src/utils/swagger.ts
import { resolve } from 'path';
import swaggerJSDoc from 'swagger-jsdoc';
import { PORT } from '../configs/config';

const isProd = process.env.NODE_ENV === 'production';

function getApiGlobs(): string[] {
  if (isProd) {
    return [resolve(__dirname, '../../dist/routes/**/*.js')];
  } else {
    return [resolve(__dirname, '../../src/routes/**/*.ts')];
  }
}

export function getSwaggerSpec(overrideServerUrl?: string) {
  const servers = [
    {
      url: overrideServerUrl || process.env.BASE_URL || `http://localhost:${PORT}`,
      description: 'API server',
    },
  ];

  const options = {
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'Data Service API',
        version: '1.0.0',
        description: 'Data service endpoints',
      },
      servers,
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description:
              'JWT Authorization header using the Bearer scheme. Provide only the token, without the "Bearer" prefix.',
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
    apis: getApiGlobs(),
  };

  // swaggerJSDoc returns a plain object; cast so we can safely inspect .paths
  const spec = swaggerJSDoc(options as any) as { paths?: Record<string, unknown> };

  console.log('[Swagger] using globs:', getApiGlobs());
  console.log('[Swagger] generated path keys:', spec.paths ? Object.keys(spec.paths) : []);

  return spec;
}




