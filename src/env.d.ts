/// <reference types="vite/client" />

declare module '*.svg?url' {
  const src: string;
  export default src;
}

declare module '*.svg' {
  const src: string;
  export default src;
}
