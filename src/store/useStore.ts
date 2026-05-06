import { create } from 'zustand';

type Theme = 'dark' | 'light';

interface StoreState {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;

  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

const readTheme = (): Theme => {
  try {
    const v = localStorage.getItem('vt-theme');
    return v === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
};

const writeTheme = (theme: Theme) => {
  try {
    localStorage.setItem('vt-theme', theme);
  } catch {
    /* no-op */
  }
};

export const useStore = create<StoreState>((set) => ({
  theme: readTheme(),
  toggleTheme: () =>
    set((state) => {
      const next: Theme = state.theme === 'dark' ? 'light' : 'dark';
      writeTheme(next);
      return { theme: next };
    }),
  setTheme: (theme) => {
    writeTheme(theme);
    set({ theme });
  },

  sidebarOpen: false,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));
