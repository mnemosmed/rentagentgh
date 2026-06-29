import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Loader2, Eye, EyeOff, CheckCircle, Star, MessageSquare, TrendingUp, ThumbsUp } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { StarRating } from '@/components/StarRating';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Navbar } from '@/components/Navbar';

interface FeedbackRow {
  id: string;
  display_name: string | null;
  phone: string;
  rating: number | null;
  going_well: string | null;
  platform_helpful: boolean | null;
  improvement: string | null;
  submitted_at: string;
  is_published: boolean;
  is_approved: boolean;
}

interface FeedbackStats {
  totalSent: number;
  totalSubmissions: number;
  avgRating: number;
  responseRate: number;
  helpfulPct: number;
}

export default function AdminFeedback() {
  const { user } = useAuth();
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  const fetchFeedback = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-feedback', { method: 'GET' });
      if (error) {
        if (error.message?.includes('403') || error.message?.includes('Admin')) setForbidden(true);
        throw error;
      }
      setFeedback(data?.feedback || []);
      setStats(data?.stats || null);
    } catch (e: any) {
      if (!forbidden) toast.error('Failed to load feedback');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchFeedback();
  }, [user]);

  const handleAction = async (id: string, action: 'publish' | 'hide') => {
    try {
      const { error } = await supabase.functions.invoke('admin-feedback', {
        method: 'POST',
        body: { id, action },
      });
      if (error) throw error;
      toast.success(action === 'publish' ? 'Published' : 'Hidden');
      fetchFeedback();
    } catch (e) {
      toast.error('Action failed');
    }
  };

  if (!user) return <Navigate to="/" replace />;
  if (forbidden) return (
    <div className="min-h-screen flex items-center justify-center p-6 text-center">
      <div>
        <h1 className="text-2xl font-bold mb-2">Admin only</h1>
        <p className="text-muted-foreground">You don't have access to this page.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container py-10 max-w-5xl">
        <h1 className="text-3xl font-bold mb-2 text-foreground">Feedback Moderation</h1>
        <p className="text-muted-foreground mb-8">Review user feedback and choose which to publish as testimonials.</p>

        {stats && !loading && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard icon={<Star className="h-5 w-5" />} label="Avg Rating" value={stats.avgRating ? `${stats.avgRating} / 5` : '—'} />
            <StatCard icon={<MessageSquare className="h-5 w-5" />} label="Submissions" value={`${stats.totalSubmissions}`} sub={`of ${stats.totalSent} sent`} />
            <StatCard icon={<TrendingUp className="h-5 w-5" />} label="Response Rate" value={`${stats.responseRate}%`} />
            <StatCard icon={<ThumbsUp className="h-5 w-5" />} label="Found Helpful" value={`${stats.helpfulPct}%`} />
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
        ) : feedback.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">No feedback submitted yet.</div>
        ) : (
          <div className="space-y-4">
            {feedback.map((f) => (
              <div key={f.id} className="bg-card border border-border rounded-2xl p-6 space-y-3">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{f.display_name || 'Anonymous'}</span>
                      {f.is_published && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" /> Published
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{format(new Date(f.submitted_at), 'MMM d, yyyy h:mm a')}</p>
                  </div>
                  {f.rating && <StarRating rating={f.rating} size="sm" showValue />}
                </div>

                {f.going_well && <div><Label>House hunt:</Label><p className="text-sm text-foreground">{f.going_well}</p></div>}
                <div className="text-sm">
                  <Label>Platform helpful:</Label> <span className="text-foreground">{f.platform_helpful ? 'Yes' : 'Not really'}</span>
                </div>
                {f.improvement && <div><Label>Improvements:</Label><p className="text-sm text-foreground">{f.improvement}</p></div>}

                <div className="flex gap-2 pt-2 border-t border-border">
                  {!f.is_published ? (
                    <Button size="sm" onClick={() => handleAction(f.id, 'publish')} className="gap-1">
                      <Eye className="h-4 w-4" /> Publish as testimonial
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => handleAction(f.id, 'hide')} className="gap-1">
                      <EyeOff className="h-4 w-4" /> Hide
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{children}</span>;
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}
