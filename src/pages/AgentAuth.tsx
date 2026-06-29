import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertCircle, Phone, Mail, ArrowLeft, MapPin, Plus, X } from 'lucide-react';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import logo from '@/assets/logo.png';
import { setUserRole } from '@/hooks/useUserRole';

type AuthStep = 'form' | 'otp';

export default function AgentAuth() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState<'signin' | 'create'>('signin');
  const [step, setStep] = useState<AuthStep>('form');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Sign-in form
  const [signInPhone, setSignInPhone] = useState('');
  const [signInOtp, setSignInOtp] = useState('');
  
  // Create profile form
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [primaryArea, setPrimaryArea] = useState('');
  const [coveredAreas, setCoveredAreas] = useState<string[]>([]);
  const [newArea, setNewArea] = useState('');
  const [tiktokHandle, setTiktokHandle] = useState('');
  const [createOtp, setCreateOtp] = useState('');

  // Check if agent is already signed in
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Check if user has a claimed agent profile
        const { data: agent } = await supabase
          .from('agents')
          .select('id')
          .eq('claimed_by', session.user.id)
          .maybeSingle();
        
        if (agent) {
          navigate('/agent-dashboard');
        }
      }
    };
    checkAuth();
  }, [navigate]);

  const formatPhone = (input: string) => {
    // Remove all non-digits
    let digits = input.replace(/\D/g, '');
    
    // If starts with 233, remove it
    if (digits.startsWith('233')) {
      digits = digits.slice(3);
    }
    // If starts with 0, remove it
    if (digits.startsWith('0')) {
      digits = digits.slice(1);
    }
    
    return digits;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const formattedPhone = formatPhone(signInPhone);
      const fullPhone = `+233${formattedPhone}`;
      
      const { data, error: fnError } = await supabase.functions.invoke('claim-profile', {
        body: { action: 'agent-signin', phone: fullPhone },
      });

      if (fnError || !data?.success) {
        throw new Error(data?.error || fnError?.message || 'Failed to send OTP');
      }

      toast({
        title: 'Code sent!',
        description: 'Check your phone for the verification code.',
      });
      setStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send verification code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifySignIn = async () => {
    if (signInOtp.length !== 6) return;
    setIsLoading(true);
    setError(null);

    try {
      const formattedPhone = formatPhone(signInPhone);
      const fullPhone = `+233${formattedPhone}`;
      
      const { data, error: fnError } = await supabase.functions.invoke('claim-profile', {
        body: { action: 'agent-verify-signin', phone: fullPhone, otp: signInOtp },
      });

      if (fnError || !data?.success) {
        throw new Error(data?.error || fnError?.message || 'Verification failed');
      }

      // Sign in with the returned token
      if (data.token) {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: data.token,
          type: 'magiclink',
        });

        if (verifyError) {
          throw verifyError;
        }
      }

      // Set role to agent with phone number
      setUserRole('agent', fullPhone);
      
      toast({
        title: 'Welcome back!',
        description: 'You are now signed in.',
      });
      navigate('/agent-dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const formattedPhone = formatPhone(phone);
      const fullPhone = `+233${formattedPhone}`;
      
      const { data, error: fnError } = await supabase.functions.invoke('claim-profile', {
        body: { 
          action: 'create-agent-profile',
          displayName: displayName.trim(),
          phone: fullPhone,
          email: email.trim() || null,
          primaryArea: primaryArea.trim(),
          coveredAreas: coveredAreas,
          tiktokHandle: tiktokHandle.trim() || null,
        },
      });

      if (fnError || !data?.success) {
        throw new Error(data?.error || fnError?.message || 'Failed to create profile');
      }

      toast({
        title: 'Code sent!',
        description: 'Verify your phone to complete profile creation.',
      });
      setStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCreate = async () => {
    if (createOtp.length !== 6) return;
    setIsLoading(true);
    setError(null);

    try {
      const formattedPhone = formatPhone(phone);
      const fullPhone = `+233${formattedPhone}`;
      
      const { data, error: fnError } = await supabase.functions.invoke('claim-profile', {
        body: { 
          action: 'verify-create-profile',
          phone: fullPhone,
          otp: createOtp,
          displayName: displayName.trim(),
          email: email.trim() || null,
          primaryArea: primaryArea.trim(),
          coveredAreas: coveredAreas,
          tiktokHandle: tiktokHandle.trim() || null,
        },
      });

      if (fnError || !data?.success) {
        throw new Error(data?.error || fnError?.message || 'Verification failed');
      }

      // Sign in with the returned token
      if (data.token) {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: data.token,
          type: 'magiclink',
        });

        if (verifyError) {
          throw verifyError;
        }
      }

      // Set role to agent with phone number
      setUserRole('agent', fullPhone);
      
      toast({
        title: 'Profile created!',
        description: 'Your agent profile is now live.',
      });
      navigate('/agent-dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  const addCoveredArea = () => {
    const area = newArea.trim();
    if (area && !coveredAreas.includes(area)) {
      setCoveredAreas([...coveredAreas, area]);
      setNewArea('');
    }
  };

  const removeCoveredArea = (area: string) => {
    setCoveredAreas(coveredAreas.filter(a => a !== area));
  };

  const handleBack = () => {
    setStep('form');
    setSignInOtp('');
    setCreateOtp('');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src={logo} alt="RentAgentGhana" className="h-16 w-16 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground">Agent Portal</h1>
          <p className="text-muted-foreground mt-1">Manage your conversations with renters</p>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm mb-4">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {step === 'form' ? (
          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as 'signin' | 'create'); setError(null); }}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="create">Create Profile</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="h-5 w-5" />
                    Sign in with Phone
                  </CardTitle>
                  <CardDescription>
                    Enter the phone number linked to your agent profile
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signInPhone">Phone Number</Label>
                      <div className="flex gap-2">
                        <div className="flex items-center justify-center px-3 bg-muted rounded-md border border-input text-sm text-muted-foreground">
                          +233
                        </div>
                        <Input
                          id="signInPhone"
                          type="tel"
                          placeholder="54 123 4567"
                          value={signInPhone}
                          onChange={(e) => setSignInPhone(formatPhone(e.target.value))}
                          required
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoading || !signInPhone.trim()}>
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Send Verification Code
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="create">
              <Card>
                <CardHeader>
                  <CardTitle>Create Your Profile</CardTitle>
                  <CardDescription>
                    Set up your agent profile to start receiving messages from renters
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreateProfile} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="displayName">Display Name *</Label>
                      <Input
                        id="displayName"
                        placeholder="e.g. Kwame Properties"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        required
                        maxLength={100}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number *</Label>
                      <div className="flex gap-2">
                        <div className="flex items-center justify-center px-3 bg-muted rounded-md border border-input text-sm text-muted-foreground">
                          +233
                        </div>
                        <Input
                          id="phone"
                          type="tel"
                          placeholder="54 123 4567"
                          value={phone}
                          onChange={(e) => setPhone(formatPhone(e.target.value))}
                          required
                          className="flex-1"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">This will be used to verify your profile</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email (optional)</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="primaryArea">Primary Area *</Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="primaryArea"
                          placeholder="e.g. East Legon"
                          value={primaryArea}
                          onChange={(e) => setPrimaryArea(e.target.value)}
                          required
                          className="pl-10"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Other Areas Covered</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Add an area"
                          value={newArea}
                          onChange={(e) => setNewArea(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCoveredArea(); } }}
                        />
                        <Button type="button" variant="outline" size="icon" onClick={addCoveredArea}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      {coveredAreas.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {coveredAreas.map((area) => (
                            <span
                              key={area}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded-md text-sm"
                            >
                              {area}
                              <button type="button" onClick={() => removeCoveredArea(area)} aria-label={`Remove ${area}`}>
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="tiktokHandle">TikTok Handle (optional)</Label>
                      <Input
                        id="tiktokHandle"
                        placeholder="@yourhandle"
                        value={tiktokHandle}
                        onChange={(e) => setTiktokHandle(e.target.value)}
                      />
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={isLoading || !displayName.trim() || !phone.trim() || !primaryArea.trim()}
                    >
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Create Profile & Verify Phone
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                  <CardTitle>Enter verification code</CardTitle>
                  <CardDescription>
                    We sent a 6-digit code to +233{activeTab === 'signin' ? signInPhone : phone}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={activeTab === 'signin' ? signInOtp : createOtp}
                  onChange={(value) => activeTab === 'signin' ? setSignInOtp(value) : setCreateOtp(value)}
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
                disabled={isLoading || (activeTab === 'signin' ? signInOtp.length !== 6 : createOtp.length !== 6)}
                onClick={activeTab === 'signin' ? handleVerifySignIn : handleVerifyCreate}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verify & Continue
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Didn't receive a code?{' '}
                <button
                  type="button"
                  onClick={() => {
                    if (activeTab === 'signin') {
                      setSignInOtp('');
                      handleSignIn(new Event('submit') as unknown as React.FormEvent);
                    } else {
                      setCreateOtp('');
                      handleCreateProfile(new Event('submit') as unknown as React.FormEvent);
                    }
                  }}
                  className="text-primary hover:underline font-medium"
                  disabled={isLoading}
                >
                  Resend
                </button>
              </p>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-sm text-muted-foreground mt-6">
          <button onClick={() => navigate('/')} className="text-primary hover:underline">
            ← Back to home
          </button>
        </p>
      </div>
    </div>
  );
}
