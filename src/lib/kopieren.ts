/**
 * Legt Text in die Zwischenablage. Im Heimnetz läuft die App oft über einfaches HTTP, dort gibt es
 * navigator.clipboard nicht; dann über ein unsichtbares Textfeld. Ergebnis: ob es geklappt hat.
 */
export async function kopiere(text: string): Promise<boolean> {
	if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
		try {
			await navigator.clipboard.writeText(text);
			return true;
		} catch {
			/* weiter mit dem Textfeld */
		}
	}
	const feld = document.createElement('textarea');
	feld.value = text;
	feld.setAttribute('readonly', '');
	feld.style.position = 'fixed';
	feld.style.opacity = '0';
	document.body.append(feld);
	feld.select();
	try {
		return document.execCommand('copy');
	} catch {
		return false;
	} finally {
		feld.remove();
	}
}
