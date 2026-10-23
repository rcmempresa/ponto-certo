import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  titulo?: string
  categoria?: string
  validade?: string
  dias?: number
  link?: string
}

const DocumentExpiryEmail = ({ titulo = 'Documento', categoria = '', validade = '', dias = 0, link = 'https://picaponto.nrtechsolucion.pt/admin/avisos' }: Props) => {
  const estado = dias < 0 ? `expirou a ${validade}` : dias === 0 ? `expira hoje (${validade})` : `expira em ${dias} dia${dias === 1 ? '' : 's'} (${validade})`
  return (
    <Html lang="pt" dir="ltr">
      <Head />
      <Preview>{`${titulo} ${estado}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Documento a expirar</Heading>
          <Text style={text}>O documento <strong>{titulo}</strong>{categoria ? ` (${categoria})` : ''} {estado}.</Text>
          <Text style={text}>Atualize o documento ou a data de validade no PicaPonto.</Text>
          <Button href={link} style={button}>Ver avisos</Button>
          <Text style={footer}>PicaPonto · Nuno Robinson</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: DocumentExpiryEmail,
  subject: (d: Record<string, any>) => `Aviso: ${d.titulo || 'documento'} está a expirar`,
  displayName: 'Aviso de validade de documento',
  to: 'geral@nrtechsolucion.pt',
  previewData: { titulo: 'Seguro de acidentes de trabalho', categoria: 'Seguros', validade: '06/11/2026', dias: 15 },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '520px' }
const h1 = { fontSize: '22px', fontWeight: 600, color: '#1d1d1f', margin: '0 0 16px' }
const text = { fontSize: '15px', lineHeight: '24px', color: '#3a3a3c', margin: '0 0 14px' }
const button = { backgroundColor: '#1d1d1f', color: '#ffffff', borderRadius: '10px', padding: '12px 20px', fontSize: '14px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#8e8e93', marginTop: '28px' }
