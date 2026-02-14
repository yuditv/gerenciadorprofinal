import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AdminEditUserDialogProps {
  open: boolean;
  onClose: () => void;
  user: { id: string; email: string; profile?: { display_name: string | null } | null } | null;
  onUpdated: () => void;
}

export function AdminEditUserDialog({ open, onClose, user, onUpdated }: AdminEditUserDialogProps) {
  const { toast } = useToast();
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleUpdateEmail = async () => {
    if (!user || !newEmail.trim()) return;
    setIsSaving(true);
    try {
      const response = await fetch(
        `https://tlanmmbgyyxuqvezudir.supabase.co/functions/v1/admin-users?action=update-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({ userId: user.id, email: newEmail.trim() }),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Falha ao atualizar email');
      toast({ title: 'Sucesso', description: 'Email atualizado com sucesso' });
      setNewEmail('');
      onUpdated();
      onClose();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!user || !newPassword.trim()) return;
    if (newPassword !== confirmPassword) {
      toast({ title: 'Erro', description: 'As senhas não coincidem', variant: 'destructive' });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: 'Erro', description: 'Senha deve ter no mínimo 6 caracteres', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch(
        `https://tlanmmbgyyxuqvezudir.supabase.co/functions/v1/admin-users?action=update-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({ userId: user.id, password: newPassword }),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Falha ao atualizar senha');
      toast({ title: 'Sucesso', description: 'Senha atualizada com sucesso' });
      setNewPassword('');
      setConfirmPassword('');
      onUpdated();
      onClose();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass-card border-primary/20 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Editar Usuário: {user?.profile?.display_name || user?.email}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="email" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="email" className="flex-1">
              <Mail className="h-4 w-4 mr-2" />
              Email
            </TabsTrigger>
            <TabsTrigger value="password" className="flex-1">
              <Lock className="h-4 w-4 mr-2" />
              Senha
            </TabsTrigger>
          </TabsList>

          <TabsContent value="email" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground">Email atual</Label>
              <Input value={user?.email || ''} disabled className="opacity-60" />
            </div>
            <div className="space-y-2">
              <Label>Novo email</Label>
              <Input
                type="email"
                placeholder="novo@email.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
            <Button
              onClick={handleUpdateEmail}
              disabled={isSaving || !newEmail.trim()}
              className="w-full"
            >
              {isSaving ? 'Salvando...' : 'Atualizar Email'}
            </Button>
          </TabsContent>

          <TabsContent value="password" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Nova senha</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mínimo 6 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Confirmar senha</Label>
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Repita a senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <Button
              onClick={handleUpdatePassword}
              disabled={isSaving || !newPassword.trim() || !confirmPassword.trim()}
              className="w-full"
            >
              {isSaving ? 'Salvando...' : 'Atualizar Senha'}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
