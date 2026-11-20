#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildStryxEngine } from "@stryx/core";

const generateFilenameFromUrl = (rawUrl: string): string => {
	const parsed = new URL(rawUrl);
	const host = parsed.hostname.replace(/^www\./, "");
	const trimmedPath = parsed.pathname.replace(/^\/|\/$/g, "");
	const cleanPath = trimmedPath.replace(/\//g, "-");
	const base = cleanPath ? `${host}-${cleanPath}` : host;
	const safe = base.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-");
	return `${safe}.html`;
};

const runCli = async () => {
	const rawArgs = process.argv.slice(2);
	if (rawArgs.length === 0) {
		process.stdout.write("Usage: stryx <url> [--output <file>] [--timeout <ms>]\n");
		process.exit(1);
	}

	const url = rawArgs[0];
	if (!url || url.startsWith("--")) {
		process.stdout.write("Error: Target URL must be the first argument.\n");
		process.exit(1);
	}

	let timeoutMs = 30000;
	let outputPath = "";

	const timeoutIdx = rawArgs.indexOf("--timeout");
	if (timeoutIdx !== -1 && rawArgs[timeoutIdx + 1]) {
		const parsedTimeout = Number.parseInt(rawArgs[timeoutIdx + 1], 10);
		if (!Number.isNaN(parsedTimeout)) {
			timeoutMs = parsedTimeout;
		}
	}

	const outputIdx = rawArgs.indexOf("--output");
	if (outputIdx !== -1 && rawArgs[outputIdx + 1]) {
		outputPath = path.resolve(rawArgs[outputIdx + 1]);
	} else {
		const currentFile = fileURLToPath(import.meta.url);
		const currentDir = path.dirname(currentFile);
		const repoOutputDir = path.resolve(currentDir, "../../output");
		await fs.mkdir(repoOutputDir, { recursive: true });
		const autoFilename = generateFilenameFromUrl(url);
		outputPath = path.join(repoOutputDir, autoFilename);
	}

	const engine = buildStryxEngine();

	const startTime = Date.now();
	const response = await engine.fetchHtml(url, {
		timeoutMs: timeoutMs,
	});
	const elapsedMs = Date.now() - startTime;

	const cookieCount = Object.keys(response.cookies).length;
	const bodyLength = response.body.length;

	process.stdout.write(
		`Status: ${response.status} | Body Length: ${bodyLength} | Cookies: ${cookieCount} | Time: ${elapsedMs}ms\n`,
	);

	await fs.writeFile(outputPath, response.body, "utf-8");
	process.stdout.write(`Saved HTML output to: ${outputPath}\n`);
};

runCli().catch((err: Error) => {
	process.stderr.write(`Execution failed: ${err.message}\n`);
	process.exit(1);
});
