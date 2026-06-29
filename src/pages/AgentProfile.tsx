import { useParams, Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAgent } from '@/hooks/useAgents';
import { ContactAgentModal } from '@/components/ContactAgentModal';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { 
  ArrowLeft, 
  MessageCircle, 
  MapPin, 
  User,
  CheckCircle,
  Loader2,
  Shield,
  Edit,
  Save,
  X,
  Plus,
  Star
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAgentRatingStats } from '@/hooks/useAgentRatings';
import { AgentRatingDisplay } from '@/components/AgentRatingDisplay';
import { AgentReviewsList } from '@/components/AgentReviewsList';
import { RatingForm } from '@/components/RatingForm';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { SEO } from '@/components/SEO';

export default function AgentProfile() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const { data: agent, isLoading, error, refetch } = useAgent(id);
  const { data: ratingStats } = useAgentRatingStats(id);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showRatingDialog, setShowRatingDialog] = useState(false);

  // Agent access via token
  const token = searchParams.get('token');
  const isAgentAccess = !!token;

  // Check if the logged-in user is the owner of this agent profile
  const isOwner = isAuthenticated && agent?.claimed_by === user?.id;

  // Verification state
  const [verifyStep, setVerifyStep] = useState<'idle' | 'sending' | 'otp' | 'verifying'>('idle');
  const [otp, setOtp] = useState('');
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAreas, setEditAreas] = useState<string[]>([]);
  const [editPrimaryArea, setEditPrimaryArea] = useState('');
  const [newArea, setNewArea] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Check if user came from search with an area
  const fromSearch = location.state?.fromSearch;
  const searchArea = location.state?.searchArea;

  // Initialize edit state when agent data loads
  useEffect(() => {
    if (agent) {
      setEditDisplayName(agent.display_name || '');
      setEditPhone((agent as any).phone || '');
      setEditAreas(agent.covered_areas || []);
      setEditPrimaryArea(agent.primary_area || '');
    }
  }, [agent]);

  const handleBackToSearch = () => {
    if (fromSearch) {
      navigate(-1);
    } else if (searchArea) {
      navigate(`/search?area=${encodeURIComponent(searchArea)}`);
    } else {
      navigate('/search');
    }
  };

  const handleVerifyClick = async () => {
    if (!id) return;
    
    setVerifyStep('sending');
    setVerifyError(null);

    try {
      const { data: result, error: sendError } = await supabase.functions.invoke('claim-profile', {
        body: { 
          action: 'send-otp',
          agentId: id,
          token,
        },
      });

      if (sendError || !result?.success) {
        throw new Error(result?.error || sendError?.message || 'Failed to send verification code');
      }

      toast({
        title: 'Code sent!',
        description: 'A verification code has been sent to your registered phone number.',
      });
      setVerifyStep('otp');
    } catch (err) {
      console.error('Error sending OTP:', err);
      setVerifyError(err instanceof Error ? err.message : 'Failed to send verification code');
      setVerifyStep('idle');
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6 || !id) return;

    setVerifyStep('verifying');
    setVerifyError(null);

    try {
      const { data: result, error: verifyError } = await supabase.functions.invoke('claim-profile', {
        body: { 
          action: 'verify-otp',
          agentId: id,
          token,
          otp,
        },
      });

      if (verifyError || !result?.success) {
        throw new Error(result?.error || verifyError?.message || 'Verification failed');
      }

      // If there's an action link, redirect to it to complete sign-in
      if (result.actionLink) {
        toast({
          title: 'Profile claimed!',
          description: 'Redirecting to complete sign-in...',
        });
        window.location.href = result.actionLink;
        return;
      }

      toast({
        title: 'Profile claimed!',
        description: 'You now have full control of your agent profile.',
      });

      // Refetch agent data and reset state
      await refetch();
      setVerifyStep('idle');
      setOtp('');
    } catch (err) {
      console.error('Error verifying OTP:', err);
      setVerifyError(err instanceof Error ? err.message : 'Verification failed');
      setVerifyStep('otp');
    }
  };

  const handleResendOtp = async () => {
    if (!id) return;
    
    setVerifyError(null);

    try {
      const { data: result, error: sendError } = await supabase.functions.invoke('claim-profile', {
        body: { 
          action: 'send-otp',
          agentId: id,
          token,
        },
      });

      if (sendError || !result?.success) {
        throw new Error(result?.error || sendError?.message || 'Failed to resend code');
      }

      toast({
        title: 'Code resent!',
        description: 'A new verification code has been sent.',
      });
      setOtp('');
    } catch (err) {
      console.error('Error resending OTP:', err);
      setVerifyError(err instanceof Error ? err.message : 'Failed to resend code');
    }
  };

  const handleAddArea = () => {
    const trimmed = newArea.trim();
    if (trimmed && !editAreas.includes(trimmed)) {
      setEditAreas([...editAreas, trimmed]);
      setNewArea('');
    }
  };

  const handleRemoveArea = (area: string) => {
    setEditAreas(editAreas.filter(a => a !== area));
    if (editPrimaryArea === area) {
      setEditPrimaryArea(editAreas.find(a => a !== area) || '');
    }
  };

  const handleSaveProfile = async () => {
    if (!id || !editDisplayName.trim()) return;

    setIsSaving(true);

    try {
      const { data: result, error: saveError } = await supabase.functions.invoke('claim-profile', {
        body: { 
          action: 'update-profile',
          agentId: id,
          token,
          updates: {
            display_name: editDisplayName.trim(),
            phone: editPhone.trim() || null,
            covered_areas: editAreas,
            primary_area: editPrimaryArea || editAreas[0] || '',
          },
        },
      });

      if (saveError || !result?.success) {
        throw new Error(result?.error || saveError?.message || 'Failed to save profile');
      }

      toast({
        title: 'Profile updated!',
        description: 'Your changes have been saved.',
      });

      await refetch();
      setIsEditing(false);
    } catch (err) {
      console.error('Error saving profile:', err);
      toast({
        title: 'Failed to save',
        description: err instanceof Error ? err.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (agent) {
      setEditDisplayName(agent.display_name || '');
      setEditPhone((agent as any).phone || '');
      setEditAreas(agent.covered_areas || []);
      setEditPrimaryArea(agent.primary_area || '');
    }
    setIsEditing(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container py-16 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container py-16 text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Agent not found</h1>
          <p className="text-muted-foreground mb-6">The agent you're looking for doesn't exist.</p>
          <Link to="/search">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Search
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const isClaimed = !!agent.claimed_by;
  const showVerifyButton = isAgentAccess && !isClaimed;
  // Allow editing for token access OR for logged-in owner
  const showEditButton = (isAgentAccess && isClaimed) || isOwner;

  const agentName = agent.display_name || 'Rental Agent';
  const areas = (agent.covered_areas || []).join(', ');
  const seoTitle = `${agentName} — Rental Agent in ${agent.primary_area || 'Accra'} | RentAgentGhana`;
  const seoDesc = `Contact ${agentName}, a rental agent serving ${areas || agent.primary_area || 'Accra'}. Message directly through RentAgentGhana.`;
  const agentJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    name: agentName,
    areaServed: (agent.covered_areas && agent.covered_areas.length ? agent.covered_areas : [agent.primary_area].filter(Boolean)).map(
      (a: string) => ({ '@type': 'Place', name: a })
    ),
    address: {
      '@type': 'PostalAddress',
      addressLocality: agent.primary_area || 'Accra',
      addressRegion: 'Greater Accra',
      addressCountry: 'GH',
    },
    url: `https://rentagentghana.com/agent/${agent.id}`,
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={seoTitle}
        description={seoDesc}
        path={`/agent/${agent.id}`}
        type="profile"
        jsonLd={[
          agentJsonLd,
          {
            '@context': 'https://schema.org',
            '@type': 'ProfilePage',
            mainEntity: agentJsonLd,
          },
        ]}
      />
      <Navbar />

      <div className="container py-8">
        {/* Only show "Back to search" for renters (not owners or token access) */}
        {!isOwner && !isAgentAccess && (
          <button 
            onClick={handleBackToSearch}
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to search results
          </button>
        )}

        <div className="max-w-3xl mx-auto">
          {/* Verification Banner for unclaimed profiles */}
          {showVerifyButton && verifyStep === 'idle' && (
            <div className="bg-primary/10 border border-primary/20 rounded-2xl p-6 mb-6">
              <div className="flex items-start gap-4">
                <Shield className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground mb-1">Claim Your Profile</h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    Verify your ownership to edit your profile and manage your inquiries.
                  </p>
                  {verifyError && (
                    <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                      <p className="text-sm text-destructive">{verifyError}</p>
                    </div>
                  )}
                  <Button onClick={handleVerifyClick}>
                    <Shield className="h-4 w-4 mr-2" />
                    Verify Ownership
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* OTP Entry */}
          {showVerifyButton && (verifyStep === 'otp' || verifyStep === 'verifying' || verifyStep === 'sending') && (
            <div className="bg-card border border-border rounded-2xl p-6 mb-6">
              <div className="text-center">
                <Shield className="h-8 w-8 text-primary mx-auto mb-4" />
                <h3 className="font-semibold text-foreground mb-2">Enter Verification Code</h3>
                <p className="text-muted-foreground text-sm mb-6">
                  {verifyStep === 'sending' 
                    ? 'Sending code to your registered phone number...' 
                    : 'Enter the 6-digit code sent to your registered phone number'}
                </p>

                {verifyError && (
                  <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <p className="text-sm text-destructive">{verifyError}</p>
                  </div>
                )}

                {verifyStep === 'sending' ? (
                  <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                ) : (
                  <>
                    <div className="flex justify-center mb-6">
                      <InputOTP
                        maxLength={6}
                        value={otp}
                        onChange={(value) => setOtp(value)}
                        disabled={verifyStep === 'verifying'}
                      >
                        <InputOTPGroup>
                          <InputOTPSlot index={0} />
                          <InputOTPSlot index={1} />
                          <InputOTPSlot index={2} />
                          <InputOTPSlot index={3} />
                          <InputOTPSlot index={4} />
                          <InputOTPSlot index={5} />
                        </InputOTPGroup>
                      </InputOTP>
                    </div>

                    <Button 
                      onClick={handleVerifyOtp} 
                      disabled={otp.length !== 6 || verifyStep === 'verifying'}
                      className="w-full max-w-xs mb-4"
                    >
                      {verifyStep === 'verifying' ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      Verify & Claim Profile
                    </Button>

                    <div className="flex items-center justify-center gap-4 text-sm">
                      <button
                        type="button"
                        onClick={() => {
                          setVerifyStep('idle');
                          setOtp('');
                          setVerifyError(null);
                        }}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        className="text-primary hover:underline"
                      >
                        Resend code
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Agent Header */}
          <div className="bg-card border border-border rounded-2xl p-6 md:p-8 mb-6 transition-all duration-300 hover:shadow-lg">
            <div className="flex flex-col md:flex-row md:items-start gap-6">
              <div className="flex-shrink-0">
                <div className="w-24 h-24 rounded-2xl bg-primary/10 flex items-center justify-center transition-all duration-300 hover:bg-primary hover:text-primary-foreground group">
                  <User className="h-12 w-12 text-primary group-hover:text-primary-foreground transition-colors" />
                </div>
              </div>
              
              <div className="flex-1 space-y-4">
                {isEditing ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="displayName">Display Name</Label>
                      <Input
                        id="displayName"
                        value={editDisplayName}
                        onChange={(e) => setEditDisplayName(e.target.value)}
                        placeholder="Your display name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        placeholder="0XX XXX XXXX"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-1 flex items-center gap-2">
                      {agent.display_name}
                      {agent.is_verified && (
                        <CheckCircle className="h-6 w-6 text-primary" />
                      )}
                    </h1>
                    <p className="text-muted-foreground">Primary area: {agent.primary_area}</p>
                  </div>
                )}

                {agent.short_bio && !isEditing && (
                  <p className="text-foreground">{agent.short_bio}</p>
                )}

                <div className="flex flex-wrap gap-3">
                  {isEditing ? (
                    <>
                      <Button 
                        onClick={handleSaveProfile}
                        disabled={isSaving || !editDisplayName.trim()}
                        className="gap-2"
                      >
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save Changes
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={handleCancelEdit}
                        disabled={isSaving}
                        className="gap-2"
                      >
                        <X className="h-4 w-4" />
                        Cancel
                      </Button>
                    </>
                  ) : showEditButton ? (
                    <Button 
                      className="gap-2 transition-all duration-300 hover:scale-105"
                      onClick={() => setIsEditing(true)}
                    >
                      <Edit className="h-4 w-4" />
                      Edit Profile
                    </Button>
                  ) : !isAgentAccess ? (
                    <Button 
                      className="gap-2 transition-all duration-300 hover:scale-105"
                      onClick={() => setShowContactModal(true)}
                    >
                      <MessageCircle className="h-4 w-4" />
                      Contact Agent
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {/* Areas Section */}
          <div className="bg-card border border-border rounded-2xl p-6 md:p-8 mb-6">
            <h2 className="font-semibold text-lg text-foreground mb-4 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Areas Covered
            </h2>
            
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">Primary Area</Label>
                  <select
                    value={editPrimaryArea}
                    onChange={(e) => setEditPrimaryArea(e.target.value)}
                    className="w-full p-2 border border-border rounded-lg bg-background text-foreground"
                  >
                    {editAreas.map((area) => (
                      <option key={area} value={area}>{area}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">All Areas</Label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {editAreas.map((area) => (
                      <Badge 
                        key={area} 
                        variant={area === editPrimaryArea ? 'default' : 'secondary'}
                        className="flex items-center gap-1"
                      >
                        {area}
                        <button
                          type="button"
                          onClick={() => handleRemoveArea(area)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={newArea}
                      onChange={(e) => setNewArea(e.target.value)}
                      placeholder="Add new area"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddArea();
                        }
                      }}
                    />
                    <Button type="button" variant="outline" onClick={handleAddArea}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Primary Area</p>
                  <Badge className="text-sm">{agent.primary_area}</Badge>
                </div>
                
                <div>
                  <p className="text-sm text-muted-foreground mb-2">All Areas</p>
                  <div className="flex flex-wrap gap-2">
                    {agent.covered_areas.map((area) => (
                      <Badge 
                        key={area} 
                        variant={area === agent.primary_area ? 'default' : 'secondary'}
                      >
                        {area}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Ratings & Reviews Section */}
          <div className="bg-card border border-border rounded-2xl p-6 md:p-8 mb-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-semibold text-lg text-foreground flex items-center gap-2">
                <Star className="h-5 w-5 text-primary" />
                Ratings & Reviews
              </h2>
              {/* Only show rate button for renters (not owners or token access) */}
              {!isOwner && !isAgentAccess && isAuthenticated && (
                <Dialog open={showRatingDialog} onOpenChange={setShowRatingDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Star className="h-4 w-4" />
                      Rate Agent
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Rate {agent.display_name}</DialogTitle>
                    </DialogHeader>
                    <RatingForm 
                      agentId={agent.id} 
                      agentName={agent.display_name}
                      onSuccess={() => setShowRatingDialog(false)}
                    />
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {/* Detailed Rating Stats */}
            <AgentRatingDisplay
              overallRating={ratingStats?.overall_rating ?? null}
              totalRatings={ratingStats?.total_ratings ?? 0}
              avgResponsiveness={ratingStats?.avg_responsiveness}
              avgTrustworthiness={ratingStats?.avg_trustworthiness}
              avgHelpfulness={ratingStats?.avg_helpfulness}
              variant="detailed"
              className="mb-6"
            />

            {/* Reviews List */}
            <div className="border-t border-border pt-6">
              <h3 className="font-medium text-foreground mb-4">Reviews</h3>
              <AgentReviewsList agentId={agent.id} />
            </div>
          </div>

        </div>
      </div>

      {/* Contact Modal */}
      <ContactAgentModal
        agent={agent}
        isOpen={showContactModal}
        onClose={() => setShowContactModal(false)}
      />
    </div>
  );
}
