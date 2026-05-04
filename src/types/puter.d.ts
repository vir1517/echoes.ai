/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    puter: {
      ai: {
        chat: (
          prompt: string | { role: string; content: string }[],
          options?: { model?: string; stream?: boolean }
        ) => Promise<{ message?: { content?: string }; toString?: () => string } | string>;
      };
    };
  }
}

export {};
