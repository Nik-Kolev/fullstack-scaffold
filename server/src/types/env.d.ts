declare namespace NodeJS {
  interface ProcessEnv {
    PORT: string;
    ORIGIN: string;
    DATABASE_URL: string;
    JWT_SECRET: string;
  }
}
