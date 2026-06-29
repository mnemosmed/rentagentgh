import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Agent } from '@/hooks/useAgents';
import { useGetOrCreateConversation, useSendMessage } from '@/hooks/useMessages';
import { useContactedAgents } from '@/hooks/useContactedAgents';
import { useAuth } from '@/contexts/AuthContext';
import { AuthModal } from '@/components/AuthModal';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAddRole } from '@/hooks/useUserRoles';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, ArrowRight, Send, Loader2, Eye, Save, Trash2 } from 'lucide-react';

interface ContactAgentModalProps {
  agent: Agent;
  isOpen: boolean;
  onClose: () => void;
}

interface SavedPreferences {
  propertyType: string;
  location: string;
  budgetMin: string;
  budgetMax: string;
  moveIn: string;
  preferences: string;
}

const STORAGE_KEY = 'renter-preferences';

const PROPERTY_TYPES = [
  'Studio',
  '1-bedroom',
  '2-bedroom',
  '3-bedroom',
  '4+ bedroom',
  'Single room',
  'Chamber and hall',
  'Self-contained',
  'House',
  'Other',
];

const MOVE_IN_OPTIONS = [
  'Immediately',
  'Within 2 weeks',
  'Next month',
  'In 2-3 months',
  'Flexible',
];

const loadSavedPreferences = (): SavedPreferences | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

const savePreferences = (prefs: SavedPreferences) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    console.error('Failed to save preferences');
  }
};

const clearSavedPreferences = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    console.error('Failed to clear preferences');
  }
};

