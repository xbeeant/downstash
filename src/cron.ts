export function parseCronExpression(cron: string): number {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`invalid cron expression: ${cron}`);
  }

  const [minutePart, hourPart, dayPart, monthPart, weekdayPart] = parts;

  const now = new Date();
  const next = new Date(now.getTime());

  next.setSeconds(0);
  next.setMilliseconds(0);

  const minute = parseCronField(minutePart, 0, 59);
  const hour = parseCronField(hourPart, 0, 23);
  const day = parseCronField(dayPart, 1, 31);
  const month = parseCronField(monthPart, 1, 12);
  const weekday = parseCronField(weekdayPart, 0, 6);

  for (let i = 0; i < 366; i++) {
    if (i > 0) {
      next.setDate(next.getDate() + 1);
      next.setHours(0, 0, 0, 0);
    }

    if (!matchesMonth(next.getMonth() + 1, month)) continue;
    if (!matchesDay(next.getDate(), day)) continue;
    if (!matchesWeekday(next.getDay(), weekday)) continue;

    for (let h = 0; h < 24; h++) {
      if (!matchesHour(h, hour)) continue;

      for (let m = 0; m < 60; m++) {
        if (!matchesMinute(m, minute)) continue;

        const candidate = new Date(next.getTime());
        candidate.setHours(h, m, 0, 0);

        if (candidate.getTime() > now.getTime()) {
          return candidate.getTime();
        }
      }
    }
  }

  throw new Error(`could not find next cron run time for: ${cron}`);
}

function parseCronField(field: string, min: number, max: number): number[] {
  if (field === "*") {
    const result: number[] = [];
    for (let i = min; i <= max; i++) {
      result.push(i);
    }
    return result;
  }

  const result: number[] = [];
  const parts = field.split(",");
  for (const part of parts) {
    if (part.includes("/")) {
      const [base, step] = part.split("/");
      const stepVal = Number.parseInt(step, 10);
      if (base === "*") {
        for (let i = min; i <= max; i += stepVal) {
          result.push(i);
        }
      } else {
        const baseVal = Number.parseInt(base, 10);
        for (let i = baseVal; i <= max; i += stepVal) {
          result.push(i);
        }
      }
    } else if (part.includes("-")) {
      const [start, end] = part.split("-");
      const startVal = Number.parseInt(start, 10);
      const endVal = Number.parseInt(end, 10);
      for (let i = startVal; i <= endVal; i++) {
        result.push(i);
      }
    } else {
      result.push(Number.parseInt(part, 10));
    }
  }

  return [...new Set(result)].sort((a, b) => a - b);
}

function matchesMinute(current: number, allowed: number[]): boolean {
  return allowed.includes(current);
}

function matchesHour(current: number, allowed: number[]): boolean {
  return allowed.includes(current);
}

function matchesDay(current: number, allowed: number[]): boolean {
  return allowed.includes(current);
}

function matchesMonth(current: number, allowed: number[]): boolean {
  return allowed.includes(current);
}

function matchesWeekday(current: number, allowed: number[]): boolean {
  return allowed.includes(current);
}