import {
  localDate,
  effectiveSignals,
  type Dimension,
  type Observation,
} from "./domain";
export const average = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
export function baseline(
  observations: Observation[],
  dimension: Dimension,
  days = 60,
  now = new Date(),
) {
  const cutoff = new Date(
    new Date(localDate(now) + "T12:00:00Z").getTime() - days * 86400000,
  )
    .toISOString()
    .slice(0, 10);
  const values = observations
    .filter((o) => o.localDate >= cutoff && o.localDate <= localDate(now))
    .flatMap((o) =>
      effectiveSignals(o.signals)
        .filter((s) => s.dimension === dimension)
        .map((s) => s.value),
    );
  return { mean: average(values), n: values.length };
}
export type Pattern = {
  variable: "moon" | "weekday" | "restfulness";
  dimension: Dimension;
  group: number;
  n: number;
  comparisonN: number;
  periods: number;
  difference: number | null;
  completeness: number;
  confidence: "insufficient" | "exploratory";
  confounders: string[];
  replication: "not-tested";
  calculatedAt: string;
};
export function patterns(observations: Observation[]): Pattern[] {
  const unique = [
    ...new Map(
      [...observations]
        .sort((a, b) => a.revision - b.revision)
        .map((o) => [o.localDate, o]),
    ).values(),
  ];
  const results: Pattern[] = [];
  for (const dimension of [
    "emotional_valence",
    "energy_arousal",
    "stress_tension",
    "restfulness",
    "focus",
    "physical_vitality",
  ] as Dimension[]) {
    const rows = unique.flatMap((o) => {
      const signal = effectiveSignals(o.signals).find(
        (s) => s.dimension === dimension,
      );
      return signal ? [{ o, value: signal.value }] : [];
    });
    for (const variable of ["moon", "weekday", "restfulness"] as const)
      for (
        let group = 0;
        group < (variable === "moon" ? 8 : variable === "weekday" ? 7 : 1);
        group++
      ) {
        const match = (o: Observation) =>
          variable === "moon"
            ? o.lunar.phase === group
            : variable === "weekday"
              ? new Date(o.localDate + "T12:00:00Z").getUTCDay() === group
              : (effectiveSignals(o.signals).find(
                  (s) => s.dimension === "restfulness",
                )?.value ?? 0) >= 4;
        const eligible =
          variable === "restfulness"
            ? rows.filter((r) =>
                effectiveSignals(r.o.signals).some(
                  (s) => s.dimension === "restfulness",
                ),
              )
            : rows;
        if (variable === "restfulness" && dimension === "restfulness") continue;
        const inside = eligible.filter((r) => match(r.o));
        const outside = eligible.filter((r) => !match(r.o));
        const periods = new Set(
          inside.map((r) =>
            variable === "moon"
              ? r.o.lunar.cycle
              : Math.floor(new Date(r.o.localDate).getTime() / 604800000),
          ),
        ).size;
        const enough =
          inside.length >= 7 &&
          outside.length >= 14 &&
          periods >= (variable === "moon" ? 3 : 3);
        const a = average(inside.map((r) => r.value));
        const b = average(outside.map((r) => r.value));
        results.push({
          variable,
          dimension,
          group,
          n: inside.length,
          comparisonN: outside.length,
          periods,
          difference: enough && a !== null && b !== null ? a - b : null,
          completeness: unique.length ? rows.length / unique.length : 0,
          confidence: enough ? "exploratory" : "insufficient",
          confounders: [
            "sleep",
            "weekday",
            "self-selection",
            "multiple-comparisons",
          ],
          replication: "not-tested",
          calculatedAt: new Date().toISOString(),
        });
      }
  }
  return results.sort(
    (a, b) => Math.abs(b.difference ?? 0) - Math.abs(a.difference ?? 0),
  );
}
