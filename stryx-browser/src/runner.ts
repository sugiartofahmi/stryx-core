import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
	IBrowserClient,
	IFingerprintRotator,
	TBrowserOptions,
	TCookieItem,
	TPageSnapshot,
} from "@stryx/domain";
import { firefox } from "playwright-core";
import { createFingerprintRotator } from "./fingerprint.js";

export type TCamoufoxClientOptions = {
	executablePath?: string;
	fingerprintRotator?: IFingerprintRotator;
};

const resolveDefaultCamoufoxPath = (): string => {
	const envPath = process.env.STRYX_CAMOUFOX_PATH;
	if (envPath && fs.existsSync(envPath)) {
		return envPath;
	}

	const homeDir = os.homedir();
	const baseDir = path.join(homeDir, ".cache/camoufox/browsers/official");
	if (fs.existsSync(baseDir)) {
		const entries = fs.readdirSync(baseDir);
		for (const entry of entries) {
			const candidate = path.join(baseDir, entry, "camoufox");
			const exists = fs.existsSync(candidate);
			if (exists) {
				return candidate;
			}
		}
	}

	return "firefox";
};

export const createCamoufoxClient = (clientOptions?: TCamoufoxClientOptions): IBrowserClient => {
	const resolvedPath = clientOptions?.executablePath || resolveDefaultCamoufoxPath();
	const rotator = clientOptions?.fingerprintRotator || createFingerprintRotator();

	const fetchPage = async (
		url: string,
		browserOptions?: TBrowserOptions,
	): Promise<TPageSnapshot> => {
		const isHeadless = browserOptions?.headless ?? true;
		const timeout = browserOptions?.timeoutMs ?? 45000;
		const profile = browserOptions?.fingerprint || rotator.next();

		const launchConfig = {
			executablePath: resolvedPath,
			headless: isHeadless,
		};

		const browser = await firefox.launch(launchConfig);

		try {
			const contextOptions = {
				userAgent: profile.userAgent,
				viewport: profile.viewport,
				deviceScaleFactor: profile.deviceScaleFactor,
				locale: profile.locale,
				timezoneId: profile.timezoneId,
			};
			const context = await browser.newContext(contextOptions);

			if (browserOptions?.cookies) {
				const cookieEntries = Object.entries(browserOptions.cookies);
				const cookieList = cookieEntries.map(([k, v]) => {
					return {
						name: k,
						value: v,
						url: url,
					};
				});
				await context.addCookies(cookieList);
			}

			const page = await context.newPage();

			if (browserOptions?.initScript) {
				const scriptSource = browserOptions.initScript;
				await page.addInitScript(scriptSource);
			}

			if (browserOptions?.preNavigationUrl) {
				const preNavOptions = {
					waitUntil: "domcontentloaded" as const,
					timeout: 15000,
				};
				await page.goto(browserOptions.preNavigationUrl, preNavOptions).catch(() => {});
				await page.waitForTimeout(2000);
			}

			const navOptions = {
				timeout: timeout,
				waitUntil: "commit" as const,
				referer: browserOptions?.referer,
			};
			const response = await page.goto(url, navOptions);
			const domWaitOptions = {
				timeout: 15000,
			};
			await page.waitForLoadState("domcontentloaded", domWaitOptions).catch(() => {});

			await page.waitForTimeout(3500);

			if (browserOptions?.dismissSelectors && browserOptions.dismissSelectors.length > 0) {
				const targetSelectors = browserOptions.dismissSelectors;
				await page.evaluate((selectors) => {
					for (const sel of selectors) {
						const els = document.querySelectorAll(sel);
						els.forEach((el) => {
							el.remove();
						});
					}
					document.body.classList.remove("modal-open");
					document.body.style.overflow = "auto";
				}, targetSelectors).catch(() => {});
				await page.waitForTimeout(1000);
			}

			const html = await page.content();
			let statusCode = 200;
			if (response) {
				statusCode = response.status();
			}

			const rawCookies = await context.cookies();
			const cookieItems: TCookieItem[] = rawCookies.map((c) => {
				return {
					name: c.name,
					value: c.value,
					domain: c.domain,
					path: c.path,
					expires: c.expires,
					httpOnly: c.httpOnly,
					secure: c.secure,
				};
			});

			const finalUrl = page.url();

			return {
				url: finalUrl,
				status: statusCode,
				html: html,
				cookies: cookieItems,
			};
		} finally {
			await browser.close();
		}
	};

	return {
		fetchPage: fetchPage,
	};
};
