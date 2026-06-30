import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

interface ImpersonatedProfile {
  id: string;
  nome: string;
  email: string;
  cargo: string | null;
  saldo_ferias: number;
}

interface ImpersonationContextType {
  impersonatedUserId: string | null;
  impersonatedProfile: ImpersonatedProfile | null;
  isImpersonating: boolean;
  startImpersonation: (userId: string) => Promise<void>;
  stopImpersonation: () => void;
}

const STORAGE_KEY = 'impersonatedUserId';

const ImpersonationContext = createContext<ImpersonationContextType | undefined>(undefined);

export function ImpersonationProvider({ children }: { children: React.ReactNode }) {
  const { isAdmin, user } = useAuth();
  const [impersonatedUserId, setImpersonatedUserId] = useState<string | null>(null);
  const [impersonatedProfile, setImpersonatedProfile] = useState<ImpersonatedProfile | null>(null);

  // Restore from sessionStorage on mount (admin only)
  useEffect(() => {
    if (!isAdmin || !user) {
      setImpersonatedUserId(null);
      setImpersonatedProfile(null);
      return;
    }
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored && stored !== user.id) {
      loadProfile(stored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, user?.id]);

  const loadProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('id, nome, email, cargo, saldo_ferias')
      .eq('id', userId)
      .maybeSingle();
    if (data) {
      setImpersonatedUserId(userId);
      setImpersonatedProfile(data as ImpersonatedProfile);
      sessionStorage.setItem(STORAGE_KEY, userId);
    }
  };

  const startImpersonation = useCallback(async (userId: string) => {
    if (!isAdmin) return;
    if (user && userId === user.id) return;
    await loadProfile(userId);
  }, [isAdmin, user]);

  const stopImpersonation = useCallback(() => {
    setImpersonatedUserId(null);
    setImpersonatedProfile(null);
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <ImpersonationContext.Provider
      value={{
        impersonatedUserId,
        impersonatedProfile,
        isImpersonating: !!impersonatedUserId,
        startImpersonation,
        stopImpersonation,
      }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonation() {
  const ctx = useContext(ImpersonationContext);
  if (!ctx) throw new Error('useImpersonation must be used within ImpersonationProvider');
  return ctx;
}

/**
 * Returns the effective user id and profile for data queries.
 * If admin is impersonating, returns impersonated values; otherwise auth user.
 */
export function useEffectiveUser() {
  const { user, profile } = useAuth();
  const { impersonatedUserId, impersonatedProfile, isImpersonating } = useImpersonation();
  return {
    effectiveUserId: impersonatedUserId ?? user?.id ?? null,
    effectiveProfile: impersonatedProfile ?? profile ?? null,
    isImpersonating,
    realUserId: user?.id ?? null,
  };
}
