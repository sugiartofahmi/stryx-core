import type {
	IBrowserClient,
	ICache,
	IChallengeSolver,
	TScrapeOptions,
	TSolverOutcome,
} from "@stryx/domain";

export type TCloudflareSolverDeps = {
	browser: IBrowserClient;
	cache?: ICache;
};

export const createCloudflareSolver = (deps: TCloudflareSolverDeps): IChallengeSolver => {
	const vendor = "cloudflare";

	const detects = (statusCode: number, html: string): boolean => {
		const lower = html.toLowerCase();
		const hasMarker =
			lower.includes("cf-chl-") ||
			lower.includes("challenges.cloudflare.com") ||
			lower.includes("just a moment...") ||
			lower.includes("turnstile");
		return hasMarker;
	};

	const solve = async (url: string, options?: TScrapeOptions): Promise<TSolverOutcome> => {
		const browserOpts = {
			headless: true,
			timeoutMs: options?.timeoutMs ?? 45000,
			cookies: options?.cookies,
		};
		const page = await deps.browser.fetchPage(url, browserOpts);

		if (deps.cache && page.cookies.length > 0) {
			const parsedUrl = new URL(url);
			const hostname = parsedUrl.hostname;
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
