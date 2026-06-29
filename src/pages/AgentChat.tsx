import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { TypingIndicator } from '@/components/TypingIndicator';
import { OnlineStatusIndicator } from '@/components/OnlineStatusIndicator';
import { DateSeparator, isDifferentDay } from '@/components/DateSeparator';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Send, Loader2, User, Image, Video, X, Upload, Lock, Check, CheckCheck, Phone } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import logo from '@/assets/logo.png';

// Get signed URL for private media
async function getSignedMediaUrl(mediaUrl: string): Promise<string> {
  if (!mediaUrl) return mediaUrl;
  if (mediaUrl.includes('token=')) return mediaUrl;
  
  const urlPattern = /\/storage\/v1\/object\/public\/chat-media\/(.+)/;
  const match = mediaUrl.match(urlPattern);
  
  if (!match) return mediaUrl;
  
  const filePath = match[1];
  const { data, error } = await supabase.storage
    .from('chat-media')
    .createSignedUrl(filePath, 3600);
  
  if (error || !data) return mediaUrl;
  return data.signedUrl;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
  media_url?: string;
  media_type?: string;
}

interface ConversationData {
  conversation: {
    id: string;
    user_id: string;
  };
  agent: {
    id: string;
    display_name: string;
    primary_area: string;
    claimed_by?: string | null;
  };
  messages: Message[];
  user: {
    display_name: string | null;
    email: string | null;
  };
}

