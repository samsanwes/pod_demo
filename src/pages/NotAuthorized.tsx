import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/shared/Logo';
import { useAuth } from '@/lib/auth';

export function NotAuthorizedPage() {
  const { signOut, profile } = useAuth();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-8 text-center">
      <Logo className="mb-6" />
      <h1 className="font-display text-3xl font-bold">Access denied</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {profile
          ? 'Your account is signed in, but your role does not have access to this view.'
          : 'Your account is signed in, but no role has been assigned yet. Please contact the Press & Media Manager.'}
      </p>
      <div className="mt-6 flex gap-2">
        <Button asChild variant="outline">
          <Link to="/">Home</Link>
        </Button>
        <Button onClick={() => signOut()}>Sign out</Button>
      </div>
    </div>
  );
}
