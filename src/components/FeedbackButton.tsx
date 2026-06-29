import { useState } from 'react';
import { MessageSquareWarning } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('Bug');
  const [sending, setSending] = useState(false);
  const { user } = useAuth();

  const handleSubmit = async () => {
    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-feedback', {
        body: {
          message: message.trim(),
          category,
          userEmail: user?.email || user?.phone || 'Anonymous',
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error('Failed to send');

      toast.success('Feedback sent! Thank you for reporting.');
      setMessage('');
      setCategory('Bug');
      setOpen(false);
    } catch (err) {
      console.error('Feedback error:', err);
      toast.error('Failed to send feedback. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full shadow-lg border-primary/20 hover:bg-primary hover:text-primary-foreground transition-all"
        title="Report a problem"
      >
        <MessageSquareWarning className="h-5 w-5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Report a Problem</DialogTitle>
            <DialogDescription>
              Let us know about any issues you're experiencing.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bug">Bug / Error</SelectItem>
                  <SelectItem value="UI">UI / Design Issue</SelectItem>
                  <SelectItem value="Feature">Feature Request</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                placeholder="Describe the problem..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={1000}
                rows={4}
              />
              <p className="text-xs text-muted-foreground text-right">{message.length}/1000</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={sending || !message.trim()}>
              {sending ? 'Sending...' : 'Send Feedback'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
