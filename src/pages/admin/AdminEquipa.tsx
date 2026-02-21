import { useState, useEffect } from 'react';
import { Users, Pencil, Loader2, Shield, User, Briefcase, Calendar, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  AlertDialogTrigger,
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
  const [filteredProfiles, setFilteredProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    nome: '',
    cargo: '',
    saldo_ferias: 22,
    role: 'user',
  });

  useEffect(() => {
    fetchProfiles();
  }, []);

  useEffect(() => {
    const filtered = profiles.filter(profile =>
      profile.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
      profile.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (profile.cargo?.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    setFilteredProfiles(filtered);
  }, [searchQuery, profiles]);

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
      setFilteredProfiles(profilesWithRoles);
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

  const handleDelete = async (profile: Profile) => {
    setDeletingId(profile.id);
    
    // Delete all related data first
    await Promise.all([
      supabase.from('ponto').delete().eq('user_id', profile.id),
      supabase.from('ferias').delete().eq('user_id', profile.id),
      supabase.from('faltas').delete().eq('user_id', profile.id),
      supabase.from('horas_extra').delete().eq('user_id', profile.id),
      supabase.from('notifications').delete().eq('user_id', profile.id),
      supabase.from('documento_permissoes').delete().eq('user_id', profile.id),
      supabase.from('user_roles').delete().eq('user_id', profile.id),
    ]);

    const { error } = await supabase.from('profiles').delete().eq('id', profile.id);

    if (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível eliminar o colaborador.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Colaborador eliminado',
        description: `${profile.nome} foi removido do sistema.`,
      });
      fetchProfiles();
    }
    setDeletingId(null);
  };

  const adminCount = profiles.filter(p => p.role === 'admin').length;
  const userCount = profiles.filter(p => p.role === 'user').length;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent p-8 md:p-10">
        <div className="absolute inset-0 bg-grid-white/10" />
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20">
                <Users className="h-5 w-5 text-primary" />
              </div>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
              Gestão de Equipa
            </h1>
            <p className="text-muted-foreground text-lg">
              Gerir perfis e permissões dos colaboradores
            </p>
          </div>
          
          {/* Quick Stats */}
          <div className="flex gap-4">
            <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-background/80 backdrop-blur border border-border/50">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{adminCount}</p>
                <p className="text-xs text-muted-foreground">Admins</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-background/80 backdrop-blur border border-border/50">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <User className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{userCount}</p>
                <p className="text-xs text-muted-foreground">Colaboradores</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          placeholder="Pesquisar por nome, email ou cargo..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-12 h-12 text-base rounded-xl border-border/50 bg-card"
        />
      </div>

      {/* Team Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProfiles.map((profile, index) => (
            <div 
              key={profile.id} 
              className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-6 hover:border-primary/30 hover:shadow-lg transition-all duration-300"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Background decoration */}
              <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br from-primary/10 to-transparent blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <div className="relative">
                <div className="flex items-start justify-between mb-5">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-14 w-14 ring-2 ring-background shadow-lg">
                      <AvatarFallback className="bg-gradient-to-br from-primary/30 to-primary/10 text-primary font-semibold text-lg">
                        {getInitials(profile.nome || 'U')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-semibold text-lg truncate group-hover:text-primary transition-colors">
                        {profile.nome || 'Sem nome'}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {profile.email}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-5">
                  <Badge 
                    variant={profile.role === 'admin' ? 'default' : 'secondary'}
                    className={profile.role === 'admin' 
                      ? 'bg-primary/10 text-primary border-primary/30 hover:bg-primary/20' 
                      : 'bg-muted text-muted-foreground'
                    }
                  >
                    {profile.role === 'admin' ? (
                      <>
                        <Shield className="mr-1.5 h-3 w-3" />
                        Administrador
                      </>
                    ) : (
                      <>
                        <User className="mr-1.5 h-3 w-3" />
                        Colaborador
                      </>
                    )}
                  </Badge>
                </div>

                <div className="space-y-3 mb-5">
                  <div className="flex items-center gap-3 text-sm">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/50">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">Cargo</p>
                      <p className="font-medium">{profile.cargo || '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/50">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">Dias de Férias</p>
                      <p className="font-medium">
                        {Number.isInteger(profile.saldo_ferias) 
                          ? profile.saldo_ferias 
                          : profile.saldo_ferias.toFixed(1).replace('.', ',')} dias
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 rounded-xl border-border/50 hover:bg-primary/5 hover:text-primary hover:border-primary/30 transition-all"
                    onClick={() => handleEdit(profile)}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl border-border/50 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-all"
                        disabled={deletingId === profile.id}
                      >
                        {deletingId === profile.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Eliminar colaborador?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação irá eliminar permanentemente <strong>{profile.nome}</strong> e todos os seus registos (ponto, férias, faltas, horas extra). Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(profile)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {filteredProfiles.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted/50 mb-4">
            <Users className="h-10 w-10 text-muted-foreground/50" />
          </div>
          <p className="text-lg font-medium text-muted-foreground">
            Nenhum colaborador encontrado
          </p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Tente ajustar a sua pesquisa
          </p>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl">Editar Colaborador</DialogTitle>
            <DialogDescription>
              Alterar informações e permissões do colaborador.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label htmlFor="nome" className="text-sm font-medium">Nome</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cargo" className="text-sm font-medium">Cargo</Label>
              <Input
                id="cargo"
                value={formData.cargo}
                onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                placeholder="Ex: Desenvolvedor, Designer..."
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="saldo_ferias" className="text-sm font-medium">Dias de Férias</Label>
              <Input
                id="saldo_ferias"
                type="number"
                min={0}
                step={0.5}
                value={formData.saldo_ferias}
                onChange={(e) => setFormData({ ...formData, saldo_ferias: parseFloat(e.target.value) || 0 })}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role" className="text-sm font-medium">Permissão</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Colaborador
                    </div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Administrador
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} className="rounded-xl">
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={submitting} className="rounded-xl">
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  A guardar...
                </>
              ) : (
                'Guardar Alterações'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
