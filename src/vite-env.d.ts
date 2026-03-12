/// <reference types="vite/client" />

// Provide NodeJS.Timeout type for timer refs used across the codebase
declare namespace NodeJS {
  type Timeout = ReturnType<typeof setTimeout>;
}
