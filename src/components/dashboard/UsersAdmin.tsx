import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { UserRole, UserRow } from '@/lib/database.types';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { titleCase, formatDateTime } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

const ROLES: UserRole[] = ['manager', 'production', 'bookstore'];

export function UsersAdmin() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);

  async function reload() {
    setLoading(true);
    const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false });
    setUsers((data ?? []) as UserRow[]);
    setLoading(false);
  }

  useEffect(() => { reload(); }, []);

  async function setActive(u: UserRow, next: boolean) {
    await supabase.from('users').update({ is_active: next }).eq('id', u.id);
    await reload();
  }

  async function changeRole(u: UserRow, role: UserRole) {
    await supabase.from('users').update({ role }).eq('id', u.id);
    await reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Users</h1>
          <p className="text-sm text-muted-foreground">Staff accounts with dashboard access.</p>
        </div>
        <Button onClick={() => setCreating(true)}><Plus className="mr-1 h-4 w-4" />Add user</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last sign-in</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
              {!loading && users.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No users yet.</TableCell></TableRow>}
              {users.map((u) => {
                const isSelf = u.id === currentUser?.id;
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      {u.name}
                      {isSelf && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                    </TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <Select value={u.role} onValueChange={(v) => changeRole(u, v as UserRole)} disabled={isSelf}>
                        <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => <SelectItem key={r} value={r}>{titleCase(r)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {u.is_active ? <Badge variant="success">Active</Badge> : <Badge variant="muted">Disabled</Badge>}
                    </TableCell>
                    <TableCell className="text-sm">{u.last_login_at ? formatDateTime(u.last_login_at) : '—'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setActive(u, !u.is_active)} disabled={isSelf}>
                          {u.is_active ? 'Disable' : 'Enable'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setDeleteTarget(u)}
                          disabled={isSelf}
                          title={isSelf ? "You can't delete your own account" : 'Delete user permanently'}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {creating && <CreateUserDialog onClose={() => { setCreating(false); reload(); }} />}
      {deleteTarget && (
        <DeleteUserDialog
          user={deleteTarget}
          onClose={(deleted) => {
            setDeleteTarget(null);
            if (deleted) reload();
          }}
        />
      )}
    </div>
  );
}

function CreateUserDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('production');
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!name.trim() || !email.trim()) return;
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke('create-user', {
        body: { name, email, role },
      });
      if (error) throw error;
      toast({ title: 'User created', description: 'A magic-link invitation has been emailed.' });
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ variant: 'destructive', title: 'Create failed', description: msg });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add user</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Full name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => <SelectItem key={r} value={r}>{titleCase(r)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={create} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create & invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteUserDialog({ user, onClose }: { user: UserRow; onClose: (deleted: boolean) => void }) {
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);

  const canConfirm = confirmText === user.email && !busy;

  async function remove() {
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke('delete-user', {
        body: { user_id: user.id },
      });
      if (error) throw error;
      toast({ title: 'User deleted', description: `${user.name} (${user.email}) removed.` });
      onClose(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ variant: 'destructive', title: 'Delete failed', description: msg });
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete user</DialogTitle>
          <DialogDescription>
            Permanently remove <strong>{user.name}</strong> ({user.email}). Any historical
            attribution in orders and the audit log will be set to <em>"System"</em>.
            This action can't be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>
              Type <code className="rounded bg-muted px-1 text-xs">{user.email}</code> to confirm
            </Label>
            <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={user.email} autoFocus />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onClose(false)}>Cancel</Button>
          <Button variant="destructive" onClick={remove} disabled={!canConfirm}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            Delete permanently
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
