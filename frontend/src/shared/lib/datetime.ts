const ZONE = "Asia/Almaty";
const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

function parts(value: string | Date) {
  return Object.fromEntries(partsFormatter.formatToParts(new Date(value))
    .filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

export function almatyDate(value: string | Date = new Date()) {
  const p = parts(value);
  return `${p.year.padStart(4, "0")}-${p.month}-${p.day}`;
}

export function almatyTime(value: string) {
  const p = parts(value);
  return `${p.hour}:${p.minute}`;
}

// Resolve the IANA offset for the chosen date, including the 2024 time-zone change.
export function localToUtc(day: string, time: string) {
  const target = Date.parse(`${day}T${time}:00Z`);
  let guess = target;
  for (let i = 0; i < 3; i++) {
    const p = parts(new Date(guess));
    const local = Date.parse(`${p.year.padStart(4, "0")}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);
    guess += target - local;
  }
  return new Date(guess).toISOString();
}

export function shiftDay(day: string, amount: number) {
  const value = new Date(`${day}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

export function isWeekday(day: string) {
  const dayNumber = new Date(`${day}T12:00:00Z`).getUTCDay();
  return dayNumber > 0 && dayNumber < 6;
}

export function formatDate(value: string, options: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: ZONE, day: "numeric", month: "short", ...options,
  }).format(new Date(value.length === 10 ? `${value}T12:00:00Z` : value));
}

export function minuteOfDay(value: string) {
  const p = parts(value);
  return Number(p.hour) * 60 + Number(p.minute);
}
