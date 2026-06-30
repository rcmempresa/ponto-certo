import { useState } from 'react';
import { Clock, Calendar, FileText, FolderOpen, Users, CheckSquare, BarChart3, LogOut, ArrowLeftRight, Timer, ClipboardList, CalendarCheck } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

const userMenuItems = [
  { title: 'Dashboard', url: '/dashboard', icon: Clock },
  { title: 'Férias', url: '/ferias', icon: Calendar },
  { title: 'Faltas', url: '/faltas', icon: FileText },
  { title: 'Horas Extra', url: '/horas-extra', icon: Timer },
  { title: 'Folgas e Feriados', url: '/folgas-trabalhadas', icon: CalendarCheck },
  { title: 'Documentos', url: '/documentos', icon: FolderOpen },
];

const adminMenuItems = [
  { title: 'Painel RH', url: '/admin', icon: BarChart3 },
  { title: 'Equipa', url: '/admin/equipa', icon: Users },
  { title: 'Ponto', url: '/admin/ponto', icon: Clock },
  { title: 'Horas Extra', url: '/admin/horas-extra', icon: Timer },
  { title: 'Folgas e Feriados', url: '/admin/folgas-trabalhadas', icon: CalendarCheck },
  { title: 'Relatórios', url: '/admin/relatorios', icon: ClipboardList },
  { title: 'Aprovações', url: '/admin/aprovacoes', icon: CheckSquare },
  { title: 'Documentos', url: '/admin/documentos', icon: FolderOpen },
];

export function AppSidebar() {
  const { profile, isAdmin, signOut } = useAuth();
  const [viewMode, setViewMode] = useState<'admin' | 'colaborador'>('colaborador');

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const toggleView = () => {
    setViewMode(viewMode === 'admin' ? 'colaborador' : 'admin');
  };

  // Show admin menu only when in admin mode
  const showAdminMenu = isAdmin && viewMode === 'admin';

  return (
    <Sidebar className="border-r-0">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sidebar-accent">
            <Clock className="h-5 w-5 text-sidebar-accent-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-sidebar-foreground">Pica-Ponto</h1>
            <p className="text-xs text-sidebar-foreground/60">Pro</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* View Mode Toggle for Admins */}
        {isAdmin && (
          <div className="px-3 py-4">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleView}
              className="w-full justify-between bg-sidebar-accent/50 border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <span className="flex items-center gap-2">
                <ArrowLeftRight className="h-4 w-4" />
                {viewMode === 'admin' ? 'Modo Admin' : 'Modo Colaborador'}
              </span>
              <Badge 
                variant="secondary" 
                className="text-[10px] px-1.5 py-0 bg-sidebar-accent text-sidebar-foreground"
              >
                Alternar
              </Badge>
            </Button>
          </div>
        )}

        {/* Collaborator Menu - Always visible */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50">
            {isAdmin && viewMode === 'admin' ? 'Meu Portal' : 'Portal'}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {userMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url} 
                      end={item.url === '/dashboard'}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Admin Menu - Only when in admin mode */}
        {showAdminMenu && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/50">Administração</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminMenuItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink 
                        to={item.url} 
                        end={item.url === '/admin'}
                        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-sm">
              {profile?.nome ? getInitials(profile.nome) : 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {profile?.nome || 'Utilizador'}
            </p>
            <p className="text-xs text-sidebar-foreground/60 truncate">
              {isAdmin ? (viewMode === 'admin' ? 'Administrador' : 'Colaborador') : (profile?.cargo || 'Colaborador')}
            </p>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={signOut}
            className="text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
