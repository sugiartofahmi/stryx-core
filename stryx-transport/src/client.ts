import { type Browser, Impit } from "impit";
import type { ITransportClient, TScrapeOptions, TScrapeResponse } from "@stryx/domain";

export type TTransportClientOptions = {
	browser?: Browser;
	ignoreTlsErrors?: boolean;
};

export const createTransportClient = (config?: TTransportClientOptions): ITransportClient => {
	const selectedBrowser: Browser = config?.browser ?? "chrome";
	const defaultClient = new Impit({
		browser: selectedBrowser,
		ignoreTlsErrors: config?.ignoreTlsErrors ?? true,
	});

	const proxyClients = new Map<string, Impit>();

	const resolveClient = (proxy?: string): Impit => {
		const hasProxy = Boolean(proxy);
		const isProxyMissing = !hasProxy;
		if (isProxyMissing) {
			return defaultClient;
		}

		const existing = proxyClients.get(proxy!);
		const hasExisting = Boolean(existing);
		if (hasExisting) {
			return existing!;
		}

		const created = new Impit({
			browser: selectedBrowser,
			proxyUrl: proxy,
			ignoreTlsErrors: config?.ignoreTlsErrors ?? true,
		});
		proxyClients.set(proxy!, created);
		return created;
	};

	const fetchMethod = async (url: string, options?: TScrapeOptions): Promise<TScrapeResponse> => {
		const proxyParam = options?.proxy;
		const client = resolveClient(proxyParam);
		const headers: Record<string, string> = {};

		const hasCustomHeaders = Boolean(options?.headers);
		if (hasCustomHeaders) {
			Object.assign(headers, options!.headers);
		}

		const hasCookies = Boolean(options?.cookies);
		if (hasCookies) {
			const rawCookies = options!.cookies!;
			const cookiePairs = Object.entries(rawCookies).map(([k, v]) => `${k}=${v}`);
			const cookieString = cookiePairs.join("; ");
			const hasCookieString = cookieString.length > 0;
			if (hasCookieString) {
				headers.Cookie = cookieString;
			}
		}

		const timeout = options?.timeoutMs ?? 15000;
		const fetchInit = {
			headers: headers,
			timeout: timeout,
		};

		const response = await client.fetch(url, fetchInit);

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
			const rawName = firstSegment!.substring(0, eqIndex);
			const cookieName = rawName.trim();
			const startPos = eqIndex + 1;
			const rawVal = firstSegment!.substring(startPos);
			const cookieVal = rawVal.trim();
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
