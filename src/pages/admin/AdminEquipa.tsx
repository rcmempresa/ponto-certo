import { useState, useEffect } from 'react';
import { Users, Plus, Pencil, Trash2, Loader2, Shield, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Profile {
  id: string;
  email: string;
  nome: string;
  cargo: string | null;
  saldo_ferias: number;
  role?: string;
}

export default function AdminEquipa() {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    nome: '',
    cargo: '',
    saldo_ferias: 22,
    role: 'user',
  });

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('*')
      .order('nome');

    const { data: rolesData } = await supabase
      .from('user_roles')
      .select('user_id, role');

    if (profilesData) {
      const profilesWithRoles = profilesData.map((profile) => {
        const roleEntry = rolesData?.find((r) => r.user_id === profile.id);
        return {
          ...profile,
          role: roleEntry?.role || 'user',
        };
      });
      setProfiles(profilesWithRoles);
    }

    setLoading(false);
  };

  const handleEdit = (profile: Profile) => {
    setSelectedProfile(profile);
    setFormData({
      nome: profile.nome,
      cargo: profile.cargo || '',
      saldo_ferias: profile.saldo_ferias,
      role: profile.role || 'user',
    });
    setEditDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedProfile) return;

    setSubmitting(true);

    // Update profile
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        nome: formData.nome,
        cargo: formData.cargo,
        saldo_ferias: formData.saldo_ferias,
      })
      .eq('id', selectedProfile.id);

    if (profileError) {
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o perfil.',
        variant: 'destructive',
      });
      setSubmitting(false);
      return;
    }

    // Update role if changed
    if (formData.role !== selectedProfile.role) {
      // First delete existing role
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', selectedProfile.id);

      // Insert new role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: selectedProfile.id,
          role: formData.role as 'admin' | 'user',
        });

      if (roleError) {
        toast({
          title: 'Aviso',
          description: 'Perfil atualizado mas ocorreu um erro ao alterar a role.',
          variant: 'destructive',
        });
      }
    }

    toast({
      title: 'Perfil atualizado',
      description: 'As alterações foram guardadas com sucesso.',
    });

    setEditDialogOpen(false);
    setSelectedProfile(null);
    fetchProfiles();
    setSubmitting(false);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Gestão de Equipa</h1>
          <p className="text-muted-foreground">Gerir perfis e permissões dos colaboradores</p>
        </div>
      </div>

      {/* Team Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {profiles.map((profile) => (
            <Card key={profile.id} className="border-0 shadow-soft">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {getInitials(profile.nome || 'U')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{profile.nome || 'Sem nome'}</p>
                      <p className="text-sm text-muted-foreground">{profile.email}</p>
                    </div>
                  </div>
                  <Badge variant={profile.role === 'admin' ? 'default' : 'secondary'}>
                    {profile.role === 'admin' ? (
                      <>
                        <Shield className="mr-1 h-3 w-3" />
                        Admin
                      </>
                    ) : (
                      <>
                        <User className="mr-1 h-3 w-3" />
                        User
                      </>
                    )}
                  </Badge>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Cargo</span>
                    <span>{profile.cargo || '—'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Dias de Férias</span>
                    <span className="font-medium">{profile.saldo_ferias}</span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => handleEdit(profile)}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Colaborador</DialogTitle>
            <DialogDescription>
              Alterar informações e permissões do colaborador.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cargo">Cargo</Label>
              <Input
                id="cargo"
                value={formData.cargo}
                onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                placeholder="Ex: Desenvolvedor, Designer..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="saldo_ferias">Dias de Férias</Label>
              <Input
                id="saldo_ferias"
                type="number"
                min={0}
                value={formData.saldo_ferias}
                onChange={(e) => setFormData({ ...formData, saldo_ferias: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Permissão</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Colaborador</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  A guardar...
                </>
              ) : (
                'Guardar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
