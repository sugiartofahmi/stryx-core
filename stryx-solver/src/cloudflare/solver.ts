import type {
	IBrowserClient,
	ICache,
	IChallengeSolver,
	ITransportClient,
	TScrapeOptions,
	TSolverOutcome,
} from "@stryx/domain";

export type TCloudflareSolverDeps = {
	browser: IBrowserClient;
	transport?: ITransportClient;
	cache?: ICache;
};

export const createCloudflareSolver = (deps: TCloudflareSolverDeps): IChallengeSolver => {
	const vendor = "cloudflare";

	const detects = (statusCode: number, html: string): boolean => {
		const lower = html.toLowerCase();
		const hasChl = lower.includes("cf-chl-");
		const hasDomain = lower.includes("challenges.cloudflare.com");
		const hasMoment = lower.includes("just a moment...");
		const hasTurnstile = lower.includes("turnstile");
		const hasMarker = hasChl || hasDomain || hasMoment || hasTurnstile;
		const isForbidden = statusCode === 403;
		const isServiceUnavailable = statusCode === 503;
		const isBlocked = isForbidden || isServiceUnavailable || hasMarker;
		return isBlocked;
	};

	const findCachedClearance = async (
		hostname: string,
	): Promise<Record<string, string> | null> => {
		const hasCache = Boolean(deps.cache);
		const isCacheMissing = !hasCache;
		if (isCacheMissing) {
			return null;
		}

		try {
			const cached = await deps.cache!.get(hostname);
			const hasClearance = Boolean(cached?.cf_clearance);
			if (hasClearance) {
				process.stderr.write(`[cloudflare:cache:hit] found cached cf_clearance for ${hostname}\n`);
				return cached;
			}
			process.stderr.write(`[cloudflare:cache:miss] no cf_clearance in cache for ${hostname}\n`);
			return null;
		} catch (err: unknown) {
			const errorMessage = err instanceof Error ? err.message : String(err);
			process.stderr.write(`[cloudflare:cache:error] lookup failed: ${errorMessage}\n`);
			return null;
		}
	};

	const tryFetchWithClearance = async (
		url: string,
		cachedCookies: Record<string, string>,
		options?: TScrapeOptions,
	): Promise<TSolverOutcome | null> => {
		const hasTransport = Boolean(deps.transport);
		const isTransportMissing = !hasTransport;
		if (isTransportMissing) {
			return null;
		}

		const parsedUrl = new URL(url);
		const hostname = parsedUrl.hostname;

		const cookieMap: Record<string, string> = {};
		const hasExistingCookies = Boolean(options?.cookies);
		if (hasExistingCookies) {
			Object.assign(cookieMap, options!.cookies);
		}
		Object.assign(cookieMap, cachedCookies);

		const reFetchOptions: TScrapeOptions = {
			...options,
			cookies: cookieMap,
		};

		try {
			process.stderr.write("[cloudflare:pure-http] requesting target with cached clearance...\n");
			const directResp = await deps.transport!.fetch(url, reFetchOptions);
			const isStillBlocked = detects(directResp.status, directResp.body);
			const isOkStatus = directResp.status === 200;
			const isSuccess = !isStillBlocked && isOkStatus;

			if (isSuccess) {
				process.stderr.write("[cloudflare:pure-http:cleared] request passed with clearance\n");
				const cookieItems = Object.entries(cookieMap).map(([name, value]) => ({
					name: name,
					value: value,
					domain: hostname,
					path: "/",
				}));
				return {
					unblockedHtml: directResp.body,
					cookies: cookieItems,
					cleared: true,
				};
			}

			process.stderr.write(`[cloudflare:pure-http:expired] status=${directResp.status}\n`);
			return null;
		} catch (err: unknown) {
			const errorMessage = err instanceof Error ? err.message : String(err);
			process.stderr.write(`[cloudflare:pure-http:error] fetch error: ${errorMessage}\n`);
			return null;
		}
	};

	const harvestClearanceWithBrowser = async (
		url: string,
		options?: TScrapeOptions,
	): Promise<TSolverOutcome> => {
		process.stderr.write("[cloudflare:browser] launching camoufox for clearance handshake...\n");
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
			const ttlSeconds = 86400 * 30;
			await deps.cache!.set(hostname, page.cookies, ttlSeconds);
			process.stderr.write(`[cloudflare:cache:saved] stored ${page.cookies.length} cookies in sqlite\n`);
		}

		return {
			unblockedHtml: page.html,
			cookies: page.cookies,
			cleared: true,
		};
	};

	const solve = async (url: string, options?: TScrapeOptions): Promise<TSolverOutcome> => {
		const parsedUrl = new URL(url);
		const hostname = parsedUrl.hostname;

		const cachedCookies = await findCachedClearance(hostname);
		const hasCachedCookies = Boolean(cachedCookies);

		if (hasCachedCookies) {
			const pureOutcome = await tryFetchWithClearance(
				url,
				cachedCookies!,
				options,
			);
			const hasPureOutcome = Boolean(pureOutcome);
			if (hasPureOutcome) {
				return pureOutcome!;
			}
		}

		const fallbackOutcome = await harvestClearanceWithBrowser(url, options);
		return fallbackOutcome;
	};

	return {
		vendor: vendor,
		detects: detects,
		solve: solve,
	};
};
