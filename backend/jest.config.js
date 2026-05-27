/**
 * Jest config com suporte a ES Modules (o backend usa "type": "module").
 * Execute com: node --experimental-vm-modules node_modules/jest/bin/jest.js
 */
export default {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.js"],
  testTimeout: 15000,
};
