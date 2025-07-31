// src/types/swagger-jsdoc.d.ts
/**
 * Custom module declaration for swagger-jsdoc
 * Avoid importing Options type to prevent circular or missing type errors.
 */
declare module 'swagger-jsdoc' {
  interface SwaggerDefinition {
    openapi: string;
    info: {
      title: string;
      version: string;
      description: string;
    };
    servers?: { url: string; description?: string }[];
    components?: Record<string, any>;
    security?: Array<Record<string, any>>;
  }

  interface SwaggerJSDocOptions {
    definition: SwaggerDefinition;
    apis: string[];
  }

  function swaggerJSDoc(opts: SwaggerJSDocOptions): any;
  export = swaggerJSDoc;
}
