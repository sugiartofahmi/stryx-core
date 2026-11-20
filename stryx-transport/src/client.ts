import type { ITransportClient, TScrapeOptions, TScrapeResponse } from "@stryx/domain";

export const createChromeHeaders = (
	customHeaders?: Record<string, string>,
	cookies?: Record<string, string>,
): Record<string, string> => {
	const defaultHeaders: Record<string, string> = {
		"User-Agent":
			"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
		Accept:
			"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
		"Accept-Language": "en-US,en;q=0.9,id;q=0.8",
		"Sec-Ch-Ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
		"Sec-Ch-Ua-Mobile": "?0",
		"Sec-Ch-Ua-Platform": '"Linux"',
		"Sec-Fetch-Dest": "document",
		"Sec-Fetch-Mode": "navigate",
		"Sec-Fetch-Site": "none",
		"Sec-Fetch-User": "?1",
		"Upgrade-Insecure-Requests": "1",
	};

	const hasCookies = Boolean(cookies);
	if (hasCookies) {
		const cookiePairs = Object.entries(cookies!).map(([k, v]) => `${k}=${v}`);
		const cookieString = cookiePairs.join("; ");
		const hasCookieString = cookieString.length > 0;
		if (hasCookieString) {
			defaultHeaders.Cookie = cookieString;
		}
	}

	const hasCustomHeaders = Boolean(customHeaders);
	if (hasCustomHeaders) {
		Object.assign(defaultHeaders, customHeaders!);
	}

	return defaultHeaders;
};

export const createTransportClient = (): ITransportClient => {
	const fetchMethod = async (url: string, options?: TScrapeOptions): Promise<TScrapeResponse> => {
		const headers = createChromeHeaders(options?.headers, options?.cookies);
		const timeout = options?.timeoutMs ?? 15000;
		const signal = AbortSignal.timeout(timeout);

		const response = await fetch(url, {
			method: "GET",
			headers: headers,
			signal: signal,
			redirect: "follow",
		});

		const body = await response.text();
		const responseHeaders: Record<string, string> = {};
		response.headers.forEach((value, key) => {
			const lowerKey = key.toLowerCase();
			responseHeaders[lowerKey] = value;
		});

		const cookies: Record<string, string> = {};
		const hasGetSetCookie = typeof response.headers.getSetCookie === "function";
		let setCookies: string[] = [];
		if (hasGetSetCookie) {
			setCookies = response.headers.getSetCookie();
		} else {
			const rawCookie = response.headers.get("set-cookie");
			const hasRawCookie = Boolean(rawCookie);
			if (hasRawCookie) {
				setCookies = [rawCookie!];
			}
		}

		for (const cookieStr of setCookies) {
			const cookieParts = cookieStr.split(";");
			const firstSegment = cookieParts[0];
			const hasFirstSegment = Boolean(firstSegment);
			const isSegmentMissing = !hasFirstSegment;
			if (isSegmentMissing) {
				continue;
			}
			const eqIndex = firstSegment!.indexOf("=");
			const isMissingEquals = eqIndex === -1;
			if (isMissingEquals) {
				continue;
			}
			const cookieName = firstSegment!.substring(0, eqIndex).trim();
			const cookieVal = firstSegment!.substring(eqIndex + 1).trim();
			cookies[cookieName] = cookieVal;
		}

		return {
			status: response.status,
			body: body,
			headers: responseHeaders,
			cookies: cookies,
		};
	};

	return {
		fetch: fetchMethod,
	};
};
