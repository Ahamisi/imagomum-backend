// Jest global setup (referenced by jest.config.js setupFilesAfterEnv).
// Keep unit tests isolated from real services: default to the test env and a
// dummy JWT secret. DB-backed suites should connect explicitly within the suite.
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';

jest.setTimeout(30000);
