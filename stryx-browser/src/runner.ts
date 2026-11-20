import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { IBrowserClient, TBrowserOptions, TCookieItem, TPageSnapshot } from "@stryx/domain";
import { firefox } from "playwright-core";

export type TCamoufoxClientOptions = {
	executablePath?: string;
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

	const fetchPage = async (
		url: string,
		browserOptions?: TBrowserOptions,
	): Promise<TPageSnapshot> => {
		const isHeadless = browserOptions?.headless ?? true;
		const timeout = browserOptions?.timeoutMs ?? 45000;

		const launchConfig = {
			executablePath: resolvedPath,
			headless: isHeadless,
		};

		const browser = await firefox.launch(launchConfig);

		try {
			const context = await browser.newContext();

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
			const isLinkedIn = url.includes("linkedin.com");
			let navReferer: string | undefined = undefined;

			if (isLinkedIn) {
				await page.addInitScript(() => {
					const css = `
						.contextual-sign-in-modal,
						.modal__outlet,
						#artdeco-modal-outlet,
						[data-modal],
						.modal-wormhole,
						.sign-in-modal,
						.modal-backdrop,
						.modal__overlay,
						div[data-view-name*="sign-in-modal"],
						section[data-view-name*="sign-in-modal"] {
							display: none !important;
							opacity: 0 !important;
							pointer-events: none !important;
							visibility: hidden !important;
						}
						body {
							overflow: auto !important;
						}
					`;
					const style = document.createElement("style");
					style.id = "stryx-anti-popup";
					const textNode = document.createTextNode(css);
					style.appendChild(textNode);
					const attach = () => {
						if (document.head) {
							document.head.appendChild(style);
						}
					};
					attach();
					document.addEventListener("DOMContentLoaded", attach);
				});

				const guestHydrationOptions = {
					waitUntil: "domcontentloaded" as const,
					timeout: 15000,
				};
				await page.goto("https://www.linkedin.com/jobs", guestHydrationOptions).catch(() => {});
				await page.waitForTimeout(2000);
				navReferer = "https://www.linkedin.com/jobs";
			}

			const navOptions = {
				timeout: timeout,
				waitUntil: "domcontentloaded" as const,
				referer: navReferer,
			};
			const response = await page.goto(url, navOptions);

			await page.waitForTimeout(3500);

			if (isLinkedIn) {
				await page.evaluate(() => {
					const selectors = [
						".contextual-sign-in-modal",
						".modal__outlet",
						"#artdeco-modal-outlet",
						"[data-modal]",
						".modal-wormhole",
						".sign-in-modal",
						".modal-backdrop",
						".modal__overlay"
					];
					for (const sel of selectors) {
						const els = document.querySelectorAll(sel);
						els.forEach((el) => {
							el.remove();
						});
					}
					document.body.classList.remove("modal-open");
					document.body.style.overflow = "auto";
				}).catch(() => {});
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
