import Link from "next/link";
import en from "@/locales/en";
export default function Privacy() {
  return (
    <main className="legal">
      <Link href="/">← {en.brand}</Link>
      <h1>{en.privacySummary}</h1>
      <p>{en.privacyBody}</p>
      <h2>{en.consentTitle}</h2>
      <p>{en.consentBody}</p>
      <p>{en.trustDetail}</p>
      <p>{en.passphraseHint}</p>
      <p>{en.exportHint}</p>
      <p>{en.wellness}</p>
    </main>
  );
}
