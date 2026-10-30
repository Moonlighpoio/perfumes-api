export default {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.js'],

  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js'
  ],

  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'json-summary'],

  // Política de calidad: el pipeline falla si la cobertura baja de estos umbrales.
  coverageThreshold: {
    global: {
      statements: 90,
      branches: 90,
      functions: 90,
      lines: 90
    }
  }
};
