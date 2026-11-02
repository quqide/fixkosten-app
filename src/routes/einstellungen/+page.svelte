<script lang="ts">
	import { enhance } from '$app/forms';
	import Icon from '#lib/components/Icon.svelte';
	import { eur, eurGanz, intervallText, zeitpunkt } from '#lib/format.ts';
	import { THEMES } from '#lib/themes.ts';
	import { mitRueckmeldung, zeigeToast } from '#lib/toast.svelte.ts';
	import { kopiere } from '#lib/kopieren.ts';
	import { vorlagenText, type VorlagenGruppe } from '#lib/rechnung/vorlagen.ts';
	import { hinweisSchluessel, istAusblendbar } from '#lib/rechnung/terminplan.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const p = $derived(data.person);
	const fehler = $derived((form?.fehler ?? {}) as Record<string, string>);
	const fehlerIn = (bereich: string) => (form?.bereich === bereich ? fehler : {});

	const z = $derived(data.zuordnung);

	const HELL_TEXT: Record<string, string> = { auto: 'automatisch hell oder dunkel', light: 'immer hell', dark: 'immer dunkel' };

	/** Status von Actual als Halbsatz für die Zeile in der Liste. */
	const actualText = $derived.by(() => {
		if (!data.actual) return 'Nicht eingerichtet';
		if (!p.actualKontoId) return 'Eingerichtet, noch kein Konto gewählt';
		const n = data.warnungen.length;
		const punkte = n ? ` · ${n} ${n === 1 ? 'Punkt' : 'Punkte'} zur Prüfung` : '';
		return (z ? `Verbunden, abgerufen ${zeitpunkt(z.zeit)}` : 'Verbunden, noch nichts abgerufen') + punkte;
	});

	const zeilen = $derived([
		{ href: '/einstellungen/profil', titel: 'Über dich', text: `${p.name} · ${eurGanz(p.nettoCent)} netto · Daueraufträge am ${p.ueberweisungstag}.` },
		{ href: '/einstellungen/darstellung', titel: 'Darstellung', text: `${THEMES[p.theme]?.name ?? p.theme} · ${HELL_TEXT[p.hell] ?? ''}` },
		{ href: '#actual', titel: 'Actual', text: actualText },
		{ href: '/einstellungen/daten', titel: 'Deine Daten', text: 'Sicherung herunterladen oder einspielen' },
		{ href: '/einstellungen/verlauf', titel: 'Letzte Änderungen', text: 'von euch beiden, mit Rückgängig' }
	]);

	function rhythmus(t: { rhythmus: { frequenz: string; intervall: number } | null }) {
		if (!t.rhythmus) return 'ohne Rhythmus';
		const n = t.rhythmus.intervall;
		if (t.rhythmus.frequenz === 'monthly') return intervallText(n);
		if (t.rhythmus.frequenz === 'yearly') return intervallText(12 * n);
		return t.rhythmus.frequenz === 'weekly' ? 'wöchentlich' : 'täglich';
	}

	async function kopiereVorlagen(g: VorlagenGruppe) {
		const ok = await kopiere(vorlagenText(g));
		zeigeToast(ok ? `Vorlagen für „${g.kategorie}“ kopiert.` : 'Kopieren ging nicht. Markier die Zeilen und kopier sie von Hand.');
	}
</script>

<svelte:head><title>Einstellungen · Fixkosten</title></svelte:head>

<h1>Einstellungen</h1>
<p class="lead">Gilt nur für {p.name}. Die andere Person hat eigene Einstellungen.</p>

