import { create } from "zustand";

export type AuthStatus = "unknown" | "unauthenticated" | "authenticated";

type AuthState = {
  status: AuthStatus;
  domain: string | null;
  setStatus: (status: AuthStatus) => void;
  setDomain: (domain: string | null) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  status: "unknown",
  domain: null,
  setStatus: (status) => set({ status }),
  setDomain: (domain) => set({ domain }),
}));
