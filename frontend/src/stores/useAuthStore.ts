import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { IUser, ITenant } from '../types';

interface AuthState {
  token: string | null;
  user: IUser | null;
  tenant: ITenant | null;
  setAuth: (token: string, user: IUser, tenant?: ITenant) => void;
  setTenant: (tenant: ITenant) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      tenant: null,
      
      setAuth: (token: string, user: IUser, tenant?: ITenant) => {
        set({ token, user, tenant: tenant || null });
      },
      
      setTenant: (tenant: ITenant) => {
        set({ tenant });
      },
      
      logout: () => {
        set({ token: null, user: null, tenant: null });
      },
      
      isAuthenticated: () => {
        return !!get().token && !!get().user;
      },
    }),
    {
      name: 'skill-platform-auth',
      partialize: (state) => ({ token: state.token, user: state.user, tenant: state.tenant }),
    }
  )
);
