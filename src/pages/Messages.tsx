import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { ConversationList } from '@/components/ConversationList';
import { ChatWindow } from '@/components/ChatWindow';
import { useAuth } from '@/contexts/AuthContext';
import { useGetOrCreateConversation, ConversationWithAgent } from '@/hooks/useMessages';
import { Button } from '@/components/ui/button';
import { MessageCircle, Loader2, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { SEO } from '@/components/SEO';

export default function Messages() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedConversation, setSelectedConversation] = useState<string | undefined>();
  const { isAgent } = useUserRole();
  const getOrCreateConversation = useGetOrCreateConversation();

  // Redirect agents to their dashboard
  useEffect(() => {
    if (isAgent) {
      navigate('/agent-dashboard', { replace: true });
    }
  }, [isAgent, navigate]);

  // Handle agent_id param (when starting a new conversation from agent page)
  const agentId = searchParams.get('agent');

  useEffect(() => {
    if (agentId && isAuthenticated) {
      getOrCreateConversation.mutate(agentId, {
        onSuccess: (conversation) => {
          setSelectedConversation(conversation.id);
          // Remove agent param from URL
          setSearchParams({});
        },
      });
    }
  }, [agentId, isAuthenticated]);

  // Handle conversation_id param
  const conversationIdParam = searchParams.get('id');
  useEffect(() => {
    if (conversationIdParam) {
      setSelectedConversation(conversationIdParam);
    }
  }, [conversationIdParam]);

  const handleSelectConversation = (conversation: ConversationWithAgent) => {
    setSelectedConversation(conversation.id);
    setSearchParams({ id: conversation.id });
  };

  const handleBackToList = () => {
    setSelectedConversation(undefined);
    setSearchParams({});
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container py-16 text-center">
          <MessageCircle className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Sign in to view messages</h1>
          <p className="text-muted-foreground mb-6">
            You need to be logged in to send and receive messages from agents.
          </p>
          <Link to="/search">
            <Button>
              <Search className="h-4 w-4 mr-2" />
              Find Agents
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (getOrCreateConversation.isPending) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Starting conversation...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <SEO
        title="Messages — RentAgentGhana"
        description="Your conversations with rental agents in Accra."
        path="/messages"
        noindex
      />
      <Navbar />
      <h1 className="sr-only">Messages</h1>
      
      <div className="flex-1 container py-4 md:py-6 min-h-0">
        <div className="h-full bg-card border border-border rounded-2xl overflow-hidden flex">
          {/* Conversation list - hidden on mobile when a conversation is selected */}
          <div
            className={`w-full md:w-80 lg:w-96 border-r border-border flex-shrink-0 flex flex-col ${
              selectedConversation ? 'hidden md:flex' : 'flex'
            }`}
          >
            <div className="p-4 border-b border-border flex items-center justify-between flex-shrink-0">
              <h2 className="font-semibold text-lg text-foreground">Messages</h2>
              <Link to="/search">
                <Button variant="outline" size="sm">
                  <Search className="h-4 w-4 mr-2" />
                  Back to Search
                </Button>
              </Link>
            </div>
            <div className="flex-1 min-h-0 overflow-auto">
              <ConversationList
                selectedId={selectedConversation}
                onSelect={handleSelectConversation}
              />
            </div>
          </div>

          {/* Chat window */}
          <div
            className={`flex-1 flex flex-col min-h-0 ${
              selectedConversation ? 'flex' : 'hidden md:flex'
            }`}
          >
            {selectedConversation ? (
              <ChatWindow
                conversationId={selectedConversation}
                onBack={handleBackToList}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                <MessageCircle className="h-12 w-12 mb-4 opacity-50" />
                <p>Select a conversation to start chatting</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