export default function AgentChat() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { toast } = useToast();
  const { user } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ConversationData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedFilePreviews, setSelectedFilePreviews] = useState<
    Array<{ key: string; file: File; url: string }>
  >([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);
  const [isSendingContact, setIsSendingContact] = useState(false);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if the current user is the signed-in agent
  const isSignedInAgent = user && data?.agent?.claimed_by === user.id;

  // Typing indicator - use agent ID or claimed_by for presence
  const agentUserId = data?.agent?.claimed_by || data?.agent?.id || 'agent';
  const { isOtherTyping, typingUserName, setTyping } = useTypingIndicator(
    data?.conversation?.id || '',
    agentUserId,
    data?.agent?.display_name || 'Agent'
  );

  // Online status
  const { isOtherPartyOnline } = useOnlineStatus(data?.conversation?.id || '', agentUserId);

  // Fetch conversation data
  useEffect(() => {
    if (!token) {
      setError('Invalid access link');
      setIsLoading(false);
      return;
    }

    const fetchConversation = async () => {
      try {
        const { data: result, error: fetchError } = await supabase.functions.invoke('agent-reply', {
          body: { token },
        });

        if (fetchError || !result.success) {
          throw new Error(result?.error || fetchError?.message || 'Failed to load conversation');
        }

        setData(result);
        setMessages(result.messages || []);
      } catch (err) {
        console.error('Error fetching conversation:', err);
        setError(err instanceof Error ? err.message : 'Failed to load conversation');
      } finally {
        setIsLoading(false);
      }
    };

    fetchConversation();
  }, [token]);

  // Poll for new messages since agents access this page without authentication
  // Real-time subscriptions require auth, so we poll instead
  useEffect(() => {
    if (!token || !data?.conversation?.id) return;

    const pollMessages = async () => {
      try {
        const { data: result, error: fetchError } = await supabase.functions.invoke('agent-reply', {
          body: { token },
        });

        if (!fetchError && result?.success && result.messages) {
          setMessages((prev) => {
            const newMessages = result.messages as Message[];
            // Merge new messages, avoiding duplicates
            const existingIds = new Set(prev.map(m => m.id));
            const uniqueNew = newMessages.filter(m => !existingIds.has(m.id));
            if (uniqueNew.length > 0) {
              return [...prev, ...uniqueNew].sort((a, b) => 
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              );
            }
            return prev;
          });
        }
      } catch (err) {
        console.error('Error polling messages:', err);
      }
    };

    // Poll every 3 seconds
    const interval = setInterval(pollMessages, 3000);

    return () => {
      clearInterval(interval);
    };
  }, [token, data?.conversation?.id]);

  // Scroll to bottom when messages change or typing indicator appears
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOtherTyping]);

  // Create local preview URLs for selected media (for the in-app "checked" selection UI)
  useEffect(() => {
    const next = selectedFiles.map((file) => ({
      key: `${file.name}-${file.size}-${file.lastModified}`,
      file,
      url: URL.createObjectURL(file),
    }));

    setSelectedFilePreviews(next);

    return () => {
      next.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [selectedFiles]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow signed-in agents to upload files
    if (!isSignedInAgent) {
      setShowSignInPrompt(true);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    
    const files = e.target.files;
    if (files && files.length > 0) {
      const validFiles: File[] = [];
      const maxFiles = 10;

      for (let i = 0; i < Math.min(files.length, maxFiles); i++) {
        const file = files[i];
        // Check file size (max 10MB per file)
        if (file.size > 10 * 1024 * 1024) {
          toast({
            title: 'File too large',
            description: `${file.name} exceeds 10MB limit`,
            variant: 'destructive',
          });
          continue;
        }
        validFiles.push(file);
      }

      if (files.length > maxFiles) {
        toast({
          title: 'Too many files',
          description: `Maximum ${maxFiles} files allowed. Only first ${maxFiles} will be added.`,
          variant: 'destructive',
        });
      }

      if (validFiles.length > 0) {
        setSelectedFiles((prev) => [...prev, ...validFiles].slice(0, maxFiles));
        toast({
          title: 'Media selected',
          description: 'Tap Upload again to add more, then press Send.',
        });
      }
    }

    // Reset file input to allow selecting the same file again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleMediaButtonClick = () => {
    if (!isSignedInAgent) {
      setShowSignInPrompt(true);
      return;
    }
    fileInputRef.current?.click();
  };

  const uploadFile = async (file: File): Promise<{ url: string; type: string } | null> => {
    try {
      setIsUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `agent-uploads/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('chat-media')
        .getPublicUrl(filePath);

      const mediaType = file.type.startsWith('image/') ? 'image' : 
                        file.type.startsWith('video/') ? 'video' : 'file';

      return { url: publicUrl, type: mediaType };
    } catch (err) {
      console.error('Upload error:', err);
      toast({
        title: 'Upload failed',
        description: 'Failed to upload file. Please try again.',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && selectedFiles.length === 0) || isSending || !token || !data) return;

    const messageContent = newMessage.trim();
    setIsSending(true);
    setNewMessage('');
    setTyping(false);
    const filesToUpload = [...selectedFiles];
    setSelectedFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    try {
      // If there are files, send each as a separate message with optional text on the first one
      if (filesToUpload.length > 0) {
        for (let i = 0; i < filesToUpload.length; i++) {
          const file = filesToUpload[i];
          const uploadResult = await uploadFile(file);
          
          if (uploadResult) {
            // Only include text content with the first file
            const content = i === 0 ? messageContent : '';
            
            const { data: result, error: sendError } = await supabase.functions.invoke('agent-reply?action=reply', {
              body: {
                token,
                content,
                mediaUrl: uploadResult.url,
                mediaType: uploadResult.type,
              },
            });

            if (sendError || !result.success) {
              throw new Error(result?.error || sendError?.message || 'Failed to send message');
            }

            // Optimistically add the message to local state
            if (result.message) {
              setMessages((prev) => {
                if (prev.some((m) => m.id === result.message.id)) return prev;
                return [...prev, result.message as Message];
              });
            }
          }
        }
      } else {
        // Text-only message
        const { data: result, error: sendError } = await supabase.functions.invoke('agent-reply?action=reply', {
          body: {
            token,
            content: messageContent,
          },
        });

        if (sendError || !result.success) {
          throw new Error(result?.error || sendError?.message || 'Failed to send message');
        }

        // Optimistically add the message to local state
        if (result.message) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === result.message.id)) return prev;
            return [...prev, result.message as Message];
          });
        }
      }
    } catch (err) {
      console.error('Error sending message:', err);
      // Restore the message on error
      setNewMessage(messageContent);
      toast({
        title: 'Failed to send',
        description: err instanceof Error ? err.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleSendContact = async () => {
    if (!token || !data || isSendingContact) return;

    setIsSendingContact(true);
    try {
      const { data: result, error: sendError } = await supabase.functions.invoke('agent-reply?action=send-contact', {
        body: { token },
      });

      if (sendError || !result.success) {
        throw new Error(result?.error || sendError?.message || 'Failed to send contact');
      }

      // Track contact exchange with Datafast
      window.dispatchEvent(new CustomEvent('datafast-track', {
        detail: { goal: 'contact_exchange', agentId: data.agent.id }
      }));

      toast({
        title: 'Contact Sent!',
        description: 'Your phone number has been sent to the renter via SMS.',
      });

      // Refresh messages to show the new system message
      const { data: refreshResult } = await supabase.functions.invoke('agent-reply', {
        body: { token },
      });
      if (refreshResult?.success && refreshResult.messages) {
        setMessages(refreshResult.messages);
      }
    } catch (err) {
      console.error('Error sending contact:', err);
      toast({
        title: 'Failed to send contact',
        description: err instanceof Error ? err.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setIsSendingContact(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <img src={logo} alt="RentAgentGhana" className="h-16 w-16 mb-4" />
        <h1 className="text-xl font-bold text-foreground mb-2">Access Error</h1>
        <p className="text-muted-foreground text-center max-w-md">
          {error || 'This conversation link is invalid or has expired.'}
        </p>
      </div>
    );
  }

  // SECURITY: Never show email or phone - only display name
  const userName = data.user.display_name || 'A renter';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card p-4">
        <div className="container flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="RentAgentGhana" className="h-10 w-10" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-semibold text-foreground">
                  Conversation with {userName}
                </h1>
                <OnlineStatusIndicator isOnline={isOtherPartyOnline} size="sm" showLabel />
              </div>
              <p className="text-sm text-muted-foreground">
                You are responding as {data.agent.display_name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isSendingContact}
                  data-fast-goal="contact_exchange"
                >
                  {isSendingContact ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Phone className="h-4 w-4 mr-1" />
                  )}
                  <span className="hidden sm:inline">Send Contact</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Share your contact?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Your phone number will be sent to {data?.user?.display_name || 'the renter'} via SMS. They'll be able to call or message you directly.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleSendContact}>
                    Send Contact
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <a
              href={`/agent/${data.agent.id}?token=${token}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline whitespace-nowrap"
            >
              {data.agent.claimed_by ? 'Edit Profile' : 'Claim this profile'}
            </a>
          </div>
        </div>
      </header>

      {/* Claim profile prompt modal */}
      {showSignInPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg p-6 max-w-sm w-full shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Lock className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">Claim Your Profile</h3>
            </div>
            <p className="text-muted-foreground mb-4">
              To send and view images or videos, please claim your agent profile on the RentAgentGhana platform first.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowSignInPrompt(false)}
                className="flex-1"
              >
                Maybe Later
              </Button>
              <Button
                onClick={() => {
                  window.open(`/agent/${data.agent.id}?token=${token}`, '_blank');
                  setShowSignInPrompt(false);
                }}
                className="flex-1"
              >
                Claim Profile
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="container max-w-2xl mx-auto space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p>No messages yet.</p>
            </div>
          ) : (
            messages.map((message, index) => {
              const isAgentMessage = message.sender_id === data.agent.id || 
                             message.sender_id === data.agent.claimed_by;
              const previousMessage = index > 0 ? messages[index - 1] : null;
              const showDateSeparator = !previousMessage || isDifferentDay(
                new Date(previousMessage.created_at),
                new Date(message.created_at)
              );
              
              return (
                <div key={message.id}>
                  {showDateSeparator && (
                    <DateSeparator date={new Date(message.created_at)} />
                  )}
                  <MessageBubble
                    message={message}
                    isAgent={isAgentMessage}
                    canViewMedia={!!isSignedInAgent}
                    onSignInRequired={() => setShowSignInPrompt(true)}
                  />
                </div>
              );
            })
          )}
          {isOtherTyping && (
            <TypingIndicator userName={typingUserName || userName} />
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Selected files preview */}
      {selectedFiles.length > 0 && (
        <div className="border-t border-border p-2 bg-muted/50">
          <div className="container max-w-2xl mx-auto space-y-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-sm font-medium text-muted-foreground">
                  {selectedFiles.length} item{selectedFiles.length > 1 ? 's' : ''} selected
                </span>
                <p className="text-xs text-muted-foreground">
                  Tap Upload again to add more (no Ctrl needed).
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedFiles([]);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="h-6 text-xs"
              >
                Clear all
              </Button>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {selectedFilePreviews.map((item, index) => (
                <div
                  key={item.key}
                  className="relative aspect-square rounded-md overflow-hidden border border-border bg-background"
                >
                  {item.file.type.startsWith('image/') ? (
                    <img
                      src={item.url}
                      alt={`Selected media: ${item.file.name}`}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <Video className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}

                  <div className="absolute top-1 left-1 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
                    <Check className="h-3 w-3" />
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute top-0.5 right-0.5 h-6 w-6 bg-background/70 hover:bg-background"
                    onClick={() => setSelectedFiles((prev) => prev.filter((_, i) => i !== index))}
                    aria-label={`Remove ${item.file.name}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSend} className="border-t border-border p-4 bg-card">
        <div className="container max-w-2xl mx-auto flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/*,video/*"
            multiple={true}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleMediaButtonClick}
            disabled={isSending || isUploading}
            title="Attach images or videos"
            className="relative"
          >
            <Upload className="h-4 w-4" />
            {!isSignedInAgent && (
              <Lock className="absolute -top-1 -right-1 h-3 w-3 text-muted-foreground" />
            )}
          </Button>
          <Textarea
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              setTyping(e.target.value.length > 0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (newMessage.trim() || selectedFiles.length > 0) {
                  handleSend(e);
                }
              }
            }}
            placeholder="Type a message... (Shift+Enter for new line)"
            disabled={isSending || isUploading}
            className="flex-1 min-h-[40px] max-h-[120px] resize-none"
            rows={1}
          />
          <Button type="submit" disabled={(!newMessage.trim() && selectedFiles.length === 0) || isSending || isUploading}>
            {isSending || isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

interface MessageBubbleProps {
  message: Message;
  isAgent: boolean;
  canViewMedia: boolean;
  onSignInRequired: () => void;
}

function MessageBubble({ message, isAgent, canViewMedia, onSignInRequired }: MessageBubbleProps) {
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [isLoadingMedia, setIsLoadingMedia] = useState(!!message.media_url && canViewMedia);
  const [mediaError, setMediaError] = useState(false);

  useEffect(() => {
    if (message.media_url && canViewMedia) {
      setIsLoadingMedia(true);
      setMediaError(false);
      getSignedMediaUrl(message.media_url)
        .then(setMediaUrl)
        .catch(() => setMediaError(true))
        .finally(() => setIsLoadingMedia(false));
    }
  }, [message.media_url, canViewMedia]);

  return (
    <div className={cn('flex', isAgent ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[75%] rounded-2xl px-4 py-2',
          isAgent
            ? 'bg-primary text-primary-foreground rounded-br-md'
            : 'bg-muted text-foreground rounded-bl-md'
        )}
      >
        {message.media_url && (
          <div className="mb-2">
            {!canViewMedia ? (
              <button
                onClick={onSignInRequired}
                className={cn(
                  "h-32 w-48 rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors",
                  isAgent 
                    ? "bg-primary-foreground/10 hover:bg-primary-foreground/20" 
                    : "bg-muted hover:bg-muted/80"
                )}
              >
                <Lock className={cn("h-6 w-6", isAgent ? "text-primary-foreground/70" : "text-muted-foreground")} />
                <span className={cn("text-xs text-center px-2", isAgent ? "text-primary-foreground/70" : "text-muted-foreground")}>
                  Sign in to view media
                </span>
              </button>
            ) : isLoadingMedia ? (
              <div className="h-32 w-48 rounded-lg bg-muted/50 animate-pulse flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : mediaError ? (
              <div className="h-32 w-48 rounded-lg bg-muted/50 flex items-center justify-center">
                <p className="text-xs text-muted-foreground">Failed to load</p>
              </div>
            ) : mediaUrl && message.media_type === 'image' ? (
              <img
                src={mediaUrl}
                alt="Shared image"
                className="rounded-lg max-w-full max-h-64 object-cover"
                onError={() => setMediaError(true)}
              />
            ) : mediaUrl && message.media_type === 'video' ? (
              <video
                src={mediaUrl}
                controls
                className="rounded-lg max-w-full max-h-64"
              />
            ) : mediaUrl ? (
              <a
                href={mediaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm underline"
              >
                View attachment
              </a>
            ) : null}
          </div>
        )}
        {message.content && (
          <p className="break-words whitespace-pre-wrap">{message.content}</p>
        )}
        <div
          className={cn(
            'flex items-center gap-1 mt-1',
            isAgent ? 'justify-end' : 'justify-start'
          )}
        >
          <span
            className={cn(
              'text-xs',
              isAgent ? 'text-primary-foreground/70' : 'text-muted-foreground'
            )}
          >
            {format(new Date(message.created_at), 'HH:mm')}
          </span>
          {isAgent && (
            message.is_read ? (
              <CheckCheck className="h-3.5 w-3.5 text-primary-foreground/70" />
            ) : (
              <Check className="h-3.5 w-3.5 text-primary-foreground/70" />
            )
          )}
        </div>
      </div>
    </div>
  );
}
