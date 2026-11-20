import type {
	IBrowserClient,
	ICache,
	IChallengeSolver,
	TScrapeOptions,
	TSolverOutcome,
} from "@stryx/domain";

export type TDatadomeSolverDeps = {
	browser: IBrowserClient;
	cache: ICache;
};

export const createDatadomeSolver = (deps: TDatadomeSolverDeps): IChallengeSolver => {
	const vendor = "datadome";

	const detects = (statusCode: number, html: string): boolean => {
		const lower = html.toLowerCase();
		const hasDatadome = lower.includes("datadome");
		const hasDelivery = lower.includes("captcha-delivery.com");
		const hasDdScript = lower.includes("dd.js");
		const hasMarker = hasDatadome || hasDelivery || hasDdScript;
		return hasMarker;
	};

	const solve = async (url: string, options?: TScrapeOptions): Promise<TSolverOutcome> => {
		process.stderr.write("[datadome:solve] launching camoufox for datadome challenge...\n");
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

		return {
			unblockedHtml: page.html,
			cookies: page.cookies,
			cleared: true,
		};
	};

	return {
		vendor: vendor,
		detects: detects,
		solve: solve,
	};
};
