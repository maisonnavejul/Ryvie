// global.d.ts
export {};

declare global {
  interface Window {
    electron: {
      shell: {
        openExternal: (url: string) => void;
      };
    };
  }
}
