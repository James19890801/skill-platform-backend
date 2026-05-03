import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { IUser } from '../types';

interface AuthState {
  token: string | null;
  user: IUser | null;
  isGuest: boolean;
  setAuth: (token: string, user: IUser) => void;
  setGuest: () => void;
  logout: () => void;
  isAuthenticated: () => boolean;
  isAdmin: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isGuest: true,
      
      setAuth: (token: string, user: IUser) => {
        set({ token, user, isGuest: false });
      },
      
      setGuest: () => {
        set({ token: null, user: null, isGuest: true });
      },
      
      logout: () => {
        set({ token: null, user: null, isGuest: true });
      },
      
      isAuthenticated: () => {
        return !!get().token && !!get().user;
      },

      isAdmin: () => {
        return get().user?.isAdmin === true;
      },
    }),
    {
      name: 'skill-platform-auth',
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
);
