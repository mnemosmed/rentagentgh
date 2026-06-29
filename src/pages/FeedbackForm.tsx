import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { StarRating } from '@/components/StarRating';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, Heart } from 'lucide-react';
import logo from '@/assets/logo.png';

export default function FeedbackForm() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);

  const [rating, setRating] = useState(0);
  const [goingWell, setGoingWell] = useState('');
  const [platformHelpful, setPlatformHelpful] = useState<string>('');
  const [improvement, setImprovement] = useState('');

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-feedback-form', {
          body: null,
          method: 'GET',
          // pass token via query param using fetch-equivalent: the SDK supports headers but we'll re-call via raw URL
        } as any);
        // SDK doesn't easily pass query params; use direct fetch:
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-feedback-form?token=${encodeURIComponent(token)}`;
        const res = await fetch(url, {
          headers: { 'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error || 'Invalid feedback link');
        } else if (json.already_submitted) {
          setSubmitted(true);
        } else {
          setDisplayName(json.display_name);
        }
      } catch (e) {
        setError('Failed to load form');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const handleSubmit = async () => {
    if (rating === 0) return toast.error('Please select a star rating');
    if (!platformHelpful) return toast.error('Please answer if RentAgent was helpful');

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('submit-feedback', {
        body: {
          token,
          rating,
          going_well: goingWell.trim(),
          platform_helpful: platformHelpful === 'yes',
          improvement: improvement.trim(),
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed');
      setSubmitted(true);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to submit feedback');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold text-foreground">Link not valid</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-primary/5 to-accent/10 p-6">
        <div className="max-w-md text-center space-y-6 bg-background rounded-3xl p-8 border border-border shadow-xl">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Thank you! 🙏</h1>
          <p className="text-muted-foreground">
            Your feedback helps us make RentAgentGhana better for everyone.
          </p>
          <Button onClick={() => window.location.href = '/'} className="w-full">
            Back to RentAgentGhana
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 py-10 px-4">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-8">
          <img src={logo} alt="RentAgentGhana" className="h-12 w-12 mx-auto mb-3" />
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            {displayName ? `Hi ${displayName}!` : 'Quick feedback'}
          </h1>
          <p className="text-muted-foreground mt-2">
            Takes less than a minute. Your honest feedback shapes the platform.
          </p>
        </div>

        <div className="bg-background rounded-3xl border border-border shadow-xl p-6 md:p-8 space-y-6">
          <div className="space-y-2">
            <Label className="text-base">How would you rate RentAgentGhana?</Label>
            <StarRating rating={rating} interactive onChange={setRating} size="lg" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="going_well" className="text-base">How is your house hunt going so far?</Label>
            <Textarea
              id="going_well"
              value={goingWell}
              onChange={(e) => setGoingWell(e.target.value)}
              placeholder="Found a place? Still looking? Tell us..."
              rows={3}
              maxLength={1000}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-base">Has the RentAgent platform been helpful?</Label>
            <RadioGroup value={platformHelpful} onValueChange={setPlatformHelpful}>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="yes" id="helpful-yes" />
                  <span>Yes</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="no" id="helpful-no" />
                  <span>Not really</span>
                </label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="improvement" className="text-base">How can we improve?</Label>
            <Textarea
              id="improvement"
              value={improvement}
              onChange={(e) => setImprovement(e.target.value)}
              placeholder="Anything missing, broken, or could be better..."
              rows={3}
              maxLength={1000}
            />
          </div>

          <Button onClick={handleSubmit} disabled={sending} size="lg" className="w-full gap-2">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className="h-4 w-4" />}
            Submit Feedback
          </Button>
        </div>
      </div>
    </div>
  );
}
