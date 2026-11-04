import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { disableNativePushForCurrentUser } from '@/lib/nativePush';
import { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: Error | null; needsEmailConfirmation: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  resendConfirmationEmail: (email: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Network interruption must never leave login and recovery screens spinning forever.
const AUTH_REQUEST_TIMEOUT_MS = 15000;
const authFailure = (reason: unknown): Error =>
  reason instanceof Error ? reason : new Error('Authentication service unavailable. Please try again.');

async function withAuthTimeout<T>(operation: PromiseLike<T>): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(operation),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error('The sign-in service did not respond. Check your connection and try again.')),
          AUTH_REQUEST_TIMEOUT_MS
        );
      }),
    ]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let settled = false;

    const finishLoading = () => {
      if (!mounted || settled) return;
      settled = true;
      setLoading(false);
    };

    const watchdog = window.setTimeout(() => {
      console.warn('Auth initialization timed out; showing the app instead of blocking on Loading.');
      finishLoading();
    }, 8000);

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        finishLoading();
      })
      .catch((error) => {
        console.error('Failed to initialize auth session', error);
        finishLoading();
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      finishLoading();
    });

    return () => {
      mounted = false;
      window.clearTimeout(watchdog);
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, displayName: string) => {
    const currentParams = new URLSearchParams(window.location.search);
    const joinCode = currentParams.get('join');
    const redirect = new URL('/auth', window.location.origin);
    redirect.searchParams.set('verified', 'true');
    if (joinCode) redirect.searchParams.set('join', joinCode);
    const redirectUrl = redirect.toString();
    try {
      const { data, error } = await withAuthTimeout(supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName },
          emailRedirectTo: redirectUrl,
        },
      }));

      const needsEmailConfirmation = !error && data?.user && !data.user.confirmed_at;
      return { error: error as Error | null, needsEmailConfirmation: !!needsEmailConfirmation };
    } catch (reason) {
      return { error: authFailure(reason), needsEmailConfirmation: false };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await withAuthTimeout(supabase.auth.signInWithPassword({ email, password }));
      return { error: error as Error | null };
    } catch (reason) {
      return { error: authFailure(reason) };
    }
  };

  const signOut = async () => {
    try {
      await disableNativePushForCurrentUser();
    } catch (error) {
      console.warn('Could not disable native push before sign out', error);
    }
    await withAuthTimeout(supabase.auth.signOut());
  };

  const resetPassword = async (email: string) => {
    const redirectUrl = `${window.location.origin}/auth?mode=reset`;
    try {
      const { error } = await withAuthTimeout(supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      }));
      return { error: error as Error | null };
    } catch (reason) {
      return { error: authFailure(reason) };
    }
  };

  const updatePassword = async (newPassword: string) => {
    try {
      const { error } = await withAuthTimeout(supabase.auth.updateUser({
        password: newPassword,
      }));
      return { error: error as Error | null };
    } catch (reason) {
      return { error: authFailure(reason) };
    }
  };

  const resendConfirmationEmail = async (email: string) => {
    const currentParams = new URLSearchParams(window.location.search);
    const joinCode = currentParams.get('join');
    const redirect = new URL('/auth', window.location.origin);
    redirect.searchParams.set('verified', 'true');
    if (joinCode) redirect.searchParams.set('join', joinCode);
    const redirectUrl = redirect.toString();
    try {
      const { error } = await withAuthTimeout(supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: redirectUrl,
        },
      }));
      return { error: error as Error | null };
    } catch (reason) {
      return { error: authFailure(reason) };
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut, resetPassword, updatePassword, resendConfirmationEmail }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
