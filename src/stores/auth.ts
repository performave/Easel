import { create } from "zustand";

export type AuthStatus = "unknown" | "unauthenticated" | "authenticated";

type AuthState = {
  status: AuthStatus;
  domain: string | null;
  setAuthenticated: (domain: string) => void;
  setUnauthenticated: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  status: "unknown",
  domain: null,
  setAuthenticated: (domain) => set({ status: "authenticated", domain }),
  setUnauthenticated: () => set({ status: "unauthenticated", domain: null }),
}));
