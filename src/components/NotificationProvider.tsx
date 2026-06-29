import { useNotifications } from '@/hooks/useNotifications';

export function NotificationProvider() {
  // Initialize notifications - this hook handles everything
  useNotifications();
  
  return null;
}
