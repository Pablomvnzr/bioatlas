import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { sessionSchema, userSchema, type Session } from '@bioatlas/contracts';
import { apiRequest } from './api';
import { useQueryClient } from '@tanstack/react-query';
const Context = createContext<{
  session: Session | null;
  loading: boolean;
  save: (value: Session | null) => Promise<void>;
}>({ session: null, loading: true, save: async () => {} });
export const useSession = () => useContext(Context);
export function SessionProvider({ children }: React.PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null),
    [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  useEffect(() => {
    void (async () => {
      try {
        const raw = await SecureStore.getItemAsync('bioatlas-session');
        if (raw) {
          const stored = sessionSchema.parse(JSON.parse(raw));
          try {
            const user = userSchema.parse(await apiRequest('/v1/auth/me', stored.token));
            setSession({ ...stored, user });
          } catch (error) {
            if ((error as { status?: number }).status === 401)
              await SecureStore.deleteItemAsync('bioatlas-session');
            else setSession(stored);
          }
        }
      } catch {
        await SecureStore.deleteItemAsync('bioatlas-session').catch(() => {});
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  async function save(value: Session | null) {
    if (value) await SecureStore.setItemAsync('bioatlas-session', JSON.stringify(value));
    else await SecureStore.deleteItemAsync('bioatlas-session');
    queryClient.removeQueries({ queryKey: ['reports'] });
    queryClient.removeQueries({ queryKey: ['media'] });
    setSession(value);
  }
  return <Context.Provider value={{ session, loading, save }}>{children}</Context.Provider>;
}
