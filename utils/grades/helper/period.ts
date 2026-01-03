import { Period } from "@/services/shared/grade";
import { warn } from "@/utils/logger/logger";

export function getCurrentPeriod(periods: Period[]): Period | null {
  if (!periods || periods.length === 0) {
    warn("No periods available");
    return null;
  }

  const now = new Date().getTime();
  const excludedNames = ["Bac blanc", "Brevet blanc", "Hors période"];
  periods = periods
    .filter(period => !excludedNames.includes(period.name))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  for (const period of periods) {
    if (period.start.getTime() < now && period.end.getTime() > now) {
      return period;
    }
  }

  if (periods.length > 0) {
    warn(
      "Current period not found. Falling back to the first period in the array."
    );
    return periods[0];
  }

  warn("Unable to find the current period");
  return null;
}
