import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, AlertCircle, Phone, ArrowLeft, Search, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { setUserRole } from '@/hooks/useUserRole';
import { ToastAction } from '@/components/ui/toast';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type AuthStep = 'form' | 'otp';

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const navigate = useNavigate();
  const { signInWithOtp, verifyOtp } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  const [step, setStep] = useState<AuthStep>('form');
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [firstName, setFirstName] = useState('');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await signInWithOtp(phone, authMode === 'signup' ? firstName.trim() : undefined, authMode === 'signup');

      if (result.error) {
        // Check for specific error cases
        if (result.error.message.includes('already exists') || result.error.message.includes('userExists')) {
          setError('An account already exists with this phone number. Please sign in instead.');
          setAuthMode('login');
        } else if (result.error.message.includes('No account found') || result.error.message.includes('userNotFound')) {
          setError('No account found with this phone number. Please sign up first.');
          setAuthMode('signup');
        } else {
          setError(result.error.message);
        }
      } else {
        toast({
          title: 'OTP sent!',
          description: 'Check your phone for the verification code.',
        });
        setStep('otp');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpVerify = async () => {
    if (otpCode.length !== 6) return;
    
    setIsLoading(true);
    setError(null);

    try {
      const result = await verifyOtp(phone, otpCode, authMode === 'signup' ? firstName.trim() : '', authMode === 'signup');

      if (result.error) {
        if (result.error.message.includes('expired')) {
          setError('Code expired. Please request a new one.');
        } else if (result.error.message.includes('Invalid')) {
          setError('Invalid code. Please try again.');
        } else {
          setError(result.error.message);
        }
      } else {
        // Set role to renter with phone number (this is the renter auth flow)
        // Phone is stored without +233 prefix in state, so add it
        const fullPhone = `+233${phone.replace(/^0+/, '').replace(/\s+/g, '')}`;
        setUserRole('renter', fullPhone);
        
        if (authMode === 'signup') {
          // Track successful signup
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('datafast:goal', {
              detail: { goal: 'user_signup' }
            }));
          }
          
          // Show welcome toast with quick actions for new signups
          toast({
            title: `Welcome, ${firstName}! 🎉`,
            description: 'Your account is ready. Start by searching for agents in your area.',
            duration: 8000,
            action: (
              <ToastAction 
                altText="View Messages" 
                onClick={() => navigate('/messages')}
              >
                <MessageSquare className="h-4 w-4 mr-1" />
                Messages
              </ToastAction>
            ),
          });
        } else {
          // Track successful sign in
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('datafast:goal', {
              detail: { goal: 'user_signin' }
            }));
          }
          
          toast({
            title: 'Welcome back!',
            description: 'You are now signed in.',
          });
        }
        
        onSuccess?.();
        onClose();
        resetForm();
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFirstName('');
    setPhone('');
    setOtpCode('');
    setError(null);
    setStep('form');
    setAuthMode('signup');
  };

  const handleBack = () => {
    if (step === 'otp') {
      setStep('form');
      setOtpCode('');
    }
    setError(null);
  };

  const handleResendOtp = async () => {
    setOtpCode('');
    setIsLoading(true);
    setError(null);

    try {
      const result = await signInWithOtp(phone, authMode === 'signup' ? firstName.trim() : undefined, authMode === 'signup');
      if (result.error) {
        setError(result.error.message);
      } else {
        toast({
          title: 'OTP resent!',
          description: 'Check your phone for the new verification code.',
        });
      }
    } catch (err) {
      setError('Failed to resend code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { resetForm(); onClose(); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {step === 'otp' && (
              <Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div>
              <DialogTitle className="text-2xl font-bold text-foreground">
                {step === 'otp' 
                  ? 'Enter verification code' 
                  : authMode === 'signup' 
                    ? 'Create a free account' 
                    : 'Welcome back'}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {step === 'otp'
                  ? `We sent a 6-digit code to +233 ${phone.replace(/^0+/, '').replace(/\s+/g, '')}`
                  : authMode === 'signup' 
                    ? 'Create a free account to see agents in your selected area and message them directly.'
                    : 'Sign in to continue finding agents in your area.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Phone Form */}
        {step === 'form' && (
          <form onSubmit={handlePhoneSubmit} className="mt-4 space-y-4">
            {authMode === 'signup' && (
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder="Kwame"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  autoComplete="given-name"
                  maxLength={50}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Phone Number
              </Label>
              <div className="flex gap-2">
                <div className="flex items-center justify-center px-3 bg-muted rounded-md border border-input text-sm text-muted-foreground">
                  +233
                </div>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="54 123 4567"
                  value={phone}
                  onChange={(e) => {
                    // Remove non-digits and strip leading 0 since +233 is already shown
                    const cleaned = e.target.value.replace(/[^0-9\s]/g, '').replace(/^0+/, '');
                    setPhone(cleaned);
                  }}
                  required
                  autoComplete="tel"
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                We'll send you a one-time verification code
              </p>
            </div>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading || !phone.trim() || (authMode === 'signup' && !firstName.trim())}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send Code
            </Button>
          </form>
        )}

        {/* OTP Verification */}
        {step === 'otp' && (
          <div className="mt-4 space-y-4">
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={otpCode}
                onChange={(value) => setOtpCode(value)}
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
              className="w-full" 
              disabled={isLoading || otpCode.length !== 6}
              onClick={handleOtpVerify}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verify
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Didn't receive a code?{' '}
              <button
                type="button"
                onClick={handleResendOtp}
                className="text-primary hover:underline font-medium"
                disabled={isLoading}
              >
                Resend
              </button>
            </p>
          </div>
        )}

        {/* Toggle between login/signup */}
        {step === 'form' && (
          <div className="mt-4 text-center text-sm text-muted-foreground">
            {authMode === 'signup' ? (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setAuthMode('login'); setError(null); }}
                  className="text-primary hover:underline font-medium"
                >
                  Sign in
                </button>
              </>
            ) : (
              <>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setAuthMode('signup'); setError(null); }}
                  className="text-primary hover:underline font-medium"
                >
                  Create one
                </button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
