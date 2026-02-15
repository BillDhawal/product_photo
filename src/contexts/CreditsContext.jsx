import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useUser } from '@clerk/clerk-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const CreditsContext = createContext(null);

export function CreditsProvider({ children }) {
  const { user } = useUser();
  const [credits, setCredits] = useState(null);
  const [unlimited, setUnlimited] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const fetchCredits = useCallback(async () => {
    if (!user?.id && !user?.primaryEmailAddress?.emailAddress) {
      setLoading(false);
      return;
    }
    try {
      const params = new URLSearchParams();
      if (user?.id) params.set('user_id', user.id);
      if (user?.primaryEmailAddress?.emailAddress) params.set('user_email', user.primaryEmailAddress.emailAddress);
      const res = await fetch(`${API_BASE_URL}/credits?${params}`);
      const data = await res.json();
      setCredits(data?.credits ?? 0);
      setUnlimited(data?.unlimited ?? false);
    } catch {
      setCredits(0);
      setUnlimited(false);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.primaryEmailAddress?.emailAddress]);

  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  useEffect(() => {
    const onRefresh = () => fetchCredits();
    window.addEventListener('credits-refresh', onRefresh);
    return () => window.removeEventListener('credits-refresh', onRefresh);
  }, [fetchCredits]);

  const value = {
    credits,
    unlimited,
    loading,
    fetchCredits,
    showUpgradeModal,
    setShowUpgradeModal,
    creditsLow: credits !== null && !unlimited && credits <= 3,
    canGenerate: unlimited || (credits !== null && credits >= 4),
  };

  return (
    <CreditsContext.Provider value={value}>
      {children}
    </CreditsContext.Provider>
  );
}

export function useCredits() {
  const ctx = useContext(CreditsContext);
  if (!ctx) throw new Error('useCredits must be used within CreditsProvider');
  return ctx;
}
