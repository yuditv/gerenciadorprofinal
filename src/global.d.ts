// Global type definitions
// Provides NodeJS.Timeout for timer refs used across the codebase
// since we don't include @types/node in the browser tsconfig.
declare namespace NodeJS {
  type Timeout = ReturnType<typeof setTimeout>;
}
