// Startet die App. Ohne Reverse Proxy kommt die App über einfaches HTTP im Heimnetz;
// SvelteKit nimmt ohne Angabe aber HTTPS an und würde Formulare als fremd ablehnen.
// Deshalb gilt „http“, solange kein Proxy etwas anderes per X-Forwarded-Proto meldet.
import http from 'node:http';

process.env.PROTOCOL_HEADER ??= 'x-forwarded-proto';
// Erst nach dem Setzen laden, der Handler liest die Variable beim Import.
const { handler } = await import('./build/handler.js');
const header = process.env.PROTOCOL_HEADER.toLowerCase();
const port = Number(process.env.PORT ?? 3000);

const server = http.createServer((req, res) => {
	if (!req.headers[header]) req.headers[header] = 'http';
	handler(req, res, () => {
		res.statusCode = 404;
		res.end('Nicht gefunden');
	});
});

server.listen(port, process.env.HOST ?? '0.0.0.0', () => {
	console.log(`Fixkosten läuft auf Port ${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
	process.on(signal, () => server.close(() => process.exit(0)));
}
