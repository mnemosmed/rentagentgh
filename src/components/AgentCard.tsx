import { Agent } from '@/hooks/useAgents';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, MapPin, User, CheckCircle, Mail } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { ContactAgentModal } from '@/components/ContactAgentModal';
import { AgentRatingDisplay } from '@/components/AgentRatingDisplay';
import { useAgentRatingStats } from '@/hooks/useAgentRatings';
interface AgentCardProps {
  agent: Agent;
  isContacted?: boolean;
}

export function AgentCard({ agent, isContacted }: AgentCardProps) {
  const [showContactModal, setShowContactModal] = useState(false);
  const [searchParams] = useSearchParams();
  const searchArea = searchParams.get('area') || '';
  const { data: ratingStats } = useAgentRatingStats(agent.id);
  
  return (
    <>
      <Card className={`group overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-primary/20 hover:-translate-y-1 h-full flex flex-col ${isContacted ? 'border-primary/30 bg-primary/5' : ''}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary transition-all duration-300 group-hover:bg-primary group-hover:text-primary-foreground shrink-0">
                <User className="h-6 w-6" />
              </div>
              <div>
                <Link 
                  to={`/agent/${agent.id}`}
                  state={{ fromSearch: true, searchArea }}
                  className="font-semibold text-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                >
                  {agent.display_name}
                  {agent.is_verified && (
                    <CheckCircle className="h-4 w-4 text-primary" />
                  )}
                </Link>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm text-muted-foreground">{agent.primary_area}</p>
                  {isContacted && (
                    <Badge variant="secondary" className="text-xs gap-1 bg-primary/10 text-primary border-0">
                      <Mail className="h-3 w-3" />
                      Contacted
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pb-3 flex-1">
          {/* Rating display */}
          <div className="mb-3">
            <AgentRatingDisplay 
              overallRating={ratingStats?.overall_rating ?? null}
              totalRatings={ratingStats?.total_ratings ?? 0}
              variant="compact"
            />
          </div>

          {agent.short_bio && (
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
              {agent.short_bio}
            </p>
          )}
          
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 text-primary shrink-0" />
              <span>Serves <span className="font-medium text-foreground">{agent.covered_areas.length} areas</span></span>
            </div>
            
            <div className="flex flex-wrap gap-1.5">
              {agent.covered_areas.slice(0, 4).map((area) => (
                <Badge 
                  key={area} 
                  variant={area === agent.primary_area ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {area}
                </Badge>
              ))}
              {agent.covered_areas.length > 4 && (
                <Badge variant="outline" className="text-xs">
                  +{agent.covered_areas.length - 4} more
                </Badge>
              )}
            </div>
          </div>
        </CardContent>

        <CardFooter className="gap-2 pt-3 border-t mt-auto">
          <Button
            size="sm"
            className="flex-1 gap-2 transition-all duration-300 hover:scale-105"
            onClick={() => setShowContactModal(true)}
            data-fast-goal="contact_agent_click"
            data-fast-goal-agent-id={agent.id}
            data-fast-goal-agent-name={agent.display_name}
            data-fast-goal-primary-area={agent.primary_area}
          >
            <MessageCircle className="h-4 w-4" />
            Contact Agent
          </Button>
        </CardFooter>
      </Card>

      <ContactAgentModal
        agent={agent}
        isOpen={showContactModal}
        onClose={() => setShowContactModal(false)}
      />
    </>
  );
}
