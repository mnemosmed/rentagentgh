import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ error: Error | null }>;
  signup: (email: string, password: string, firstName?: string) => Promise<{ error: Error | null }>;
  signInWithOtp: (phone: string, firstName?: string, isSignUp?: boolean) => Promise<{ error: Error | null }>;
  verifyOtp: (phone: string, token: string, firstName?: string, isSignUp?: boolean) => Promise<{ error: Error | null; actionLink?: string }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (password: string) => Promise<{ error: Error | null }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);
        
        // Handle redirect after auth (e.g., from OTP magic link)
        if (event === 'SIGNED_IN' && session) {
          const returnPath = sessionStorage.getItem('authReturnPath');
          if (returnPath) {
            sessionStorage.removeItem('authReturnPath');
            // Use setTimeout to defer navigation after state updates
            setTimeout(() => {
              window.location.href = returnPath;
            }, 0);
          }
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  const signup = async (email: string, password: string, firstName?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          first_name: firstName || '',
          display_name: firstName || '',
        },
      },
    });
    return { error: error as Error | null };
  };

  const signInWithOtp = async (phone: string, firstName?: string, isSignUp?: boolean) => {
    try {
      // Store firstName and isSignUp in sessionStorage to use during verification
      if (firstName) {
        sessionStorage.setItem('otpFirstName', firstName);
      }
      sessionStorage.setItem('otpIsSignUp', isSignUp ? 'true' : 'false');
      
      const response = await supabase.functions.invoke('phone-auth', {
        body: { action: 'send', phone, firstName, isSignUp },
      });

      if (response.error) {
        return { error: new Error(response.error.message) };
      }

      if (!response.data?.success) {
        return { error: new Error(response.data?.error || 'Failed to send OTP') };
      }

      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const verifyOtp = async (phone: string, otp: string, firstName?: string, isSignUp?: boolean) => {
    try {
      // Get firstName and isSignUp from param or sessionStorage
      const storedFirstName = sessionStorage.getItem('otpFirstName');
      const storedIsSignUp = sessionStorage.getItem('otpIsSignUp') === 'true';
      const nameToUse = firstName || storedFirstName || '';
      const signUpMode = isSignUp !== undefined ? isSignUp : storedIsSignUp;
      
      const response = await supabase.functions.invoke('phone-auth', {
        body: { action: 'verify', phone, otp, firstName: nameToUse, isSignUp: signUpMode },
      });

      if (response.error) {
        return { error: new Error(response.error.message) };
      }

      if (!response.data?.success) {
        return { error: new Error(response.data?.error || 'Verification failed') };
      }

      // Preferred: exchange the returned magic-link token for a session without a full-page redirect.
      // phone-auth returns `token` as the hashed_token from generateLink.
      if (response.data?.token) {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: response.data.token,
          type: 'magiclink',
        });

        if (verifyError) {
          return { error: verifyError as Error };
        }
      }

      // Clear stored session data
      sessionStorage.removeItem('otpFirstName');
      sessionStorage.removeItem('otpIsSignUp');

      return { error: null, actionLink: response.data.actionLink };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const resetPassword = async (email: string) => {
    const redirectUrl = `${window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    return { error: error as Error | null };
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error as Error | null };
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      isAuthenticated: !!session,
      isLoading,
      login,
      signup,
      signInWithOtp,
      verifyOtp,
      resetPassword,
      updatePassword,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // During HMR, the context might temporarily be undefined
    // Return a loading state instead of throwing to prevent crashes
    return {
      user: null,
      session: null,
      isAuthenticated: false,
      isLoading: true,
      login: async (_e, _p) => ({ error: new Error('Auth not initialized') }),
      signup: async (_e, _p, _f) => ({ error: new Error('Auth not initialized') }),
      signInWithOtp: async (_p, _f, _s) => ({ error: new Error('Auth not initialized') }),
      verifyOtp: async (_p, _t, _f, _s) => ({ error: new Error('Auth not initialized') }),
      resetPassword: async (_e) => ({ error: new Error('Auth not initialized') }),
      updatePassword: async (_p) => ({ error: new Error('Auth not initialized') }),
      logout: async () => {},
    } as AuthContextType;
  }
  return context;
}
