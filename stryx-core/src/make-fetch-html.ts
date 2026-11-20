import type {
	ICache,
	ISolverRegistry,
	ITransportClient,
	IWafDetector,
	TScrapeOptions,
	TScrapeResponse,
} from "@stryx/domain";

export type TFetchHtml = (url: string, options?: TScrapeOptions) => Promise<TScrapeResponse>;

export type TCoreDeps = {
	transport: ITransportClient;
	detector: IWafDetector;
	solvers: ISolverRegistry;
	cache?: ICache;
};

export const makeFetchHtml = (deps: TCoreDeps): TFetchHtml => {
	const fetchHtml = async (url: string, options?: TScrapeOptions): Promise<TScrapeResponse> => {
		const parsedUrl = new URL(url);
		const hostname = parsedUrl.hostname;

		const activeCookies: Record<string, string> = {};

		const hasCache = Boolean(deps.cache);
		if (hasCache) {
			const cached = await deps.cache!.get(hostname);
			const hasCached = Boolean(cached);
			if (hasCached) {
				Object.assign(activeCookies, cached!);
			}
		}

		const hasOptionsCookies = Boolean(options?.cookies);
		if (hasOptionsCookies) {
			Object.assign(activeCookies, options!.cookies);
		}

		const mergedOptions: TScrapeOptions = {
			...options,
			cookies: activeCookies,
		};

		let response: TScrapeResponse | null = null;
		try {
			response = await deps.transport.fetch(url, mergedOptions);
		} catch (err: unknown) {
			const errorMessage = err instanceof Error ? err.message : String(err);
			process.stderr.write(`[core:transport:fetch:error] url=${url} reason=${errorMessage}\n`);
			response = null;
		}

		const hasResponse = Boolean(response);
		if (hasResponse) {
			const detectedVendor = deps.detector.detect(response!.status, response!.body);
			const isClear = detectedVendor === "none";
			if (isClear) {
				const cookieKeys = Object.keys(response!.cookies);
				const hasNewCookies = cookieKeys.length > 0;
				const isCacheableNewCookies = hasCache && hasNewCookies;
				if (isCacheableNewCookies) {
					await deps.cache!.set(hostname, response!.cookies, 3600);
				}
				return response!;
			}

			process.stderr.write(`[core:challenge:detected] vendor=${detectedVendor} url=${url}\n`);
			const solver = deps.solvers.get(detectedVendor);
			const outcome = await solver.solve(url, mergedOptions);
			const cookieMap: Record<string, string> = {};
			for (const c of outcome.cookies) {
				cookieMap[c.name] = c.value;
			}
			const hasOutcomeCookies = outcome.cookies.length > 0;
			const isCacheableOutcome = hasCache && hasOutcomeCookies;
			if (isCacheableOutcome) {
				await deps.cache!.set(hostname, cookieMap, 3600);
			}
			return {
				status: 200,
				body: outcome.unblockedHtml,
				headers: {},
				cookies: cookieMap,
			};
		}

		process.stderr.write(`[core:transport:empty] routing to generic fallback solver url=${url}\n`);
		const fallbackSolver = deps.solvers.get("generic");
		const outcome = await fallbackSolver.solve(url, mergedOptions);
		const cookieMap: Record<string, string> = {};
		for (const c of outcome.cookies) {
			cookieMap[c.name] = c.value;
		}
		const hasFallbackCookies = outcome.cookies.length > 0;
		const isCacheableFallback = hasCache && hasFallbackCookies;
		if (isCacheableFallback) {
			await deps.cache!.set(hostname, cookieMap, 3600);
		}

		return {
			status: 200,
			body: outcome.unblockedHtml,
			headers: {},
			cookies: cookieMap,
		};
	};

	return fetchHtml;
};
