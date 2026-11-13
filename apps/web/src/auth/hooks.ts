import { useContext } from 'react';
import { AuthContext } from './AuthContext';

/**
 * Hook unificado para acceder al estado de autenticación desde cualquier componente.
 */
export function useAuth() {
  const { session, loading, profile } = useContext(AuthContext);
  return {
    profile,
    csrfToken: session?.csrfToken ?? null,
    authenticated: !loading && session !== null,
    loading,
  };
}
