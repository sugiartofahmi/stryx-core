import type {
	IBrowserClient,
	ICache,
	IChallengeSolver,
	ITransportClient,
	TCookieItem,
	TScrapeOptions,
	TSolverOutcome,
} from "@stryx/domain";
import {
	type TPxIdentity,
	executePureHttpCollector,
	extractAppIdFromHtml,
	synthesizePxIdentity,
} from "./collector.js";

export type TPerimeterxSolverDeps = {
	browser: IBrowserClient;
	transport: ITransportClient;
	cache: ICache;
};

export const createPerimeterxSolver = (deps: TPerimeterxSolverDeps): IChallengeSolver => {
	const vendor = "perimeterx";

	const detects = (statusCode: number, html: string): boolean => {
		const lower = html.toLowerCase();
		const hasPxCaptcha = lower.includes("px-captcha");
		const hasClientScript = lower.includes("client.perimeterx.net");
		const hasPx3Cookie = lower.includes("_px3");
		const hasPxKeyword = lower.includes("perimeterx");
		const hasMarker = hasPxCaptcha || hasClientScript || hasPx3Cookie || hasPxKeyword;
		const isForbidden = statusCode === 403;
		const isBlocked = isForbidden || hasMarker;
		return isBlocked;
	};

	const detectAppId = async (
		url: string,
		options?: TScrapeOptions,
	): Promise<string | null> => {
		try {
			process.stderr.write("[perimeterx:app-id] inspecting target html for appId marker...\n");
			const checkResp = await deps.transport.fetch(url, options);
			const detectedId = extractAppIdFromHtml(checkResp.body);
			const hasDetectedId = Boolean(detectedId);
			if (hasDetectedId) {
				process.stderr.write(`[perimeterx:app-id:found] appId=${detectedId}\n`);
				return detectedId;
			}
			process.stderr.write("[perimeterx:app-id:not-found] no marker in html\n");
			return null;
		} catch (err: unknown) {
			const errorMessage = err instanceof Error ? err.message : String(err);
			process.stderr.write(`[perimeterx:app-id:error] inspect failed: ${errorMessage}\n`);
			return null;
		}
	};

	const createSyntheticIdentity = (): TPxIdentity => {
		process.stderr.write("[perimeterx:identity] synthesizing seed tokens (_pxvid, _pxhd)...\n");
		const identity = synthesizePxIdentity();
		process.stderr.write(`[perimeterx:identity:ready] vid=${identity.vid}\n`);
		return identity;
	};

	const requestCollectorCookies = async (
		url: string,
		appId: string,
		identity: TPxIdentity,
		options?: TScrapeOptions,
	): Promise<TCookieItem[] | null> => {
		process.stderr.write("[perimeterx:collector] dispatching pure http collector handshake...\n");
		const cookies = await executePureHttpCollector(url, appId, identity, options);
		const hasCookies = Boolean(cookies && cookies.length > 0);
		if (hasCookies) {
			process.stderr.write("[perimeterx:collector:success] cookies acquired\n");
			return cookies;
		}
		process.stderr.write("[perimeterx:collector:failed] no tokens returned\n");
		return null;
	};

	const fetchTargetWithCollectedCookies = async (
		url: string,
		collectedCookies: TCookieItem[],
		options?: TScrapeOptions,
	): Promise<TSolverOutcome | null> => {
		const parsedUrl = new URL(url);
		const hostname = parsedUrl.hostname;

		await deps.cache.set(hostname, collectedCookies, 328);

		const cookieMap: Record<string, string> = {};
		const hasExistingCookies = Boolean(options?.cookies);
		if (hasExistingCookies) {
			Object.assign(cookieMap, options!.cookies);
		}
		for (const item of collectedCookies) {
			cookieMap[item.name] = item.value;
		}

		const reFetchOptions: TScrapeOptions = {
			...options,
			cookies: cookieMap,
		};

		try {
			process.stderr.write("[perimeterx:pure-http] verifying target response with rebaked cookies...\n");
			const finalResp = await deps.transport.fetch(url, reFetchOptions);
			const isStillBlocked = detects(finalResp.status, finalResp.body);
			const isOkStatus = finalResp.status === 200;
			const isSuccess = !isStillBlocked && isOkStatus;

			if (isSuccess) {
				process.stderr.write("[perimeterx:pure-http:cleared] target unblocked via pure http\n");
				return {
					unblockedHtml: finalResp.body,
					cookies: collectedCookies,
					cleared: true,
				};
			}

			process.stderr.write(`[perimeterx:pure-http:blocked] status=${finalResp.status}\n`);
			return null;
		} catch (err: unknown) {
			const errorMessage = err instanceof Error ? err.message : String(err);
			process.stderr.write(`[perimeterx:pure-http:error] verification failed: ${errorMessage}\n`);
			return null;
		}
	};

	const harvestTokensWithBrowser = async (
		url: string,
		options?: TScrapeOptions,
	): Promise<TSolverOutcome> => {
		process.stderr.write("[perimeterx:browser] launching camoufox harvester fallback...\n");
		const browserOpts = {
			headless: true,
			timeoutMs: options?.timeoutMs ?? 45000,
			cookies: options?.cookies,
		};
		const page = await deps.browser.fetchPage(url, browserOpts);

		const parsedUrl = new URL(url);
		const hostname = parsedUrl.hostname;
		const hasCookies = page.cookies.length > 0;
		if (hasCookies) {
			await deps.cache.set(hostname, page.cookies, 3600);
		}

		process.stderr.write("[perimeterx:browser:success] camoufox harvester completed\n");
		return {
			unblockedHtml: page.html,
			cookies: page.cookies,
			cleared: true,
		};
	};

	const solve = async (url: string, options?: TScrapeOptions): Promise<TSolverOutcome> => {
		const appId = await detectAppId(url, options);
		const hasAppId = Boolean(appId);

		if (hasAppId) {
			const identity = createSyntheticIdentity();
			const collectedCookies = await requestCollectorCookies(
				url,
				appId!,
				identity,
				options,
			);
			const hasCollectedCookies = Boolean(collectedCookies && collectedCookies.length > 0);

			if (hasCollectedCookies) {
				const pureOutcome = await fetchTargetWithCollectedCookies(
					url,
					collectedCookies!,
					options,
				);
				const hasPureOutcome = Boolean(pureOutcome);
				if (hasPureOutcome) {
					return pureOutcome!;
				}
			}
		}

		const fallbackOutcome = await harvestTokensWithBrowser(url, options);
		return fallbackOutcome;
	};

	return {
		vendor: vendor,
		detects: detects,
		solve: solve,
	};
};
