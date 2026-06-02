// import { DataSource } from 'typeorm';

// const AppDataSource = new DataSource({
//   type: 'postgres',
//   host: process.env.DB_HOST || 'localhost',
//   port: parseInt(process.env.DB_PORT || '5432'),
//   username: process.env.DB_USER || 'postgres',
//   password: process.env.DB_PASSWORD || 'password',
//   database: process.env.DB_NAME || 'barbearia_db',
//   synchronize: process.env.NODE_ENV !== 'production',
//   logging: process.env.NODE_ENV === 'development',
//   entities: ['src/models/**/*.ts'],
//   migrations: ['src/migrations/**/*.ts'],
// });

// export default AppDataSource;


import { DataSource } from "typeorm";

const isProd = process.env.NODE_ENV === "production";

const AppDataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL, // <-- usa a URL do Render
  synchronize: false,            // <-- em produção, deixa SEMPRE false
  logging: !isProd,

  // Em produção, TypeORM carrega os .js compilados
  entities: [isProd ? "dist/models/**/*.js" : "src/models/**/*.ts"],
  migrations: [isProd ? "dist/migrations/**/*.js" : "src/migrations/**/*.ts"],
});

export default AppDataSource;
