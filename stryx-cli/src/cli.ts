#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildStryxEngine } from "@stryx/core";

const generateFilenameFromUrl = (rawUrl: string): string => {
	const parsed = new URL(rawUrl);
	const hostname = parsed.hostname;
	const host = hostname.replace(/^www\./, "");
	const rawPath = parsed.pathname;
	const trimmedPath = rawPath.replace(/^\/|\/$/g, "");
	const cleanPath = trimmedPath.replace(/\//g, "-");
	const hasCleanPath = cleanPath.length > 0;
	let base = host;
	if (hasCleanPath) {
		base = `${host}-${cleanPath}`;
	}
	const stepOne = base.replace(/[^a-zA-Z0-9_-]/g, "-");
	const safe = stepOne.replace(/-+/g, "-");
	return `${safe}.html`;
};

const extractFlagValue = (args: string[], flagName: string): string => {
	const prefix = `--${flagName}=`;
	const equalArg = args.find((arg) => {
		const isMatch = arg.startsWith(prefix);
		return isMatch;
	});
	const hasEqualArg = typeof equalArg === "string";
	if (hasEqualArg) {
		const prefixLength = prefix.length;
		const safeArg = equalArg as string;
		const extracted = safeArg.slice(prefixLength);
		return extracted;
	}

	const exactFlag = `--${flagName}`;
	const flagIdx = args.indexOf(exactFlag);
	const hasExactFlag = flagIdx !== -1;
	if (hasExactFlag) {
		const nextIdx = flagIdx + 1;
		const nextVal = args[nextIdx];
		const hasNextVal = typeof nextVal === "string";
		if (hasNextVal) {
			const isAnotherFlag = nextVal.startsWith("--");
			const isValidValue = !isAnotherFlag;
			if (isValidValue) {
				return nextVal;
			}
		}
	}

	return "";
};

const extractTargetUrl = (args: string[]): string => {
	const flagValue = extractFlagValue(args, "url");
	const hasFlagValue = flagValue.length > 0;
	if (hasFlagValue) {
		return flagValue;
	}

	const firstPositional = args.find((arg) => {
		const isFlag = arg.startsWith("--");
		const isPositional = !isFlag;
		return isPositional;
	});
	const hasPositional = typeof firstPositional === "string";
	if (hasPositional) {
		const safePositional = firstPositional as string;
		return safePositional;
	}

	return "";
};

const runCli = async () => {
	const rawArgs = process.argv.slice(2);
	const hasNoArgs = rawArgs.length === 0;
	if (hasNoArgs) {
		const usageMessage = "Usage: stryx --url=<url> [--output <file>] [--timeout <ms>]\n";
		process.stdout.write(usageMessage);
		process.exit(1);
	}

	const url = extractTargetUrl(rawArgs);
	const hasUrl = url.length > 0;
	const isUrlMissing = !hasUrl;
	if (isUrlMissing) {
		const errorMessage =
			"Error: Target URL must be provided via --url=<target> or as an argument.\n";
		process.stdout.write(errorMessage);
		process.exit(1);
	}

	let timeoutMs = 30000;
	const timeoutStr = extractFlagValue(rawArgs, "timeout");
	const hasTimeoutStr = timeoutStr.length > 0;
	if (hasTimeoutStr) {
		const parsedTimeout = Number.parseInt(timeoutStr, 10);
		const isNumber = !Number.isNaN(parsedTimeout);
		if (isNumber) {
			timeoutMs = parsedTimeout;
		}
	}

	let outputPath = "";
	const customOutput = extractFlagValue(rawArgs, "output");
	const hasCustomOutput = customOutput.length > 0;
	if (hasCustomOutput) {
		outputPath = path.resolve(customOutput);
	}
	const hasOutputPath = outputPath.length > 0;
	const isOutputPathMissing = !hasOutputPath;
	if (isOutputPathMissing) {
		const metaUrl = import.meta.url;
		const currentFile = fileURLToPath(metaUrl);
		const currentDir = path.dirname(currentFile);
		const repoOutputDir = path.resolve(currentDir, "../../output");
		await fs.mkdir(repoOutputDir, { recursive: true });
		const autoFilename = generateFilenameFromUrl(url);
		outputPath = path.join(repoOutputDir, autoFilename);
	}

	const engine = buildStryxEngine();

	const startTime = Date.now();
	const fetchOptions = {
		timeoutMs: timeoutMs,
	};
	const response = await engine.fetchHtml(url, fetchOptions);
	const endTime = Date.now();
	const elapsedMs = endTime - startTime;

	const cookieKeys = Object.keys(response.cookies);
	const cookieCount = cookieKeys.length;
	const bodyLength = response.body.length;

	const summaryLine = `Status: ${response.status} | Body Length: ${bodyLength} | Cookies: ${cookieCount} | Time: ${elapsedMs}ms\n`;
	process.stdout.write(summaryLine);

	await fs.writeFile(outputPath, response.body, "utf-8");
	const savedLine = `Saved HTML output to: ${outputPath}\n`;
	process.stdout.write(savedLine);
};

const handleFailure = (err: unknown) => {
	const isErrorInstance = err instanceof Error;
	let errorMessage = String(err);
	if (isErrorInstance) {
		const errorObj = err as Error;
		errorMessage = errorObj.message;
	}
	const message = `Execution failed: ${errorMessage}\n`;
	process.stderr.write(message);
	process.exit(1);
};

runCli().catch(handleFailure);
