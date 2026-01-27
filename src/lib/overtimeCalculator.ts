/**
 * Overtime Calculator Utility
 * 
 * Business rules:
 * - Weekdays (Mon-Fri): Overtime hours are 18:00 to 08:00 next day
 * - Weekends (Sat-Sun): All 24 hours count as overtime
 */

import { isWeekend, getDay } from 'date-fns';

// Overtime periods (in hours, 24h format)
export const OVERTIME_CONFIG = {
  weekday: {
    eveningStart: 18, // 18:00
    morningEnd: 8,    // 08:00
  },
  weekend: {
    allDay: true,     // All 24 hours are overtime
  },
};

/**
 * Check if a given date is a weekend (Saturday or Sunday)
 */
export function isWeekendDay(date: Date): boolean {
  return isWeekend(date);
}

/**
 * Check if a given time falls within overtime hours for a specific date
 * @param date - The date to check
 * @param hours - Hour of the day (0-23)
 * @returns true if the time is within overtime period
 */
export function isOvertimeHour(date: Date, hours: number): boolean {
  if (isWeekendDay(date)) {
    return true; // All weekend hours are overtime
  }
  
  // Weekday: overtime is 18:00 to 08:00
  return hours >= OVERTIME_CONFIG.weekday.eveningStart || hours < OVERTIME_CONFIG.weekday.morningEnd;
}

/**
 * Calculate overtime minutes for a given period
 * @param date - The date of the overtime
 * @param startTime - Start time string (HH:mm)
 * @param endTime - End time string (HH:mm)
 * @returns Total overtime minutes
 */
export function calculateOvertimeMinutes(
  date: Date,
  startTime: string,
  endTime: string
): number {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  
  // Handle overnight periods (end time is before start time)
  let totalMinutes = 0;
  
  if (endH < startH || (endH === startH && endM < startM)) {
    // Overnight: calculate from start to midnight, then midnight to end
    totalMinutes = (24 * 60 - (startH * 60 + startM)) + (endH * 60 + endM);
  } else {
    totalMinutes = (endH * 60 + endM) - (startH * 60 + startM);
  }
  
  // For weekends, all minutes are overtime
  if (isWeekendDay(date)) {
    return totalMinutes;
  }
  
  // For weekdays, only count overtime hours (18:00-08:00)
  let overtimeMinutes = 0;
  
  // Iterate through each minute to check if it's overtime
  // This is a simplified approach - for more efficiency, could calculate ranges
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH < startH ? (24 * 60 + endH * 60 + endM) : (endH * 60 + endM);
  
  for (let m = startMinutes; m < endMinutes; m++) {
    const normalizedMinute = m % (24 * 60);
    const hour = Math.floor(normalizedMinute / 60);
    
    if (hour >= OVERTIME_CONFIG.weekday.eveningStart || hour < OVERTIME_CONFIG.weekday.morningEnd) {
      overtimeMinutes++;
    }
  }
  
  return overtimeMinutes;
}

/**
 * Get the type of overtime period
 * @param date - The date to check
 * @returns 'fim_de_semana' for weekends, 'noturno' for weekday nights
 */
export function getOvertimeType(date: Date): 'noturno' | 'fim_de_semana' {
  return isWeekendDay(date) ? 'fim_de_semana' : 'noturno';
}

/**
 * Format overtime minutes to readable string
 * @param minutes - Total overtime minutes
 * @returns Formatted string like "2h 30min"
 */
export function formatOvertimeMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours === 0) {
    return `${mins}min`;
  }
  
  if (mins === 0) {
    return `${hours}h`;
  }
  
  return `${hours}h ${mins}min`;
}

/**
 * Get valid overtime time range description
 * @param date - The date to check
 * @returns Description of valid overtime hours
 */
export function getOvertimeDescription(date: Date): string {
  if (isWeekendDay(date)) {
    return 'Fim de semana - todas as horas contam como extra';
  }
  return 'Dia útil - horas extra das 18:00 às 08:00';
}
