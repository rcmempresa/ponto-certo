import type { Json } from '@/integrations/supabase/types';

export const ACTIVITY_ACTIONS = {
  criou: 'Criação',
  editou: 'Edição',
  aprovou: 'Aprovação',
  rejeitou: 'Rejeição',
  eliminou: 'Eliminação',
  concluiu: 'Conclusão',
  exportou: 'Exportação',
  visualizou: 'Visualização',
} as const;

export const ACTIVITY_ENTITIES = {
  ponto: 'Ponto',
  ferias: 'Férias',
  faltas: 'Faltas',
  baixas_medicas: 'Baixas médicas',
  horas_extra: 'Horas extra',
  folgas_trabalhadas: 'Folgas trabalhadas',
  profiles: 'Equipa',
  user_roles: 'Permissões',
  documentos: 'Documentos',
  documento_categorias: 'Categorias',
  documento_subcategorias: 'Subcategorias',
  documento_permissoes: 'Acessos a documentos',
  tarefas: 'Tarefas',
  relatorios: 'Relatórios',
  painel_colaborador: 'Painel do colaborador',
} as const;

const DETAIL_LABELS: Record<string, string> = {
  campos_alterados: 'Campos alterados',
  estado: 'Estado',
  data: 'Data',
  data_inicio: 'Início',
  data_fim: 'Fim',
  categoria: 'Categoria',
  tipo: 'Tipo',
  formato: 'Formato',
  relatorio: 'Relatório',
  mes: 'Mês',
  colaboradores: 'Colaboradores',
};

export type ActivityAction = keyof typeof ACTIVITY_ACTIONS;
export type ActivityEntity = keyof typeof ACTIVITY_ENTITIES;

export function activityActionLabel(action: string) {
  return ACTIVITY_ACTIONS[action as ActivityAction] ?? action;
}

export function activityEntityLabel(entity: string) {
  return ACTIVITY_ENTITIES[entity as ActivityEntity] ?? entity;
}

export function sanitizeActivitySearch(value: string) {
  return value.replace(/[(),%]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
}

export function activityDetailLines(details: Json): string[] {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return [];
  return Object.entries(details).flatMap(([key, value]) => {
    if (value === null || value === undefined) return [];
    const printable = Array.isArray(value) ? value.join(', ') : typeof value === 'object' ? JSON.stringify(value) : String(value);
    if (!printable) return [];
    return [`${DETAIL_LABELS[key] ?? key}: ${printable}`];
  });
}

export function formatActivityDate(value: string) {
  return new Intl.DateTimeFormat('pt-PT', {
    timeZone: 'Atlantic/Madeira',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
