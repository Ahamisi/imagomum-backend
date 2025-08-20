require('dotenv').config();

module.exports = {
  development: {
    username: process.env.DB_USERNAME || 'imagomum_user',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'imagomum_dev',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: console.log,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    define: {
      timestamps: true,
      underscored: true,
      underscoredAll: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      deletedAt: 'deleted_at',
      paranoid: true
    }
  },
  test: {
    username: process.env.DB_USERNAME || 'imagomum_test',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME_TEST || 'imagomum_test',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    define: {
      timestamps: true,
      underscored: true,
      underscoredAll: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      deletedAt: 'deleted_at',
      paranoid: true
    }
  },
  production: {
    use_env_variable: 'DATABASE_URL',
    dialect: process.env.DB_DIALECT || 'mssql',
    logging: false,
    pool: {
      max: 20,
      min: 5,
      acquire: 60000,
      idle: 10000
    },
    define: {
      timestamps: true,
      underscored: true,
      underscoredAll: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      deletedAt: 'deleted_at',
      paranoid: true
    },
    dialectOptions: {
      options: {
        encrypt: true,
        trustServerCertificate: false,
        enableArithAbort: true
      }
    }
  }
}; 