export function ContactAgentModal({ agent, isOpen, onClose }: ContactAgentModalProps) {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const getOrCreateConversation = useGetOrCreateConversation();
  const sendMessage = useSendMessage();
  const { markAgentAsContacted } = useContactedAgents();
  const addRole = useAddRole();

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [step, setStep] = useState<'form' | 'preview' | 'name-required'>('form');
  const [isSending, setIsSending] = useState(false);
  const [hasSavedPrefs, setHasSavedPrefs] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);

  // Get user's display name
  const userDisplayName = user?.user_metadata?.display_name || user?.user_metadata?.first_name || '';

  // Form state
  const [propertyType, setPropertyType] = useState('');
  const [location, setLocation] = useState('');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [moveIn, setMoveIn] = useState('');
  const [preferences, setPreferences] = useState('');

  // Load saved preferences when modal opens
  useEffect(() => {
    if (isOpen) {
      const saved = loadSavedPreferences();
      setHasSavedPrefs(!!saved);
      if (saved) {
        setPropertyType(saved.propertyType || '');
        setLocation(saved.location || '');
        setBudgetMin(saved.budgetMin || '');
        setBudgetMax(saved.budgetMax || '');
        setMoveIn(saved.moveIn || '');
        setPreferences(saved.preferences || '');
      }
    }
  }, [isOpen]);

  const resetForm = () => {
    setStep('form');
    setPropertyType('');
    setLocation('');
    setBudgetMin('');
    setBudgetMax('');
    setMoveIn('');
    setPreferences('');
    setDisplayName('');
  };

  const handleSavePreferences = () => {
    savePreferences({
      propertyType,
      location,
      budgetMin,
      budgetMax,
      moveIn,
      preferences,
    });
    setHasSavedPrefs(true);
    toast({
      title: 'Preferences saved!',
      description: 'Your requirements will auto-fill next time.',
    });
  };

  const handleClearPreferences = () => {
    clearSavedPreferences();
    setHasSavedPrefs(false);
    resetForm();
    toast({
      title: 'Preferences cleared',
      description: 'Your saved requirements have been removed.',
    });
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const formatBudget = () => {
    if (budgetMin && budgetMax) {
      return `GHS ${Number(budgetMin).toLocaleString()} – ${Number(budgetMax).toLocaleString()}`;
    } else if (budgetMin) {
      return `GHS ${Number(budgetMin).toLocaleString()}`;
    } else if (budgetMax) {
      return `Up to GHS ${Number(budgetMax).toLocaleString()}`;
    }
    return 'Not specified';
  };

  const generateMessage = () => {
    const preferencesLine = preferences.trim()
      ? `Preferences: ${preferences.trim()}`
      : 'Preferences: None specified';

    return `Hi ${agent.display_name},

I'm looking for a ${propertyType || '[property type]'} around ${location || '[location]'}.

Budget: ${formatBudget()}
Move-in: ${moveIn || '[move-in date]'}

${preferencesLine}

Please let me know if you have any available options and kindly share photos or videos if possible.

Thank you.`;
  };

  const isFormValid = propertyType && location && (budgetMin || budgetMax) && moveIn;

  const handleContinueToPreview = () => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }
    // Check if user has a display name
    if (!userDisplayName) {
      setStep('name-required');
      return;
    }
    setStep('preview');
  };

  const handleAuthSuccess = () => {
    setShowAuthModal(false);
    // After auth, check if user has display name
    const name = user?.user_metadata?.display_name || user?.user_metadata?.first_name;
    if (!name) {
      setStep('name-required');
    } else {
      setStep('preview');
    }
  };

  const handleSaveName = async () => {
    if (!displayName.trim() || !user) return;
    
    setIsSavingName(true);
    try {
      // Update user metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: { display_name: displayName.trim(), first_name: displayName.trim() }
      });
      
      if (authError) throw authError;
      
      // Also update profiles table
      await supabase
        .from('profiles')
        .upsert({
          user_id: user.id,
          display_name: displayName.trim(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      
      toast({
        title: 'Name saved!',
        description: 'You can now send messages to agents.',
      });
      
      setStep('preview');
    } catch (error) {
      console.error('Failed to save name:', error);
      toast({
        title: 'Failed to save name',
        description: 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingName(false);
    }
  };

  const handleSend = async () => {
    if (!isFormValid) return;

    setIsSending(true);
    try {
      // Tag user as renter (fire and forget - will be ignored if already tagged)
      addRole.mutate('renter');
      
      // Optimistically mark the agent as contacted immediately
      markAgentAsContacted(agent.id);
      
      const conversation = await getOrCreateConversation.mutateAsync(agent.id);
      await sendMessage.mutateAsync({
        conversationId: conversation.id,
        content: generateMessage(),
      });
      // Send SMS notification to agent (fire and forget - phone fetched server-side)
      // SECURITY: Never expose phone/email - use display name only
      // Use displayName if just set, otherwise from user metadata
      const senderName = displayName.trim() || 
                         user?.user_metadata?.display_name || 
                         user?.user_metadata?.first_name;
      supabase.functions.invoke('send-sms-notification', {
        body: {
          conversationId: conversation.id,
          agentId: agent.id,
          agentName: agent.display_name,
          senderName,
        },
      }).then(({ data, error }) => {
        if (error) {
          console.error('SMS notification failed:', error);
        } else {
          console.log('SMS notification sent:', data);
        }
      });

      // Track successful message sent
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('datafast:goal', {
          detail: {
            goal: 'message_sent',
            params: {
              agent_id: agent.id,
              agent_name: agent.display_name,
              property_type: propertyType,
              location: location,
              move_in: moveIn
            }
          }
        }));
      }

      toast({
        title: 'Message sent! ✉️',
        description: 'Check your inbox to see the agent\'s reply.',
      });

      handleClose();
    } catch (error) {
      console.error('Failed to send message:', error);
      toast({
        title: 'Failed to send',
        description: 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          {step === 'form' ? (
            <>
              <DialogHeader>
                <DialogTitle>Contact {agent.display_name}</DialogTitle>
                <DialogDescription>
                  Fill in your requirements and we'll generate a message for you.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {/* Property Type */}
                <div className="space-y-2">
                  <Label htmlFor="propertyType">Property Type *</Label>
                  <Select value={propertyType} onValueChange={setPropertyType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select property type" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROPERTY_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Location */}
                <div className="space-y-2">
                  <Label htmlFor="location">Preferred Location *</Label>
                  <Input
                    id="location"
                    placeholder="e.g. East Legon, Osu, Cantonments"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>

                {/* Budget Range */}
                <div className="space-y-2">
                  <Label>Budget Range (GHS) *</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={budgetMin}
                      onChange={(e) => setBudgetMin(e.target.value)}
                      className="flex-1"
                    />
                    <span className="text-muted-foreground">–</span>
                    <Input
                      type="number"
                      placeholder="Max"
                      value={budgetMax}
                      onChange={(e) => setBudgetMax(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>

                {/* Move-in Date */}
                <div className="space-y-2">
                  <Label htmlFor="moveIn">Move-in Timeline *</Label>
                  <Select value={moveIn} onValueChange={setMoveIn}>
                    <SelectTrigger>
                      <SelectValue placeholder="When do you want to move in?" />
                    </SelectTrigger>
                    <SelectContent>
                      {MOVE_IN_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Preferences */}
                <div className="space-y-2">
                  <Label htmlFor="preferences">
                    Additional Preferences <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Textarea
                    id="preferences"
                    placeholder="e.g. furnished, parking, pet-friendly, quiet neighborhood..."
                    value={preferences}
                    onChange={(e) => setPreferences(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>

              {/* Save/Clear Preferences */}
              <div className="flex items-center justify-between border-t pt-4">
                <div className="flex items-center gap-2">
                  {hasSavedPrefs ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleClearPreferences}
                      className="text-muted-foreground gap-1"
                    >
                      <Trash2 className="h-4 w-4" />
                      Clear saved
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleSavePreferences}
                      disabled={!isFormValid}
                      className="text-muted-foreground gap-1"
                    >
                      <Save className="h-4 w-4" />
                      Save for reuse
                    </Button>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleClose}>
                    Cancel
                  </Button>
                  <Button onClick={handleContinueToPreview} disabled={!isFormValid} className="gap-2">
                    Preview Message
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : step === 'name-required' ? (
            <>
              <DialogHeader>
                <DialogTitle>What's your name?</DialogTitle>
                <DialogDescription>
                  Agents need to know who they're talking to. Please enter your first name to continue.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName">First Name</Label>
                  <Input
                    id="displayName"
                    placeholder="e.g. Kwame"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>

              <div className="flex justify-between gap-2">
                <Button variant="outline" onClick={() => setStep('form')} className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button 
                  onClick={handleSaveName} 
                  disabled={!displayName.trim() || isSavingName}
                  className="gap-2"
                >
                  {isSavingName ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-primary" />
                  Preview Message
                </DialogTitle>
                <DialogDescription>
                  Review your message before sending to {agent.display_name}.
                </DialogDescription>
              </DialogHeader>

              <div className="py-4">
                <div className="bg-muted rounded-lg p-4 whitespace-pre-wrap text-sm">
                  {generateMessage()}
                </div>
              </div>

              <div className="flex justify-between gap-2">
                <Button variant="outline" onClick={() => setStep('form')} className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Edit
                </Button>
                <Button onClick={handleSend} disabled={isSending} className="gap-2">
                  {isSending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Send Message
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
      />
    </>
  );
}
