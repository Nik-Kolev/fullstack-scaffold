declare namespace NodeJS {
  interface ProcessEnv {
    PORT: string;
    ORIGIN: string;
    DATABASE_URL: string;
    JWT_ACCESS_SECRET: string;
    JWT_REFRESH_SECRET: string;
    NODE_ENV: string;
  }
}
