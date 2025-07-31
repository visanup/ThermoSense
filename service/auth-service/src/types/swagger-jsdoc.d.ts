// src/types/swagger-jsdoc.d.ts
declare module 'swagger-jsdoc' {
  import { Options } from 'swagger-jsdoc';
  function swaggerJSDoc(opts: Options): any;
  export = swaggerJSDoc;
}