import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, Zap, Users, ArrowLeft, Mail, CheckCircle2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

type AuthMode = 'signin' | 'signup' | 'forgot' | 'reset' | 'verify-email' | 'verified';

export default function Auth() {
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<AuthMode>('signin');
  const [pendingEmail, setPendingEmail] = useState<string>('');
  const { signIn, signUp, resetPassword, updatePassword, resendConfirmationEmail, session, user } = useAuth();
  const navigate = useNavigate();

  // Check URL parameters for different modes
  useEffect(() => {
    if (searchParams.get('mode') === 'reset' && session) {
      setMode('reset');
    } else if (searchParams.get('verified') === 'true') {
      setMode('verified');
      // If user is now verified and logged in, redirect after a moment
      if (user?.email_confirmed_at) {
        setTimeout(() => navigate('/'), 2000);
      }
    }
  }, [searchParams, session, user, navigate]);

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    const { error } = await signIn(email, password);
    setIsLoading(false);

    if (error) {
      if (error.message.includes('Email not confirmed')) {
        setPendingEmail(email);
        setMode('verify-email');
        toast.error('Please verify your email before signing in');
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success('Welcome back!');
      navigate('/');
    }
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const displayName = formData.get('displayName') as string;

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      setIsLoading(false);
      return;
    }

    const { error, needsEmailConfirmation } = await signUp(email, password, displayName);
    setIsLoading(false);

    if (error) {
      if (error.message.includes('already registered')) {
        toast.error('This email is already registered. Try signing in instead.');
      } else {
        toast.error(error.message);
      }
    } else if (needsEmailConfirmation) {
      setPendingEmail(email);
      setMode('verify-email');
      toast.success('Check your email to verify your account!');
    } else {
      toast.success('Account created! Welcome to the league!');
      navigate('/');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;

    const { error } = await resetPassword(email);
    setIsLoading(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Check your email for a password reset link!');
      setMode('signin');
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    const formData = new FormData(e.currentTarget);
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      setIsLoading(false);
      return;
    }

    const { error } = await updatePassword(password);
    setIsLoading(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Password updated successfully!');
      navigate('/');
    }
  };

  const handleResendEmail = async () => {
    if (!pendingEmail) {
      toast.error('No email address to resend to');
      return;
    }

    setIsLoading(true);
    const { error } = await resendConfirmationEmail(pendingEmail);
    setIsLoading(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Verification email sent! Check your inbox.');
    }
  };

  // Email verified success screen
  if (mode === 'verified') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 pb-24">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
            className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6"
          >
            <CheckCircle2 className="w-10 h-10 text-primary" />
          </motion.div>
          
          <h1 className="text-2xl font-display font-bold mb-2">Email Verified!</h1>
          <p className="text-muted-foreground mb-6">
            Your account is now active. Redirecting you...
          </p>
          
          <Button onClick={() => navigate('/')} className="w-full max-w-xs">
            Continue to App
          </Button>
        </motion.div>
      </div>
    );
  }

  // Email verification pending screen
  if (mode === 'verify-email') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 pb-24">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="flex items-center justify-center gap-2 mb-2">
            <Trophy className="w-10 h-10 text-primary" />
            <h1 className="text-3xl font-display font-bold gradient-text">ProGrind</h1>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="w-full max-w-md"
        >
          <Card className="border-border/50 shadow-elevated">
            <CardHeader className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.3 }}
                className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4"
              >
                <Mail className="w-8 h-8 text-primary" />
              </motion.div>
              <CardTitle className="font-display">Check Your Email</CardTitle>
              <CardDescription className="text-base">
                We've sent a verification link to
              </CardDescription>
              {pendingEmail && (
                <p className="font-medium text-foreground mt-1">{pendingEmail}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <p className="text-sm text-muted-foreground">
                  Click the link in your email to verify your account and start competing with friends.
                </p>
                <p className="text-sm text-muted-foreground">
                  The link will expire in 24 hours.
                </p>
              </div>

              <div className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleResendEmail}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Resend Verification Email
                    </>
                  )}
                </Button>

                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setMode('signin');
                    setPendingEmail('');
                  }}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Sign In
                </Button>
              </div>

              <p className="text-xs text-center text-muted-foreground">
                Didn't receive the email? Check your spam folder or try resending.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Password reset form (when user clicks email link)
  if (mode === 'reset') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 pb-24">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="flex items-center justify-center gap-2 mb-2">
            <Trophy className="w-10 h-10 text-primary" />
            <h1 className="text-3xl font-display font-bold gradient-text">ProGrind</h1>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="w-full max-w-md"
        >
          <Card className="border-border/50 shadow-elevated">
            <CardHeader>
              <CardTitle className="font-display">Set New Password</CardTitle>
              <CardDescription>Enter your new password below</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    minLength={6}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input
                    id="confirm-password"
                    name="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    minLength={6}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Updating...' : 'Update Password'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Forgot password form
  if (mode === 'forgot') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 pb-24">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="flex items-center justify-center gap-2 mb-2">
            <Trophy className="w-10 h-10 text-primary" />
            <h1 className="text-3xl font-display font-bold gradient-text">ProGrind</h1>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="w-full max-w-md"
        >
          <Card className="border-border/50 shadow-elevated">
            <CardHeader>
              <Button
                variant="ghost"
                size="sm"
                className="w-fit -ml-2 mb-2"
                onClick={() => setMode('signin')}
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back to Sign In
              </Button>
              <CardTitle className="font-display">Reset Password</CardTitle>
              <CardDescription>
                Enter your email and we'll send you a reset link
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgot-email">Email</Label>
                  <Input
                    id="forgot-email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Sending...' : 'Send Reset Link'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 pb-24">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          <Trophy className="w-10 h-10 text-primary" />
          <h1 className="text-3xl font-display font-bold gradient-text">ProGrind</h1>
        </div>
        <p className="text-muted-foreground">Fantasy football for productivity</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="w-full max-w-md"
      >
        <Card className="border-border/50 shadow-elevated">
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 m-1" style={{ width: 'calc(100% - 8px)' }}>
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <CardHeader>
                <CardTitle className="font-display">Welcome Back</CardTitle>
                <CardDescription>Sign in to continue your grind</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      name="email"
                      type="email"
                      placeholder="you@example.com"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="signin-password">Password</Label>
                      <Button
                        type="button"
                        variant="link"
                        className="px-0 h-auto text-xs text-muted-foreground"
                        onClick={() => setMode('forgot')}
                      >
                        Forgot password?
                      </Button>
                    </div>
                    <Input
                      id="signin-password"
                      name="password"
                      type="password"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? 'Signing in...' : 'Sign In'}
                  </Button>
                </form>
              </CardContent>
            </TabsContent>

            <TabsContent value="signup">
              <CardHeader>
                <CardTitle className="font-display">Join the League</CardTitle>
                <CardDescription>Create your account and start competing</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Display Name</Label>
                    <Input
                      id="signup-name"
                      name="displayName"
                      type="text"
                      placeholder="Your name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      name="email"
                      type="email"
                      placeholder="you@example.com"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      name="password"
                      type="password"
                      placeholder="••••••••"
                      minLength={6}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Must be at least 6 characters
                    </p>
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? 'Creating account...' : 'Create Account'}
                  </Button>
                </form>
              </CardContent>
            </TabsContent>
          </Tabs>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex items-center gap-6 mt-8 text-muted-foreground text-sm"
      >
        <div className="flex items-center gap-1">
          <Zap className="w-4 h-4 text-primary" />
          <span>Daily Tasks</span>
        </div>
        <div className="flex items-center gap-1">
          <Users className="w-4 h-4 text-secondary" />
          <span>Compete Weekly</span>
        </div>
        <div className="flex items-center gap-1">
          <Trophy className="w-4 h-4 text-pending" />
          <span>Win Seasons</span>
        </div>
      </motion.div>
    </div>
  );
}
