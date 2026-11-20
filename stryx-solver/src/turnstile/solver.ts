import type {
	IBrowserClient,
	ICache,
	IChallengeSolver,
	TScrapeOptions,
	TSolverOutcome,
} from "@stryx/domain";

export type TTurnstileSolverDeps = {
	browser: IBrowserClient;
	cache: ICache;
};

export const createTurnstileSolver = (deps: TTurnstileSolverDeps): IChallengeSolver => {
	const vendor = "turnstile";

	const detects = (statusCode: number, html: string): boolean => {
		const lower = html.toLowerCase();
		const hasTurnstileTag = lower.includes("cf-turnstile");
		const hasTurnstileScript = lower.includes("turnstile/v0/api.js");
		const hasTurnstileEndpoint = lower.includes("challenges.cloudflare.com/turnstile");
		const hasMarker = hasTurnstileTag || hasTurnstileScript || hasTurnstileEndpoint;
		return hasMarker;
	};

	const solve = async (url: string, options?: TScrapeOptions): Promise<TSolverOutcome> => {
		process.stderr.write("[turnstile:solve] launching camoufox for turnstile widget...\n");
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
