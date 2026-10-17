import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, tokenStore } from '../lib/api';

const AuthCtx = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam AuthProvider');
  return ctx;
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => tokenStore.get());
  const [me, setMe] = useState(null); // { id, email, name, role } dari BACKEND
  const [loading, setLoading] = useState(() => !!tokenStore.get());

  const clear = useCallback(() => {
    tokenStore.clear();
    setToken(null);
    setMe(null);
    setLoading(false);
  }, []);

  // pulihkan sesi saat halaman dibuka
  useEffect(() => {
    if (!token || me) return undefined;
    let active = true;
    api('/auth/me')
      .then((u) => active && setMe(u))
      .catch((e) => { if (active && e.status === 401) clear(); })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [token, me, clear]);

  // sesi kedaluwarsa dari panggilan API mana pun
  useEffect(() => {
    window.addEventListener('ak-unauthorized', clear);
    return () => window.removeEventListener('ak-unauthorized', clear);
  }, [clear]);

  const accept = useCallback((res) => {
    tokenStore.set(res.token);
    setToken(res.token);
    setMe(res.user);
    setLoading(false);
  }, []);

  const signIn = useCallback(async (email, password) => accept(await api('/auth/login', { method: 'POST', body: { email, password } })), [accept]);
  const signUp = useCallback(async (email, password, name) => accept(await api('/auth/register', { method: 'POST', body: { email, password, name } })), [accept]);

  const value = useMemo(
    () => ({ session: token, me, loading, isAdmin: me?.role === 'admin', signIn, signUp, signOut: clear }),
    [token, me, loading, signIn, signUp, clear],
  );
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
