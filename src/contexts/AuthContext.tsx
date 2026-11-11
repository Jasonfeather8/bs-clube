import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../integrations/supabase/client';

const ACCESS_BLOCKED_MESSAGE = 'Sua conta está bloqueada. Entre em contato com o suporte.';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  role: 'client' | 'admin';
  isLoading: boolean;
  signOut: () => Promise<void>;
  accessNotice: string | null;
  clearAccessNotice: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accessNotice, setAccessNotice] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (isMounted) {
        setSession(data.session);
        setIsLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (isMounted) {
        setSession(nextSession);
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const currentUser = session?.user;
    if (!currentUser) return;
    let isCancelled = false;

    const verifyAccess = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('is_active')
        .eq('id', currentUser.id)
        .maybeSingle();
      if (isCancelled || error) return;
      if (data && data.is_active === false) {
        setAccessNotice(ACCESS_BLOCKED_MESSAGE);
        await supabase.auth.signOut();
      }
    };

    void verifyAccess();
    return () => {
      isCancelled = true;
    };
  }, [session]);

  const clearAccessNotice = useCallback(() => setAccessNotice(null), []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    role: session?.user.app_metadata?.role === 'admin' ? 'admin' : 'client',
    isLoading,
    signOut: async () => {
      await supabase.auth.signOut();
    },
    accessNotice,
    clearAccessNotice,
  }), [session, isLoading, accessNotice, clearAccessNotice]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  }
  return context;
}
