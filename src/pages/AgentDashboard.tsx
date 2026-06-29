import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAgentProfile, useAgentConversations, AgentConversation } from '@/hooks/useAgentConversations';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  MessageCircle, 
  Loader2, 
  User, 
  LogOut, 
  Settings,
  ChevronRight,
  Inbox
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import logo from '@/assets/logo.png';
import { AgentChatWindow } from '@/components/AgentChatWindow';
import { Link } from 'react-router-dom';
import { clearUserRole } from '@/hooks/useUserRole';

export default function AgentDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const { data: agentProfile, isLoading: profileLoading } = useAgentProfile();
  const { data: conversations = [], isLoading: conversationsLoading } = useAgentConversations();
  const [selectedConversation, setSelectedConversation] = useState<string | undefined>();

  // Handle conversation_id param
  const conversationIdParam = searchParams.get('id');
  useEffect(() => {
    if (conversationIdParam) {
      setSelectedConversation(conversationIdParam);
    }
  }, [conversationIdParam]);

  // Redirect if not authenticated or not an agent
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/agent-auth');
    }
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (!profileLoading && isAuthenticated && !agentProfile) {
      // User is logged in but doesn't have an agent profile
      navigate('/agent-auth');
    }
  }, [profileLoading, isAuthenticated, agentProfile, navigate]);

  const handleSelectConversation = (conversation: AgentConversation) => {
    setSelectedConversation(conversation.id);
    setSearchParams({ id: conversation.id });
  };

  const handleBackToList = () => {
    setSelectedConversation(undefined);
    setSearchParams({});
  };

  const handleLogout = async () => {
    clearUserRole();
    await logout();
    navigate('/agent-auth');
  };

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0);

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated || !agentProfile) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="RentAgentGhana" className="h-8 w-8" />
            <div className="hidden sm:block">
              <h1 className="font-semibold text-foreground">{agentProfile.display_name}</h1>
              <p className="text-xs text-muted-foreground">{agentProfile.primary_area}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Link to={`/agent/${agentProfile.id}`}>
              <Button variant="ghost" size="sm" className="gap-2">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Edit Profile</span>
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2 text-destructive hover:text-destructive">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 container py-4 md:py-6">
        <div className="h-[calc(100vh-120px)] bg-card border border-border rounded-2xl overflow-hidden flex">
          {/* Conversation list */}
          <div
            className={`w-full md:w-80 lg:w-96 border-r border-border flex-shrink-0 flex flex-col ${
              selectedConversation ? 'hidden md:flex' : 'flex'
            }`}
          >
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Inbox className="h-5 w-5 text-primary" />
                <h2 className="font-semibold text-lg text-foreground">Inbox</h2>
              </div>
              {totalUnread > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {totalUnread} new
                </Badge>
              )}
            </div>

            {conversationsLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 text-center px-4">
                <MessageCircle className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground font-medium">No messages yet</p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  When renters contact you, their messages will appear here
                </p>
              </div>
            ) : (
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                  {conversations.map((conversation) => (
                    <button
                      key={conversation.id}
                      onClick={() => handleSelectConversation(conversation)}
                      className={cn(
                        'w-full text-left p-3 rounded-lg transition-colors',
                        'hover:bg-muted/50',
                        selectedConversation === conversation.id ? 'bg-primary/10 border-l-4 border-primary' : ''
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="font-medium text-foreground truncate">
                              {conversation.renter.display_name || 'A renter'}
                            </h4>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {conversation.last_message && (
                                <span className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(conversation.last_message.created_at), {
                                    addSuffix: false,
                                  })}
                                </span>
                              )}
                              {conversation.unread_count > 0 && (
                                <Badge variant="destructive" className="h-5 min-w-[20px] flex items-center justify-center text-[10px] px-1.5">
                                  {conversation.unread_count}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {conversation.last_message?.content || 'Start a conversation...'}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 hidden sm:block" />
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Chat window */}
          <div
            className={`flex-1 flex flex-col ${
              selectedConversation ? 'block' : 'hidden md:flex'
            }`}
          >
            {selectedConversation ? (
              <AgentChatWindow
                conversationId={selectedConversation}
                onBack={handleBackToList}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                <MessageCircle className="h-12 w-12 mb-4 opacity-50" />
                <p className="font-medium">Select a conversation</p>
                <p className="text-sm mt-1">Choose a renter to start chatting</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
