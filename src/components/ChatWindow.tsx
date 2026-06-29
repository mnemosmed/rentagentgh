import { useState, useRef, useEffect, ChangeEvent } from 'react';
import { useMessages, useSendMessage, useConversation, useMarkMessagesAsRead, Message } from '@/hooks/useMessages';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { TypingIndicator } from '@/components/TypingIndicator';
import { OnlineStatusIndicator } from '@/components/OnlineStatusIndicator';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Loader2, ArrowLeft, User, Check, CheckCheck, Paperclip, X, Image, Film, File, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { DateSeparator, isDifferentDay } from '@/components/DateSeparator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

interface ChatWindowProps {
  conversationId: string;
  onBack?: () => void;
}

export function ChatWindow({ conversationId, onBack }: ChatWindowProps) {
  const { user } = useAuth();
  const { data: conversation, isLoading: loadingConversation } = useConversation(conversationId);
  const { data: messages = [], isLoading: loadingMessages } = useMessages(conversationId);
  const sendMessage = useSendMessage();
  const markAsRead = useMarkMessagesAsRead(conversationId);
  const [newMessage, setNewMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isSharingContact, setIsSharingContact] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Typing indicator
  const { isOtherTyping, typingUserName, setTyping } = useTypingIndicator(
    conversationId,
    user?.id || '',
    'Renter'
  );

  // Online status
  const agentUserId = conversation?.agent?.claimed_by || conversation?.agent?.id || '';
  const { isOtherPartyOnline } = useOnlineStatus(conversationId, user?.id || '');

  // Mark messages as read when conversation is opened
  useEffect(() => {
    if (conversationId && messages.length > 0 && !loadingMessages) {
      const hasUnread = messages.some(m => !m.is_read && m.sender_id !== user?.id);
      if (hasUnread) {
        markAsRead.mutate();
      }
    }
  }, [conversationId, messages, loadingMessages, user?.id]);

  // Scroll to bottom when messages change or typing indicator appears
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOtherTyping]);

  // Clean up file preview URL
  useEffect(() => {
    return () => {
      if (filePreview) {
        URL.revokeObjectURL(filePreview);
      }
    };
  }, [filePreview]);

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        setFilePreview(URL.createObjectURL(file));
      } else {
        setFilePreview(null);
      }
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    if (filePreview) {
      URL.revokeObjectURL(filePreview);
      setFilePreview(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !selectedFile) || sendMessage.isPending) return;

    const content = newMessage.trim();
    const mediaFile = selectedFile;
    
    setNewMessage('');
    clearSelectedFile();
    setTyping(false);
    
    await sendMessage.mutateAsync({
      conversationId,
      content,
      mediaFile: mediaFile || undefined,
    });
  };

  const handleShareContact = async () => {
    setIsSharingContact(true);
    try {
      const { data, error } = await supabase.functions.invoke('share-contact', {
        body: { conversationId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: 'Contact shared!', description: 'Your contact has been sent via SMS.' });
    } catch (err: any) {
      toast({ title: 'Failed to share contact', description: err.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setIsSharingContact(false);
    }
  };

  if (loadingConversation || loadingMessages) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
        <p>Conversation not found</p>
        <Link to="/messages">
          <Button variant="outline" className="mt-4">
            Back to messages
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <Link to={`/agent/${conversation.agent.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="relative">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5">
                <OnlineStatusIndicator isOnline={isOtherPartyOnline} size="sm" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground">{conversation.agent.display_name}</h3>
              </div>
              <p className="text-sm text-muted-foreground">{conversation.agent.primary_area}</p>
            </div>
          </Link>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={isSharingContact} className="gap-1.5">
              {isSharingContact ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
              <span className="hidden sm:inline">Share Contact</span>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Share your contact?</AlertDialogTitle>
              <AlertDialogDescription>
                Your phone number will be sent to {conversation.agent.display_name} via SMS so they can reach you directly.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleShareContact}>Share Contact</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p>No messages yet. Send one to start the conversation!</p>
            </div>
          ) : (
            messages.map((message, index) => {
              // For renter view: own messages are from the renter (user_id on conversation)
              // Agent messages have sender_id matching agent.id or agent.claimed_by
              const isFromAgent = message.sender_id === conversation.agent.id || 
                                  message.sender_id === conversation.agent.claimed_by;
              const isOwn = !isFromAgent;
              
              // Check if we need to show a date separator
              const messageDate = new Date(message.created_at);
              const previousMessage = messages[index - 1];
              const showDateSeparator = !previousMessage || 
                isDifferentDay(messageDate, new Date(previousMessage.created_at));
              
              return (
                <div key={message.id}>
                  {showDateSeparator && <DateSeparator date={messageDate} />}
                  <MessageBubble
                    message={message}
                    isOwn={isOwn}
                  />
                </div>
              );
            })
          )}
          {isOtherTyping && (
            <TypingIndicator userName={typingUserName || conversation?.agent?.display_name} />
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* File Preview */}
      {selectedFile && (
        <div className="border-t border-border px-4 py-2 bg-muted/50">
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 min-w-0">
              {filePreview && selectedFile.type.startsWith('image/') ? (
                <img src={filePreview} alt="Preview" className="h-12 w-12 rounded object-cover" />
              ) : filePreview && selectedFile.type.startsWith('video/') ? (
                <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
                  <Film className="h-6 w-6 text-muted-foreground" />
                </div>
              ) : (
                <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
                  <File className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <span className="text-sm text-foreground truncate">{selectedFile.name}</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={clearSelectedFile}
              className="h-8 w-8 shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSend} className="border-t border-border p-4">
        <div className="flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/*,video/*,.pdf,.doc,.docx"
            className="hidden"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={sendMessage.isPending}
            className="shrink-0"
          >
            <Paperclip className="h-5 w-5" />
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
                if (newMessage.trim() || selectedFile) {
                  handleSend(e);
                }
              }
            }}
            placeholder="Type a message... (Shift+Enter for new line)"
            disabled={sendMessage.isPending}
            className="flex-1 min-h-[40px] max-h-[120px] resize-none"
            rows={1}
          />
          <Button type="submit" disabled={(!newMessage.trim() && !selectedFile) || sendMessage.isPending}>
            {sendMessage.isPending ? (
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

// Get a signed URL for private media
async function getSignedMediaUrl(mediaUrl: string): Promise<string> {
  // Check if it's already a signed URL
  if (mediaUrl.includes('token=')) {
    return mediaUrl;
  }
  
  // Extract the path from the public URL
  const urlPattern = /\/storage\/v1\/object\/public\/chat-media\/(.+)/;
  const match = mediaUrl.match(urlPattern);
  
  if (!match) {
    return mediaUrl; // Return original if not matching expected pattern
  }
  
  const filePath = match[1];
  
  const { data, error } = await supabase.storage
    .from('chat-media')
    .createSignedUrl(filePath, 3600); // 1 hour expiry
  
  if (error || !data) {
    console.error('Failed to create signed URL:', error);
    return mediaUrl; // Fall back to original URL
  }
  
  return data.signedUrl;
}

function MessageBubble({ message, isOwn }: { message: Message; isOwn: boolean }) {
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [isLoadingMedia, setIsLoadingMedia] = useState(!!message.media_url);
  const [mediaError, setMediaError] = useState(false);

  // Get signed URL for media
  useEffect(() => {
    if (message.media_url) {
      setIsLoadingMedia(true);
      setMediaError(false);
      getSignedMediaUrl(message.media_url)
        .then(setMediaUrl)
        .catch(() => setMediaError(true))
        .finally(() => setIsLoadingMedia(false));
    }
  }, [message.media_url]);

  return (
    <div className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[75%] rounded-2xl px-4 py-2',
          isOwn
            ? 'bg-primary text-primary-foreground rounded-br-md'
            : 'bg-muted text-foreground rounded-bl-md'
        )}
      >
        {message.media_url && (
          <div className="mb-2">
            {isLoadingMedia ? (
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
            isOwn ? 'justify-end' : 'justify-start'
          )}
        >
          <span
            className={cn(
              'text-xs',
              isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
            )}
          >
            {format(new Date(message.created_at), 'HH:mm')}
          </span>
          {isOwn && (
            message.is_read ? (
              <CheckCheck className={cn('h-3.5 w-3.5 text-primary-foreground/70')} />
            ) : (
              <Check className={cn('h-3.5 w-3.5 text-primary-foreground/70')} />
            )
          )}
        </div>
      </div>
    </div>
  );
}
