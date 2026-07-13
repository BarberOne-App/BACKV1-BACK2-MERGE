import { DataSource } from "typeorm";

const isProd = process.env.NODE_ENV === "production";

const AppDataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL, // <-- usa a URL do Render
  synchronize: false,  
  logging: !isProd,
  entities: [isProd ? "dist/models/**/*.js" : "src/models/**/*.ts"],
  migrations: [isProd ? "dist/migrations/**/*.js" : "src/migrations/**/*.ts"],
});

export default AppDataSource;
