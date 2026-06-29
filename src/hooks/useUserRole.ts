import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export type UserRole = 'agent' | 'renter' | null;

interface UserSession {
  phone: string;
  role: 'agent' | 'renter';
}

const SESSION_STORAGE_KEY = 'rag_user_session';

// Get user's phone from auth metadata
function getUserPhone(user: { phone?: string; user_metadata?: { phone?: string } } | null): string | null {
  if (!user) return null;
  return user.phone || user.user_metadata?.phone || null;
}

// Normalize phone number for comparison (strip formatting, ensure consistent format)
function normalizePhone(phone: string): string {
  // Remove all non-digits except leading +
  const cleaned = phone.replace(/[^\d+]/g, '');
  
  // If starts with 0, assume Ghana local format, convert to +233
  if (cleaned.startsWith('0')) {
    return '+233' + cleaned.slice(1);
  }
  
  // If starts with 233 without +, add +
  if (cleaned.startsWith('233') && !cleaned.startsWith('+')) {
    return '+' + cleaned;
  }
  
  // If just 9 digits (no prefix), assume Ghana
  if (/^\d{9}$/.test(cleaned)) {
    return '+233' + cleaned;
  }
  
  return cleaned.startsWith('+') ? cleaned : '+' + cleaned;
}

export function useUserRole() {
  const { user, isAuthenticated } = useAuth();
  const [role, setRoleState] = useState<UserRole>(() => {
    if (typeof window === 'undefined') return null;
    
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!stored) return null;
    
    try {
      const session: UserSession = JSON.parse(stored);
      return session.role;
    } catch {
      return null;
    }
  });

  // Listen for storage changes (when role is set from AuthModal)
  useEffect(() => {
    const handleStorageChange = () => {
      const stored = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!stored) {
        setRoleState(null);
        return;
      }
      try {
        const session: UserSession = JSON.parse(stored);
        setRoleState(session.role);
      } catch {
        setRoleState(null);
      }
    };

    // Listen for both storage events and custom events
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('userRoleChanged', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('userRoleChanged', handleStorageChange);
    };
  }, []);

  // Verify session matches current user's phone
  useEffect(() => {
    if (!isAuthenticated || !user) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      setRoleState(null);
      return;
    }

    const userPhone = getUserPhone(user);
    
    // If user has no phone in metadata, just use the stored role
    // This handles the case right after OTP verification
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!stored) {
      setRoleState(null);
      return;
    }

    try {
      const session: UserSession = JSON.parse(stored);
      
      // If user has phone, verify it matches
      if (userPhone) {
        const normalizedUserPhone = normalizePhone(userPhone);
        const normalizedSessionPhone = normalizePhone(session.phone);
        
        if (normalizedUserPhone === normalizedSessionPhone) {
          setRoleState(session.role);
        } else {
          // Phone mismatch - clear stale session
          localStorage.removeItem(SESSION_STORAGE_KEY);
          setRoleState(null);
        }
      } else {
        // No phone in user metadata yet, trust the stored session
        setRoleState(session.role);
      }
    } catch {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      setRoleState(null);
    }
  }, [isAuthenticated, user]);

  // Set role with phone number
  const setRole = useCallback((newRole: UserRole, phone?: string) => {
    if (newRole && phone) {
      const session: UserSession = {
        phone: normalizePhone(phone),
        role: newRole,
      };
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      setRoleState(newRole);
    } else {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      setRoleState(null);
    }
  }, []);

  // Clear role (on logout)
  const clearRole = useCallback(() => {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    setRoleState(null);
  }, []);

  return {
    role,
    setRole,
    clearRole,
    isAgent: role === 'agent',
    isRenter: role === 'renter',
  };
}

// Standalone functions for use in auth flows
export function setUserRole(role: UserRole, phone?: string) {
  if (role && phone) {
    const session: UserSession = {
      phone: normalizePhoneStandalone(phone),
      role,
    };
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    // Dispatch custom event to notify useUserRole hooks
    window.dispatchEvent(new Event('userRoleChanged'));
  } else {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    window.dispatchEvent(new Event('userRoleChanged'));
  }
}

function normalizePhoneStandalone(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('0')) return '+233' + cleaned.slice(1);
  if (cleaned.startsWith('233') && !cleaned.startsWith('+')) return '+' + cleaned;
  if (/^\d{9}$/.test(cleaned)) return '+233' + cleaned;
  return cleaned.startsWith('+') ? cleaned : '+' + cleaned;
}

export function getUserRole(): UserRole {
  if (typeof window === 'undefined') return null;
  
  const stored = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!stored) return null;
  
  try {
    const session: UserSession = JSON.parse(stored);
    return session.role;
  } catch {
    return null;
  }
}

export function clearUserRole() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}
