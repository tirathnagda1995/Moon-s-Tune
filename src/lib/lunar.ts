import {
  Body,
  Illumination,
  MoonPhase,
  SearchMoonPhase,
} from "astronomy-engine";
import type { LunarContext } from "./domain";
export function lunarContext(date: Date): LunarContext {
  const angle = MoonPhase(date);
  const previous = SearchMoonPhase(0, date, -40);
  if (!previous) throw new Error("Lunar calculation failed");
  return {
    angle,
    phase: Math.round(angle / 45) % 8,
    illumination: Illumination(Body.Moon, date).phase_fraction,
    age: (date.getTime() - previous.date.getTime()) / 86400000,
    cycle: Math.floor(
      (previous.date.getTime() - Date.UTC(2000, 0, 6)) / 2551442880 + 0.5,
    ),
    nextFull: SearchMoonPhase(180, date, 40)!.date.toISOString(),
    nextNew: SearchMoonPhase(0, date, 40)!.date.toISOString(),
    version: "astronomy-engine-2.1",
  };
}
