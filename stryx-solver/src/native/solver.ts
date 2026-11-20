import type {
	IBrowserClient,
	ICache,
	IChallengeSolver,
	TScrapeOptions,
	TSolverOutcome,
} from "@stryx/domain";

export type TNativeSolverDeps = {
	browser: IBrowserClient;
	cache?: ICache;
};

export const createNativeSolver = (deps: TNativeSolverDeps): IChallengeSolver => {
	const vendor = "generic";

	const detects = (statusCode: number, html: string): boolean => {
		const isBlockedStatus = statusCode === 403 || statusCode === 429 || statusCode === 503;
		return isBlockedStatus;
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
