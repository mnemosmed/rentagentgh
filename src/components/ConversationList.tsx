import { useConversations, ConversationWithAgent } from '@/hooks/useMessages';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, MessageCircle, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface ConversationListProps {
  selectedId?: string;
  onSelect: (conversation: ConversationWithAgent) => void;
}

export function ConversationList({ selectedId, onSelect }: ConversationListProps) {
  const { data: conversations = [], isLoading } = useConversations();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-center px-4">
        <MessageCircle className="h-12 w-12 text-muted-foreground/50 mb-3" />
        <p className="text-muted-foreground">No conversations yet</p>
        <p className="text-sm text-muted-foreground/70 mt-1">
          Search for agents and start a conversation
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-2 space-y-1">
        {conversations.map((conversation) => (
          <ConversationItem
            key={conversation.id}
            conversation={conversation}
            isSelected={selectedId === conversation.id}
            onClick={() => onSelect(conversation)}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

function ConversationItem({
  conversation,
  isSelected,
  onClick,
}: {
  conversation: ConversationWithAgent;
  isSelected: boolean;
  onClick: () => void;
}) {
  const hasUnread = conversation.unread_count > 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-3 rounded-lg transition-colors',
        'hover:bg-muted/50',
        isSelected ? 'bg-primary/10 border-l-4 border-primary' : '',
        hasUnread && !isSelected ? 'bg-primary/5' : ''
      )}
    >
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 relative">
          <User className="h-5 w-5 text-primary" />
          {hasUnread && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {conversation.unread_count > 9 ? '9+' : conversation.unread_count}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className={cn(
              "truncate",
              hasUnread ? "font-semibold text-foreground" : "font-medium text-foreground"
            )}>
              {conversation.agent.display_name}
            </h4>
            {conversation.last_message && (
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {formatDistanceToNow(new Date(conversation.last_message.created_at), {
                  addSuffix: false,
                })}
              </span>
            )}
          </div>
          <p className={cn(
            "text-sm truncate",
            hasUnread ? "text-foreground font-medium" : "text-muted-foreground"
          )}>
            {conversation.last_message?.content || 'Start a conversation...'}
          </p>
        </div>
      </div>
    </button>
  );
}
