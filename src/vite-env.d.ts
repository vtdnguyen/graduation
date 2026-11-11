/// <reference types="vite/client" />

declare module 'virtual:photos' {
  const photos: Array<{ thumb: string; full: string; caption: string; ratio: number }>;
  export default photos;
}
