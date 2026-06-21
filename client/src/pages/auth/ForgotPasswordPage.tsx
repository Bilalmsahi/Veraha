import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForgotPassword, useForgotPasswordVerifyOtp, useResetPasswordWithOtp } from '@/api/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { FormErrorAlert } from '@/components/shared';
import { cn } from '@/lib/utils';

type Step = 'email' | 'otp' | 'password';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const sendOtp = useForgotPassword();
  const verifyOtp = useForgotPasswordVerifyOtp();
  const resetPassword = useResetPasswordWithOtp({
    onSuccess: () => navigate('/dashboard'),
  });

  const onSendCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setFieldErrors({ email: 'Email is required' });
      return;
    }
    setFieldErrors({});
    sendOtp.mutate({ email }, {
      onSuccess: () => setStep('otp'),
    });
  };

  const onVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) return;
    verifyOtp.mutate({ email, otp }, {
      onSuccess: () => setStep('password'),
    });
  };

  const onResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 12) {
      setFieldErrors({ password: 'Password must be at least 12 characters' });
      return;
    }
    if (password !== confirmPassword) {
      setFieldErrors({ confirmPassword: 'Passwords do not match' });
      return;
    }
    setFieldErrors({});
    resetPassword.mutate({ email, password });
  };

  const onResend = () => {
    sendOtp.mutate({ email });
  };

  // Step 3: New password
  if (step === 'password') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Set new password</CardTitle>
          <CardDescription>Choose a strong password for your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onResetPassword} className="space-y-4">
            {resetPassword.error && <FormErrorAlert message={resetPassword.error.message} />}
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className={cn(fieldErrors.password && 'border-destructive')}
              />
              {fieldErrors.password && <p className="text-xs text-destructive">{fieldErrors.password}</p>}
              <p className="text-xs text-muted-foreground">
                12+ chars, uppercase, lowercase, number, special char (@$!%*?&)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
                className={cn(fieldErrors.confirmPassword && 'border-destructive')}
              />
              {fieldErrors.confirmPassword && <p className="text-xs text-destructive">{fieldErrors.confirmPassword}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={resetPassword.isPending}>
              {resetPassword.isPending ? 'Resetting...' : 'Reset password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  // Step 2: Enter OTP
  if (step === 'otp') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Enter verification code</CardTitle>
          <CardDescription>
            We sent a 6-digit code to <strong>{email}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onVerifyCode} className="space-y-4">
            {verifyOtp.error && <FormErrorAlert message={verifyOtp.error.message} />}
            <div className="space-y-2">
              <Label htmlFor="otp">Verification code</Label>
              <Input
                id="otp"
                placeholder="000000"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="text-center text-2xl tracking-[0.3em] font-mono"
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full" disabled={verifyOtp.isPending || otp.length !== 6}>
              {verifyOtp.isPending ? 'Verifying...' : 'Verify code'}
            </Button>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <button type="button" onClick={() => { setStep('email'); setOtp(''); }} className="hover:text-foreground transition">
                &larr; Change email
              </button>
              <button
                type="button"
                onClick={onResend}
                disabled={sendOtp.isPending}
                className="font-medium text-primary hover:underline disabled:opacity-50"
              >
                {sendOtp.isPending ? 'Sending...' : 'Resend code'}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  // Step 1: Enter email
  return (
    <Card>
      <CardHeader>
        <CardTitle>Forgot password</CardTitle>
        <CardDescription>Enter your email and we'll send you a verification code</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSendCode} className="space-y-4">
          {sendOtp.error && <FormErrorAlert message={sendOtp.error.message} />}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={cn(fieldErrors.email && 'border-destructive')}
            />
            {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={sendOtp.isPending}>
            {sendOtp.isPending ? 'Sending...' : 'Send verification code'}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            <Link to="/login" className="font-medium text-primary hover:underline">Back to sign in</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
