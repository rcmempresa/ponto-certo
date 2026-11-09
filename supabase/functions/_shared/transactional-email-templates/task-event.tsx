import * as React from 'npm:react@18.3.1';
import { Html, Head, Preview, Body, Container, Heading, Text, Button, Hr } from 'npm:@react-email/components@0.0.22';
import type { TemplateEntry } from './registry.ts';
interface Props { titulo?: string; descricao?: string; inicio?: string; dias?: number; concluida?: boolean; conclusao?: string }
const TaskEmail = ({titulo='Tarefa',descricao='',inicio='',dias,concluida=false,conclusao=''}: Props) => (
 <Html lang="pt"><Head/><Preview>{concluida ? 'Tarefa concluída' : `Lembrete de tarefa: ${dias} dias`} — {titulo}</Preview>
 <Body style={{backgroundColor:'#ffffff',fontFamily:'Arial, sans-serif',color:'#0f172a'}}>
 <Container style={{padding:'32px 24px',maxWidth:'560px'}}>
 <Text style={{color:'#64748b'}}>PicaPonto · Nuno Robinson</Text>
 <Heading>{concluida ? 'Tarefa concluída' : 'Lembrete de tarefa'}</Heading>
 <Heading as="h2" style={{fontSize:'20px'}}>{titulo}</Heading>
 {descricao && <Text style={{whiteSpace:'pre-wrap'}}>{descricao}</Text>}
 <Text>Início: {inicio}</Text>
 <Text>{concluida ? `Concluída em: ${conclusao}` : `Lembrete: ${dias} dias após o início`}</Text>
 <Hr/>
 <Button href="https://picaponto.nrtechsolucion.pt/admin/tarefas" style={{backgroundColor:'#0f172a',color:'#ffffff',padding:'12px 20px',borderRadius:'6px'}}>Ver tarefa</Button>
 </Container></Body></Html>
);
export const template = {
 component: TaskEmail,
 subject: (data: Record<string, unknown>) => `${data.concluida ? 'Tarefa concluída' : 'Lembrete de tarefa'}: ${data.titulo || 'PicaPonto'}`,
 displayName: 'Tarefas — lembrete e conclusão',
 to: 'geral@nrtechsolucion.pt',
 previewData: {titulo:'Envio de material para Metrobeiras pela Logislink',inicio:'07/11/2026',dias:2},
} satisfies TemplateEntry;
