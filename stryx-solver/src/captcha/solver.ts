import type {
	IBrowserClient,
	ICache,
	IChallengeSolver,
	TScrapeOptions,
	TSolverOutcome,
} from "@stryx/domain";

export type TCaptchaSolverDeps = {
	browser: IBrowserClient;
	cache?: ICache;
};

export const createCaptchaSolver = (deps: TCaptchaSolverDeps): IChallengeSolver => {
	const vendor = "captcha";

	const detects = (statusCode: number, html: string): boolean => {
		const lower = html.toLowerCase();
		const hasRecaptcha = lower.includes("recaptcha");
		const hasHcaptcha = lower.includes("hcaptcha");
		const hasArkose = lower.includes("arkoselabs");
		const hasGeetest = lower.includes("geetest");
		const hasSecurityCheck = lower.includes("security check");
		const hasMarker =
			hasRecaptcha || hasHcaptcha || hasArkose || hasGeetest || hasSecurityCheck;
		return hasMarker;
	};

	const solve = async (url: string, options?: TScrapeOptions): Promise<TSolverOutcome> => {
		process.stderr.write("[captcha:solve] launching camoufox for visual/interactive captcha...\n");
		const browserOpts = {
			headless: true,
			timeoutMs: options?.timeoutMs ?? 45000,
			cookies: options?.cookies,
		};
		const page = await deps.browser.fetchPage(url, browserOpts);

		const parsedUrl = new URL(url);
		const hostname = parsedUrl.hostname;
		const hasCache = Boolean(deps.cache);
		const hasCookies = page.cookies.length > 0;
		const isCacheable = hasCache && hasCookies;
		if (isCacheable) {
			await deps.cache!.set(hostname, page.cookies, 3600);
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
