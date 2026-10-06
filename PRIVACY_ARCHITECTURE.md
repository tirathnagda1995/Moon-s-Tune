# Privacy architecture

## Boundaries

Identity lives in Supabase Auth and the `profiles` mapping. A random `person_id` is used in canonical tables; email is never copied into analytical records. Identity remains linkable by the operator through the mapping: pseudonymous does not mean anonymous.

Private Vault: retained text is encrypted in the browser with Web Crypto AES-256-GCM. Every encryption gets a random 96-bit IV and 128-bit salt. PBKDF2-SHA256 with 600,000 iterations derives a non-extractable key from the user's passphrase. The observation ID is authenticated additional data, preventing ciphertext from being moved to a different entry. Unicode is encoded as UTF-8. Ciphertexts are versioned for future KDF migrations.

Pattern Signals: independent ordinal dimensions, source types, confidence, version, time, timezone, source and quality flags. These signals are readable to the app and, in cloud mode, the database operator. Pattern calculation never needs journal decryption.

## Key management and limitations

Passphrases are held only in React memory until reload or sign-out. They are not in localStorage, IndexedDB, cookies, exports or server requests. There is no password recovery, escrow or stored verifier. Users must preserve the passphrase for each retained entry, including when choosing a different passphrase later. The minimum is 12 characters; a long unique passphrase is preferable. AES cannot compensate for a guessable passphrase.

This is **not a zero-knowledge service** and makes no blanket end-to-end-encryption claim. The site operator serves code, so compromised or malicious scripts could intercept plaintext or passphrases while unlocked. Browser extensions, shared OS accounts, malware and unlocked sessions are outside the cryptographic protection. Guest structured signals are not encrypted. Account access tokens use Supabase's browser session persistence. Memory cannot be reliably zeroed in JavaScript.

## Text flow

Text starts in component memory. Saving structured quick values requires no external service. If private retention is checked, encrypt before persisting. If retention is unchecked, discard the text on leaving/saving; it is not silently retained. If neither structured values nor retained text exists, the UI explains that a feeling or retained note is needed.

Optional AI requires an authenticated user and separate entry-level permission. The server verifies identity, origin, durable consent and a 20-request/day limit, then sends only that entry's text and locale to the configured provider. No entire journal history is sent. Provider retention is outside Moon Pattern's control and must be reviewed. The AI reflection is transient; persisted reflections are safe localized templates determined from canonical signals. No text/prompt logging is implemented.

## Local and cloud storage

Guest observations, ciphertexts, non-text revision snapshots and consent records live in IndexedDB. LocalStorage holds only pseudonymous guest ID, onboarding status, locale and unit preference. No automatic cloud migration occurs. The guest vault and cloud account are distinct spaces.

Cloud notes are in `private_journals`; immutable non-text revisions and signal provenance are separate tables. Table grants and RLS isolate users; narrow RPCs validate ownership and revisions. The account-deletion endpoint validates the bearer token before exercising its admin capability, never accepts a target user ID, and cascades user-owned data removal.

## Control and retention

Users can delete a note while preserving feelings, delete a day and its revisions, delete all history, erase the guest space or delete their cloud account. Research and marketing have no enabled collectors. Consent purposes are independent ledger entries with server timestamps, version, region and withdrawal. Core permission is distinct from optional AI. Withdrawal prevents future AI calls but cannot undo past provider processing.

Exports include current observations, encrypted notes, consent history, preference values and correction ledger. Exports remain sensitive: structured feelings are readable. No raw journals are sold, no ad trackers run, no population analytics are enabled. Regional obligations require operational/legal review; the presence of schema fields does not establish GDPR or other legal compliance.