<nav class="card liste" aria-label="Einstellungen">
	<ul class="rows">
		{#each zeilen as zeile (zeile.href)}
			<li>
				<a class="row" href={zeile.href}>
					<span class="main"><span class="title">{zeile.titel}</span><span class="detail">{zeile.text}</span></span>
					<span class="chev"><Icon name="pfeil" size={14} /></span>
				</a>
			</li>
		{/each}
	</ul>
</nav>

<div class="section">
	<div class="section-head" id="actual"><h2>Actual Budget</h2><span class="aside">freiwillig</span></div>
	<div class="card">
		{#if !data.actual}
			<div class="field">
				<p class="help-text">Wenn du Actual Budget nutzt, kann die App den Kontostand selbst abrufen und erkennen, ob Gehalt und Daueraufträge schon gebucht sind. Ohne Actual trägst du den Kontostand einfach auf der Übersicht ein.</p>
				<details class="einrichten">
					<summary>So richtest du es ein</summary>
					<p class="help-text">Trag in Dockge beim Stack diese Umgebungsvariablen ein und starte ihn neu. Für die zweite Person heißen sie ACTUAL_B_… statt ACTUAL_A_….</p>
					<pre>ACTUAL_{p.id.toUpperCase()}_URL=http://actual:5006
ACTUAL_{p.id.toUpperCase()}_PASSWORD=dein Actual-Passwort
ACTUAL_{p.id.toUpperCase()}_SYNC_ID=Sync-ID aus Actual (Einstellungen → Erweitert)</pre>
					<p class="help-text">Ist dein Budget Ende-zu-Ende-verschlüsselt, kommt noch ACTUAL_{p.id.toUpperCase()}_E2E_PASSWORD dazu.</p>
				</details>
			</div>
		{:else}
			<form class="field" method="POST" action="?/actualKonto" use:enhance={mitRueckmeldung()}>
				<label for="konto">Welches Konto zeigt die Übersicht?</label>
				{#await data.actualKonten}
					<span class="help">Konten werden aus Actual geladen …</span>
				{:then ergebnis}
					{#if ergebnis?.fehler}
						<span class="error">{ergebnis.fehler}</span>
					{:else}
						<select id="konto" name="konto" onchange={(e) => e.currentTarget.form?.requestSubmit()} aria-describedby="konto-h">
							<option value="" selected={!p.actualKontoId}>Keins, Kontostand von Hand eintragen</option>
							{#each ergebnis?.konten ?? [] as k (k.id)}
								<option value="{k.id}|{k.name}" selected={p.actualKontoId === k.id}>{k.name}</option>
							{/each}
						</select>
						<span class="help" id="konto-h">Wähl dein {p.modus === 1 ? 'Gehaltskonto' : 'Fixkosten-Konto'}. Die App liest nur, sie ändert nichts in Actual.</span>
						<noscript><button class="secondary" type="submit">Übernehmen</button></noscript>
					{/if}
				{/await}
			</form>
			{#if p.actualKontoId}
				<form class="field abruf" method="POST" action="?/actualAbruf" use:enhance={mitRueckmeldung()}>
					<span class="label">Abgleich</span>
					<span class="help">
						{z ? `Zuletzt abgerufen ${zeitpunkt(z.zeit)}.` : 'Noch nichts abgerufen.'}
						Fixkosten, Beträge und Termine kommen aus den Terminplänen in Actual.
					</span>
					{#if fehlerIn('actual').actual}<span class="error">{fehlerIn('actual').actual}</span>{/if}
					<button class="secondary" type="submit">Jetzt abrufen</button>
				</form>
				{#if z}
					<form class="field" method="POST" action="?/gehaltKategorie" use:enhance={mitRueckmeldung()}>
						<label for="gehalt">Woran erkennt die App dein Gehalt?</label>
						<select id="gehalt" name="kategorie" onchange={(e) => e.currentTarget.form?.requestSubmit()} aria-describedby="gehalt-h">
							<option value="" selected={!p.actualGehaltKategorie}>Am Betrag (ab 70 % vom Netto)</option>
							{#each z.einnahmeKategorien as k (k.id)}
								<option value={k.id} selected={p.actualGehaltKategorie === k.id}>Kategorie „{k.name}“</option>
							{/each}
						</select>
						<span class="help" id="gehalt-h">Mit Kategorie zählen große Umbuchungen nicht als Gehalt.</span>
						<noscript><button class="secondary" type="submit">Übernehmen</button></noscript>
					</form>
				{/if}
			{/if}
		{/if}
	</div>
</div>

{#if data.actual}
	<details class="section vorlagen">
		<summary>Vorlagen für dein Budget in Actual</summary>
		<div class="card">
			<div class="field">
				<p class="help-text">Kopier diese Zeilen in die Notiz der jeweiligen Kategorie in Actual. Dann budgetiert Actual dieselben Raten wie die App. Die App selbst schreibt nichts in Actual.</p>
				<p class="help-text">Vorlagen sind in Actual noch eine experimentelle Funktion: Schalte sie dort unter Einstellungen → Experimentelle Funktionen ein und wähl danach im Budget „Vorlagen anwenden“. Die Namen der Terminpläne müssen exakt stimmen, deshalb übernimmt die App sie unverändert.</p>
			</div>
			{#if !data.vorlagen}
				<div class="field"><span class="help">Noch kein Abruf aus Actual. Nach dem ersten Abruf stehen hier die Vorlagen.</span></div>
			{:else if !data.vorlagen.gruppen.length && !data.vorlagen.ohneKategorie.length && !data.vorlagen.ohneName.length}
				<div class="field"><span class="help">Noch nichts zu kopieren: Ordne Terminpläne als Fixkosten zu oder verknüpf eine Rücklage mit einer Kategorie.</span></div>
			{:else}
				{#each data.vorlagen.gruppen as g (g.kategorieId)}
					<div class="field vorlage">
						<div class="vorlage-kopf">
							<span class="label">{g.kategorie}</span>
							<button type="button" class="secondary" onclick={() => kopiereVorlagen(g)}>Kopieren</button>
						</div>
						<pre>{vorlagenText(g)}</pre>
						<span class="help">{g.zeilen.map((z) => z.quelle).join(', ')}</span>
					</div>
				{/each}
				{#if data.vorlagen.ohneKategorie.length}
					<div class="field">
						<span class="label">Ohne Kategorie, erst in Actual zuordnen</span>
						<span class="help">{data.vorlagen.ohneKategorie.map((n) => `„${n}“`).join(', ')}: Diese Terminpläne haben in Actual keine Kategorie. Ordne sie dort zu und ruf neu ab.</span>
					</div>
				{/if}
				{#if data.vorlagen.ohneName.length}
					<div class="field">
						<span class="label">Ohne Namen, erst in Actual benennen</span>
						<span class="help">{data.vorlagen.ohneName.map((n) => `„${n}“`).join(', ')}: Diese Terminpläne haben in Actual keinen Namen, die App zeigt nur den Empfänger. Gib ihnen dort einen Namen und ruf neu ab.</span>
					</div>
				{/if}
			{/if}
		</div>
	</details>
{/if}

{#if data.warnungen.length}
	<div class="section">
		<div class="section-head"><h2>Prüfung der Einrichtung</h2><span class="aside">{data.warnungen.length} {data.warnungen.length === 1 ? 'Punkt' : 'Punkte'}</span></div>
		<div class="card"><ul class="rows">
			{#each data.warnungen as w, i (i)}
				<li><div class="row warnung">
					<span class="stufe {w.stufe}" role="img" aria-label={w.stufe === 'warnung' ? 'Warnung' : 'Hinweis'}>{w.stufe === 'warnung' ? '!' : 'i'}</span>
					<span class="main"><span class="title">{w.text}</span><span class="detail">{w.tun}</span>
						{#if istAusblendbar(w)}
							<form method="POST" action="?/ausblenden" use:enhance={mitRueckmeldung()}>
								<button type="submit" class="textlink" name="hinweis" value={hinweisSchluessel(w.terminplanId!, w.art)}>Nicht mehr anzeigen</button>
							</form>
						{/if}
					</span>
				</div></li>
			{/each}
		</ul></div>
		<p class="note">Die App ändert nichts in Actual. Nach einer Korrektur dort einfach neu abrufen.</p>
	</div>
{/if}

{#if data.ausgeblendet.length}
	<details class="section ausgeblendet">
		<summary>Ausgeblendete Hinweise ({data.ausgeblendet.length})</summary>
		<div class="card"><ul class="rows">
			{#each data.ausgeblendet as h (hinweisSchluessel(h.terminplan, h.art))}
				<li><div class="row">
					<span class="main">
						<span class="title">{h.meldung?.text ?? `Hinweis zu „${h.name ?? 'einem Terminplan'}“`}</span>
						<span class="detail">{h.meldung ? h.meldung.tun : 'Trifft gerade nicht zu.'}</span>
					</span>
					<form method="POST" action="?/einblenden" use:enhance={mitRueckmeldung()}>
						<button type="submit" class="textlink" name="hinweis" value={hinweisSchluessel(h.terminplan, h.art)}>Wieder anzeigen</button>
					</form>
				</div></li>
			{/each}
		</ul></div>
	</details>
{/if}

{#if z && z.terminplaene.length}
	<form class="section" method="POST" action="?/zuordnung" use:enhance={mitRueckmeldung()}>
		<div class="section-head"><h2>Terminpläne zuordnen</h2><span class="aside">aus Actual</span></div>
		<div class="card">
			<ul class="rows">
				{#each z.terminplaene as t (t.id)}
					{@const wahl = t.wahl}
					<li><div class="row zuordnung">
						<span class="main">
							<span class="title">{t.name}{#if !t.rolle}<span class="neu">neu</span>{/if}</span>
							<span class="detail">{eur(t.betragCent)} · {rhythmus(t)}{t.kontoId !== p.actualKontoId ? ` · ${t.kontoName}` : ''}{t.umbuchung ? ' · Umbuchung' : ''}</span>
						</span>
						<select name="rolle_{t.id}" aria-label="Rolle von {t.name}">
							<option value="fixkosten" selected={wahl === 'fixkosten'}>Fixkosten</option>
							{#each z.freiePosten as fp (fp.id)}
								<option value="fixkosten:{fp.id}" selected={wahl === `fixkosten:${fp.id}`}>Fixkosten, verknüpft mit „{fp.name}“</option>
							{/each}
							{#each z.dauerauftraege as d (d)}
								<option value="dauerauftrag:{d}" selected={wahl === `dauerauftrag:${d}`}>Dauerauftrag {d}</option>
							{/each}
							<option value="ignorieren" selected={wahl === 'ignorieren'}>Nicht berücksichtigen</option>
						</select>
					</div></li>
				{/each}
			</ul>
			<div class="field"><button class="primary" type="submit">Zuordnung speichern</button></div>
		</div>
		<p class="note">Fixkosten übernimmt die App mit Name, Betrag und Rhythmus aus Actual. Von Hand angelegte Posten mit gleichem Namen werden vorgeschlagen, damit nichts doppelt entsteht.</p>
	</form>
{/if}

<style>
	.liste { margin-top: 8px; }
	a.row { color: var(--label); text-decoration: none; }
	a.row:hover { background: color-mix(in srgb, var(--fill) 55%, transparent); }
	.help-text { margin: 0; color: var(--secondary); }
	.abruf .secondary { justify-self: start; }
	.stufe { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; font-weight: 800; flex: none; }
	.stufe.warnung { background: var(--warm-soft); color: var(--warm); }
	.stufe.hinweis { background: var(--calm-soft); color: var(--calm); }
	.warnung .title { font-weight: 600; }
	.warnung form { margin-top: 2px; }
	.ausgeblendet summary { cursor: pointer; font-weight: 600; color: var(--secondary); padding: 4px; min-height: 44px; display: flex; align-items: center; }
	.zuordnung { flex-wrap: wrap; }
	.zuordnung .main { flex: 1 1 200px; }
	.zuordnung select { flex: 1 1 220px; max-width: 100%; font-size: 15px; background: var(--fill); border: 2px solid transparent; border-radius: 10px; padding: 8px 10px; min-height: 44px; color: var(--label); }
	.neu { font-size: 12px; font-weight: 700; color: var(--tint); background: var(--tint-soft); border-radius: 999px; padding: 1px 8px; margin-left: 8px; vertical-align: 2px; }
	.einrichten summary { cursor: pointer; color: var(--tint); font-weight: 600; min-height: 44px; display: flex; align-items: center; }
	.vorlagen summary { cursor: pointer; font-weight: 700; font-size: 18px; padding: 4px; min-height: 44px; display: flex; align-items: center; }
	.vorlagen .card { margin-top: 10px; }
	.vorlage-kopf { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
	.vorlage-kopf .secondary { min-height: 40px; }
	.vorlage pre { background: var(--fill); border-radius: 10px; padding: 12px; font-size: 14px; overflow-x: auto; white-space: pre-wrap; word-break: break-word; margin: 0; user-select: all; }
	.einrichten pre { background: var(--fill); border-radius: 10px; padding: 12px; font-size: 13px; overflow-x: auto; white-space: pre-wrap; word-break: break-all; margin: 8px 0; }
</style>
