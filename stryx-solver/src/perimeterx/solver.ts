import type {
	IBrowserClient,
	ICache,
	IChallengeSolver,
	TScrapeOptions,
	TSolverOutcome,
} from "@stryx/domain";

export type TPerimeterxSolverDeps = {
	browser: IBrowserClient;
	cache?: ICache;
};

export const createPerimeterxSolver = (deps: TPerimeterxSolverDeps): IChallengeSolver => {
	const vendor = "perimeterx";

	const detects = (statusCode: number, html: string): boolean => {
		const lower = html.toLowerCase();
		const hasMarker =
			lower.includes("px-captcha") ||
			lower.includes("client.perimeterx.net") ||
			lower.includes("_px3") ||
			lower.includes("perimeterx");
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
