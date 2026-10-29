// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { PersonId } from '#lib/server/db.ts';

declare global {
	namespace App {
		interface Locals {
			/** Wer die App gerade benutzt, oder null, solange niemand gewählt ist. */
			person: PersonId | null;
			/** true, wenn die Person von der Anmeldung (z. B. Authentik) kommt und nicht gewechselt werden kann. */
			festePerson: boolean;
		}
	}
}

export {};
