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

		if (deps.cache) {
			const cached = await deps.cache.get(hostname);
			if (cached) {
				Object.assign(activeCookies, cached);
			}
		}

		if (options?.cookies) {
			Object.assign(activeCookies, options.cookies);
		}

		const mergedOptions: TScrapeOptions = {
			...options,
			cookies: activeCookies,
		};

		let response: TScrapeResponse | null = null;
		try {
			response = await deps.transport.fetch(url, mergedOptions);
		} catch {
			response = null;
		}

		if (response) {
			const detectedVendor = deps.detector.detect(response.status, response.body);
			if (detectedVendor === "none") {
				return response;
			}

			const solver = deps.solvers.get(detectedVendor);
			const outcome = await solver.solve(url, mergedOptions);
			const cookieMap: Record<string, string> = {};
			for (const c of outcome.cookies) {
				cookieMap[c.name] = c.value;
			}
			return {
				status: 200,
				body: outcome.unblockedHtml,
				headers: {},
				cookies: cookieMap,
			};
		}

		const fallbackSolver = deps.solvers.get("generic");
		const outcome = await fallbackSolver.solve(url, mergedOptions);
		const cookieMap: Record<string, string> = {};
		for (const c of outcome.cookies) {
			cookieMap[c.name] = c.value;
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
