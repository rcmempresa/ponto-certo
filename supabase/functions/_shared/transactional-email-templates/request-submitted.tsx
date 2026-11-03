import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Link, Preview, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  tipo?: 'ferias' | 'falta'
  nome?: string
  periodo?: string
  detalhe?: string
  motivo?: string
  anexoUrl?: string
  link?: string
}

const RequestSubmittedEmail = ({
  tipo = 'ferias',
  nome = 'Um colaborador',
  periodo = '',
  detalhe = '',
  motivo = '',
  anexoUrl,
  link = 'https://picaponto.nrtechsolucion.pt/admin/aprovacoes',
}: Props) => {
  const label = tipo === 'falta' ? 'justificação de falta' : 'pedido de férias'
  return (
    <Html lang="pt" dir="ltr">
      <Head />
      <Preview>{`Novo ${label} de ${nome}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{tipo === 'falta' ? 'Nova justificação de falta' : 'Novo pedido de férias'}</Heading>
          <Text style={text}><strong>{nome}</strong> submeteu um {label} que aguarda aprovação.</Text>
          {periodo ? <Text style={text}><strong>Data:</strong> {periodo}</Text> : null}
          {detalhe ? <Text style={text}><strong>Tipo:</strong> {detalhe}</Text> : null}
          {motivo ? <Text style={text}><strong>Motivo:</strong> {motivo}</Text> : null}
          {anexoUrl ? (
            <Text style={text}><strong>Anexo:</strong> <Link href={anexoUrl} style={linkStyle}>Abrir comprovativo</Link> (link válido 7 dias)</Text>
          ) : null}
          <Button href={link} style={button}>Ver aprovações</Button>
          <Text style={footer}>PicaPonto · Nuno Robinson</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: RequestSubmittedEmail,
  subject: (d: Record<string, any>) =>
    `${d.tipo === 'falta' ? 'Nova justificação de falta' : 'Novo pedido de férias'} — ${d.nome || 'colaborador'}`,
  displayName: 'Novo pedido de férias / falta',
  to: 'geral@nrtechsolucion.pt',
  previewData: { tipo: 'falta', nome: 'Maria Silva', periodo: '05/11/2026', detalhe: 'Dia inteiro', motivo: 'Consulta médica', anexoUrl: 'https://example.com/anexo.pdf' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '520px' }
const h1 = { fontSize: '22px', fontWeight: 600, color: '#1d1d1f', margin: '0 0 16px' }
const text = { fontSize: '15px', lineHeight: '24px', color: '#3a3a3c', margin: '0 0 12px' }
const linkStyle = { color: '#0071e3', textDecoration: 'underline' }
const button = { backgroundColor: '#1d1d1f', color: '#ffffff', borderRadius: '10px', padding: '12px 20px', fontSize: '14px', textDecoration: 'none', marginTop: '8px' }
const footer = { fontSize: '12px', color: '#8e8e93', marginTop: '28px' }
