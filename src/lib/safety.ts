// Conservative local safety routing, not a diagnosis or a comprehensive risk detector.
// No text leaves the device. The optional LLM can additionally flag urgent content.
export function urgentLanguage(text: string) {
  return /\b(?:i(?:'m| am) (?:going to|about to) (?:kill myself|end my life)|i (?:will|plan to) (?:kill myself|end my life)|i (?:just )?(?:took an overdose|overdosed))\b/i.test(
    text,
  );
}
