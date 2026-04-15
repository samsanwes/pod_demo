import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/shared/Logo';
import { toast } from '@/hooks/use-toast';

export function LoginPage() {
  const { signIn, session, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';

  // If the user is ALREADY signed in when they hit /login, bounce them.
  // Done in useEffect (not during render) so we don't update during render.
  useEffect(() => {
    if (session && !loading) {
      navigate(from, { replace: true });
    }
  }, [session, loading, from, navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await signIn(email, password);
      // Navigate directly — don't rely on the useEffect above racing the state update.
      // React Router handles the unmount and busy state becomes irrelevant.
      navigate(from, { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign-in failed';
      toast({ variant: 'destructive', title: 'Sign in failed', description: message });
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-2">
      <div className="flex items-center justify-center bg-brand-foundations p-8">
        <Logo variant="inverse" size={240} />
      </div>
      <div className="flex items-center justify-center p-8">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-6">
          <div>
            <h1 className="font-display text-3xl font-bold">Staff sign in</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Access the SAIACS POD dashboard.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
          <p className="text-xs text-muted-foreground">
            Accounts are created by the Press &amp; Media Manager. Contact them if you need access.
          </p>
        </form>
      </div>
    </div>
  );
}
