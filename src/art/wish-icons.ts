const icon = (paths: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
export const wishIcons = {
  send: icon('<path d="m20.4 3.6-6.1 16.1a1 1 0 0 1-1.9-.1l-2.2-5.8-5.8-2.2a1 1 0 0 1-.1-1.9L20.4 3.6Z"/><path d="m10.2 13.8 5.4-5.4"/>'),
  mail: icon('<rect x="3" y="6" width="18" height="15" rx="4"/><path d="m3 9 7 5a3.5 3.5 0 0 0 4 0l7-5"/><path d="M12 7s-4-2-4-4a2 2 0 0 1 4-1 2 2 0 0 1 4 1c0 2-4 4-4 4Z" fill="currentColor" stroke="none"/>'),
  edit: icon('<path d="m14 5 5 5M4 20l5-1L20 8a3.5 3.5 0 0 0-5-5L4 14l-1 7Z"/>'),
  close: icon('<path d="m7 7 10 10M7 17 17 7"/>'),
};
