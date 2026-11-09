import type { ComponentType } from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 *
 * Example:
 *   import { template as welcomeTemplate } from './welcome.tsx'
 *   // then add to TEMPLATES: 'welcome': welcomeTemplate
 */
import { template as taskEvent } from './task-event.tsx'
import { template as documentExpiry } from './document-expiry.tsx'
import { template as requestSubmitted } from './request-submitted.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'task-event': taskEvent,
  'document-expiry': documentExpiry,
  'request-submitted': requestSubmitted,
  // Add templates here as they are created, e.g.:
  // 'welcome': welcomeTemplate,
}
