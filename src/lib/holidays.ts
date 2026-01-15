import { isSameDay } from 'date-fns';

// Portuguese national holidays + Porto Santo specific holidays
export function getPortugueseHolidays(year: number): Date[] {
  const holidays: Date[] = [];

  // Fixed holidays (National)
  holidays.push(new Date(year, 0, 1));   // Ano Novo
  holidays.push(new Date(year, 3, 25));  // Dia da Liberdade
  holidays.push(new Date(year, 4, 1));   // Dia do Trabalhador
  holidays.push(new Date(year, 5, 10));  // Dia de Portugal
  holidays.push(new Date(year, 7, 15));  // Assunção de Nossa Senhora
  holidays.push(new Date(year, 9, 5));   // Implantação da República
  holidays.push(new Date(year, 10, 1));  // Dia de Todos os Santos
  holidays.push(new Date(year, 11, 1));  // Restauração da Independência
  holidays.push(new Date(year, 11, 8));  // Imaculada Conceição
  holidays.push(new Date(year, 11, 25)); // Natal

  // Porto Santo specific holiday
  holidays.push(new Date(year, 5, 24));  // São João (Festa de Porto Santo)

  // Madeira Regional Holiday
  holidays.push(new Date(year, 6, 1));   // Dia da Região Autónoma da Madeira
  holidays.push(new Date(year, 11, 26)); // 1ª Oitava (Madeira)

  // Easter-based movable holidays
  const easter = calculateEaster(year);
  
  // Sexta-feira Santa (Good Friday) - 2 days before Easter
  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2);
  holidays.push(goodFriday);

  // Domingo de Páscoa (Easter Sunday)
  holidays.push(easter);

  // Corpo de Deus (Corpus Christi) - 60 days after Easter
  const corpusChristi = new Date(easter);
  corpusChristi.setDate(easter.getDate() + 60);
  holidays.push(corpusChristi);

  // Carnaval (Shrove Tuesday) - 47 days before Easter (optional but common in Madeira)
  const carnival = new Date(easter);
  carnival.setDate(easter.getDate() - 47);
  holidays.push(carnival);

  return holidays;
}

// Calculate Easter Sunday using the Anonymous Gregorian algorithm
function calculateEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  
  return new Date(year, month, day);
}

// Check if a date is a holiday
export function isHoliday(date: Date): boolean {
  const year = date.getFullYear();
  const holidays = getPortugueseHolidays(year);
  return holidays.some(holiday => isSameDay(holiday, date));
}

// Get holiday name if date is a holiday
export function getHolidayName(date: Date): string | null {
  const year = date.getFullYear();
  const day = date.getDate();
  const month = date.getMonth();

  // Fixed holidays
  const fixedHolidays: Record<string, string> = {
    '0-1': 'Ano Novo',
    '3-25': 'Dia da Liberdade',
    '4-1': 'Dia do Trabalhador',
    '5-10': 'Dia de Portugal',
    '5-24': 'São João (Porto Santo)',
    '6-1': 'Dia da Região Autónoma da Madeira',
    '7-15': 'Assunção de Nossa Senhora',
    '9-5': 'Implantação da República',
    '10-1': 'Dia de Todos os Santos',
    '11-1': 'Restauração da Independência',
    '11-8': 'Imaculada Conceição',
    '11-25': 'Natal',
    '11-26': '1ª Oitava',
  };

  const key = `${month}-${day}`;
  if (fixedHolidays[key]) {
    return fixedHolidays[key];
  }

  // Check movable holidays
  const easter = calculateEaster(year);
  
  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2);
  if (isSameDay(date, goodFriday)) return 'Sexta-feira Santa';
  
  if (isSameDay(date, easter)) return 'Domingo de Páscoa';
  
  const corpusChristi = new Date(easter);
  corpusChristi.setDate(easter.getDate() + 60);
  if (isSameDay(date, corpusChristi)) return 'Corpo de Deus';
  
  const carnival = new Date(easter);
  carnival.setDate(easter.getDate() - 47);
  if (isSameDay(date, carnival)) return 'Carnaval';

  return null;
}

// Get all holidays for a range of years (useful for calendar display)
export function getHolidaysForYears(startYear: number, endYear: number): Date[] {
  const allHolidays: Date[] = [];
  for (let year = startYear; year <= endYear; year++) {
    allHolidays.push(...getPortugueseHolidays(year));
  }
  return allHolidays;
}
