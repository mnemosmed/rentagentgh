import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Search, LogOut, User, MessageCircle, Briefcase, LogIn, Shield } from 'lucide-react';
import logo from '@/assets/logo.png';
import { useUserRole, clearUserRole } from '@/hooks/useUserRole';
import { AuthModal } from '@/components/AuthModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function Navbar() {
  const { isAuthenticated, user, logout } = useAuth();
  const location = useLocation();
  const { role, isAgent, isRenter } = useUserRole();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const ADMIN_PHONE = '+233542569695';
  const userPhone = user?.phone ? `+${user.phone}` : null;
  const isAdmin = userPhone === ADMIN_PHONE;

  // Fetch display name
  useEffect(() => {
    if (!user) {
      setDisplayName(null);
      return;
    }

    const metaName = user.user_metadata?.first_name || user.user_metadata?.display_name;
    if (metaName) {
      setDisplayName(metaName);
      return;
    }

    const fetchProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (data?.display_name) {
        setDisplayName(data.display_name);
      }
      // SECURITY: Never fall back to email or phone - keep null if no name
    };

    fetchProfile();
  }, [user]);

  // Handle logout with role clearing
  const handleLogout = async () => {
    clearUserRole();
    await logout();
  };
  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    const fetchUnreadCount = async () => {
      // Get all conversations for this user
      const { data: conversations } = await supabase
        .from('conversations')
        .select('id')
        .eq('user_id', user.id);

      if (!conversations?.length) {
        setUnreadCount(0);
        return;
      }

      const conversationIds = conversations.map(c => c.id);

      // Count unread messages not sent by the user
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .in('conversation_id', conversationIds)
        .eq('is_read', false)
        .neq('sender_id', user.id);

      setUnreadCount(count || 0);
    };

    fetchUnreadCount();

    // Subscribe to new messages
    const channel = supabase
      .channel('navbar-unread')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
        },
        () => {
          // Refetch count on any message change
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 min-w-0">
          <img src={logo} alt="RentAgentGhana" className="h-10 w-10 flex-shrink-0 object-contain" />
          <span className="font-display text-xl font-bold text-foreground truncate hidden sm:block">
            RentAgent<span className="text-primary">Ghana</span>
          </span>
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          {/* Show "For Agents" only when not logged in OR when user is an agent */}
          {(!isAuthenticated || isAgent) && (
            <Link to={isAgent ? '/agent-dashboard' : '/agent-auth'}>
              <Button 
                variant={location.pathname === '/agent-auth' || location.pathname === '/agent-dashboard' ? 'default' : 'ghost'} 
                size="sm"
                className="h-9 gap-1.5 text-xs sm:text-sm"
              >
                <Briefcase className="h-4 w-4" />
                <span className="hidden sm:inline">{isAgent ? 'Dashboard' : 'For Agents'}</span>
              </Button>
            </Link>
          )}

          {/* Search - visible to renters and unauthenticated users */}
          {(!isAuthenticated || isRenter) && (
            <Link to="/search">
              <Button 
                variant={location.pathname === '/search' ? 'default' : 'ghost'} 
                size="icon"
                className="h-9 w-9"
                aria-label="Search agents"
              >
                <Search className="h-4 w-4" />
              </Button>
            </Link>
          )}

          {/* Messages button - for authenticated non-agent users */}
          {isAuthenticated && !isAgent && (
            <Link to="/messages">
              <Button 
                variant={location.pathname === '/messages' ? 'default' : 'ghost'} 
                size="icon"
                className="h-9 w-9 relative"
                aria-label={unreadCount > 0 ? `Messages, ${unreadCount} unread` : 'Messages'}
              >
                <MessageCircle className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Button>
            </Link>
          )}

          {/* Sign In button - for unauthenticated users */}
          {!isAuthenticated && (
            <Button 
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-xs sm:text-sm"
              onClick={() => setShowAuthModal(true)}
            >
              <LogIn className="h-4 w-4" />
              <span className="hidden sm:inline">Sign In</span>
            </Button>
          )}

          {isAuthenticated && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant={location.pathname === '/profile' ? 'default' : 'ghost'} 
                  size="icon"
                  className="h-9 w-9"
                  aria-label="Account menu"
                >
                  <User className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5 text-sm font-medium text-foreground truncate">
                  {displayName || 'Account'}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link to="/admin/feedback" className="cursor-pointer">
                      <Shield className="mr-2 h-4 w-4" />
                      Admin
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
      />
    </nav>
  );
}
