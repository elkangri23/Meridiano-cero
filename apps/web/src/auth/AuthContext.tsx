import { createContext, useContext, useEffect, useState } from 'react';
import { archiveApi } from '../archive/client.js';

/**
 * Perfil con rol (extendido para soportar admin/superadmin).
 * SessionDto ya admite 'player' | 'admin' | 'superadmin' en el contrato.
 */
interface ProfileWithRole {
  id: string;
  displayName: string;
  emailVerified: boolean;
  role?: string;
}

/**
 * Hook para acceder al estado de autenticación desde cualquier componente.
 */
export function useAuthContext() {
  return useContext(AuthContext);
}

interface AuthContextValue {
  session: {
    csrfToken: string;
    profile: { id: string; displayName: string; emailVerified: boolean; role: string } | null;
  } | null;
  loading: boolean;
  profile: { id: string; displayName: string; emailVerified: boolean; role: string } | null;
}

export const AuthContext = createContext<AuthContextValue>({
  session: null,
  loading: true,
  profile: null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthContextValue['session']>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    archiveApi.me(controller.signal)
      .then((data) => {
        // SessionDto ya tipa el rol como 'player' | 'admin' | 'superadmin';
        // el cast solo cubre que el perfil pueda venir sin rol (defensa).
        const rawSession = data as { profile: ProfileWithRole | null; csrfToken: string } | null;
        const profile = rawSession?.profile ? {
          id: rawSession.profile.id,
          displayName: rawSession.profile.displayName,
          emailVerified: rawSession.profile.emailVerified ?? false,
          role: rawSession.profile.role ?? 'player',
        } : null;
        setSession({
          csrfToken: rawSession?.csrfToken ?? '',
          profile,
        });
        setLoading(false);
      })
      .catch(() => {
        setSession(null);
        setLoading(false);
      });
    return () => controller.abort();
  }, []);

  return (
    <AuthContext.Provider value={{
      session,
      loading,
      profile: session?.profile ?? null,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
