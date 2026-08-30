/**
 * Working Day & Date Range Calculations
 * Counts all calendar days in the selected date range (including weekends and holidays).
 */

import { format, eachDayOfInterval, parseISO } from "date-fns";

// ==========================================
// 1. Calculate days in date range (counts all selected days)
// ==========================================
export function calculateWorkingDays(
  startDate: Date | string,
  endDate: Date | string,
  _holidays: Date[] = []
): number {
  const start = typeof startDate === "string" ? parseISO(startDate) : startDate;
  const end = typeof endDate === "string" ? parseISO(endDate) : endDate;

  if (end < start) return 0;

  const allDays = eachDayOfInterval({ start, end });
  return allDays.length;
}

// ==========================================
// 2. Get list of all days in range
// ==========================================
export function getWorkingDays(
  startDate: Date | string,
  endDate: Date | string,
  _holidays: Date[] = []
): Date[] {
  const start = typeof startDate === "string" ? parseISO(startDate) : startDate;
  const end = typeof endDate === "string" ? parseISO(endDate) : endDate;

  if (end < start) return [];

  return eachDayOfInterval({ start, end });
}

// ==========================================
// 3. Calculate completion rate
// ==========================================
export function calculateCompletionRate(
  completed: number,
  expected: number
): number {
  if (expected === 0) return 0;
  const rate = (completed / expected) * 100;
  return Math.min(100, Math.max(0, rate));
}

// ==========================================
// 4. Detect overlap between date ranges
// ==========================================
export interface DateRange {
  startDate: Date | string;
  endDate: Date | string;
}

export function detectEvaluationOverlap(
  newRange: DateRange,
  existingRanges: DateRange[]
): DateRange[] {
  const newStart = typeof newRange.startDate === "string"
    ? parseISO(newRange.startDate)
    : newRange.startDate;
  const newEnd = typeof newRange.endDate === "string"
    ? parseISO(newRange.endDate)
    : newRange.endDate;

  return existingRanges.filter((range) => {
    const existStart = typeof range.startDate === "string"
      ? parseISO(range.startDate)
      : range.startDate;
    const existEnd = typeof range.endDate === "string"
      ? parseISO(range.endDate)
      : range.endDate;

    // Overlap condition: start1 <= end2 AND end1 >= start2
    return newStart <= existEnd && newEnd >= existStart;
  });
}

// ==========================================
// 5. Get overlapping days
// ==========================================
export function getOverlappingWorkingDays(
  newRange: DateRange,
  existingRanges: DateRange[],
  _holidays: Date[] = []
): string[] {
  const newDays = getWorkingDays(newRange.startDate, newRange.endDate);
  const newDayStrings = new Set(newDays.map((d) => format(d, "yyyy-MM-dd")));

  const existingDays = new Set<string>();
  for (const range of existingRanges) {
    const days = getWorkingDays(range.startDate, range.endDate);
    days.forEach((d) => existingDays.add(format(d, "yyyy-MM-dd")));
  }

  return [...newDayStrings].filter((d) => existingDays.has(d)).sort();
}

export const workingDayCalculations = {
  calculateWorkingDays,
  getWorkingDays,
  calculateCompletionRate,
  detectEvaluationOverlap,
  getOverlappingWorkingDays,
};
