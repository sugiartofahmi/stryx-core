import crypto from "node:crypto";
import type { TCookieItem, TScrapeOptions } from "@stryx/domain";

export type TPxIdentity = {
	vid: string;
	pxhd: string;
};

export const synthesizePxIdentity = (): TPxIdentity => {
	const rawVid = crypto.randomUUID();
	const rawSeed = crypto.randomUUID();
	const pxhd = `:${rawSeed}`;
	return {
		vid: rawVid,
		pxhd: pxhd,
	};
};

export const extractAppIdFromHtml = (html: string): string | null => {
	const scriptMatch = html.match(/client\.perimeterx\.net\/([A-Za-z0-9_-]+)\/main\.min\.js/);
	const hasScriptMatch = Boolean(scriptMatch && scriptMatch[1]);
	if (hasScriptMatch) {
		const captured = scriptMatch![1];
		return captured;
	}

	const initMatch = html.match(/\/([A-Za-z0-9]{8})\/init\.js/);
	const hasInitMatch = Boolean(initMatch && initMatch[1]);
	if (hasInitMatch) {
		const prefix = initMatch![1];
		const fullAppId = `PX${prefix}`;
		return fullAppId;
	}

	const varMatch = html.match(/_pxAppId\s*=\s*['"]([A-Za-z0-9]+)['"]/);
	const hasVarMatch = Boolean(varMatch && varMatch[1]);
	if (hasVarMatch) {
		const captured = varMatch![1];
		return captured;
	}

	const attrMatch = html.match(/appId:\s*['"]([A-Za-z0-9]+)['"]/);
	const hasAttrMatch = Boolean(attrMatch && attrMatch[1]);
	if (hasAttrMatch) {
		const captured = attrMatch![1];
		return captured;
	}

	return null;
};

export const resolveCollectorEndpoints = (hostname: string, appId: string): string[] => {
	const cleanPrefix = appId.replace(/^PX/, "");
	const firstPartyUrl = `https://${hostname}/${cleanPrefix}/xhr/api/v2/collector`;
	const lowerAppId = appId.toLowerCase();
	const thirdPartyUrl = `https://collector-${lowerAppId}.px-cloud.net/api/v2/collector`;
	const endpoints = [firstPartyUrl, thirdPartyUrl];
	return endpoints;
};

export const executePureHttpCollector = async (
	url: string,
	appId: string,
	identity: TPxIdentity,
	options?: TScrapeOptions,
): Promise<TCookieItem[] | null> => {
	const parsedUrl = new URL(url);
	const hostname = parsedUrl.hostname;
	const endpoints = resolveCollectorEndpoints(hostname, appId);

	const bodyParams = new URLSearchParams();
	bodyParams.set("appId", appId);
	bodyParams.set("tag", "v8.11.2");
	bodyParams.set("uuid", identity.vid);
	bodyParams.set("seq", "0");
	bodyParams.set("rsc", "1");
	bodyParams.set("ft", "257");
	const bodyString = bodyParams.toString();

	const cookieHeader = `_pxvid=${identity.vid}; _pxhd=${identity.pxhd}`;
	const headers: Record<string, string> = {
		"Content-Type": "application/x-www-form-urlencoded",
		Origin: `https://${hostname}`,
		Referer: url,
		Cookie: cookieHeader,
		"Sec-Fetch-Dest": "empty",
		"Sec-Fetch-Mode": "cors",
		"Sec-Fetch-Site": "same-origin",
	};

	let collectorSuccess = false;
	let px3Token = "";

	for (const endpoint of endpoints) {
		try {
			const timeout = options?.timeoutMs ?? 10000;
			const signal = AbortSignal.timeout(timeout);
			process.stderr.write(`[perimeterx:collector:dispatch] endpoint=${endpoint}\n`);
			const response = await fetch(endpoint, {
				method: "POST",
				headers: headers,
				body: bodyString,
				signal: signal,
			});

			const responseText = await response.text();
			const hasGetSetCookie = typeof response.headers.getSetCookie === "function";
			let setCookies: string[] = [];
			if (hasGetSetCookie) {
				setCookies = response.headers.getSetCookie();
			} else {
				const single = response.headers.get("set-cookie");
				const hasSingle = Boolean(single);
				if (hasSingle) {
					setCookies = [single!];
				}
			}

			for (const item of setCookies) {
				const match = item.match(/_px3=([^;]+)/);
				const hasCookieMatch = Boolean(match && match[1]);
				if (hasCookieMatch) {
					px3Token = match![1];
					collectorSuccess = true;
					break;
				}
			}

			const isMissingFromCookie = !collectorSuccess;
			const hasPx3InBody = responseText.includes("_px3");
			const isBodyParseRequired = isMissingFromCookie && hasPx3InBody;
			if (isBodyParseRequired) {
				const bodyMatch = responseText.match(/"_px3"\s*:\s*"([^"]+)"/);
				const hasBodyMatch = Boolean(bodyMatch && bodyMatch[1]);
				if (hasBodyMatch) {
					px3Token = bodyMatch![1];
					collectorSuccess = true;
					break;
				}
			}

			const isCompleted = collectorSuccess;
			if (isCompleted) {
				process.stderr.write(`[perimeterx:collector:success] px3 token acquired from ${endpoint}\n`);
				break;
			}
		} catch (err: unknown) {
			const errorMessage = err instanceof Error ? err.message : String(err);
			process.stderr.write(`[perimeterx:collector:error] endpoint=${endpoint} reason=${errorMessage}\n`);
		}
	}

	const isFailed = !collectorSuccess || !px3Token;
	if (isFailed) {
		process.stderr.write(`[perimeterx:collector:failed] unable to acquire _px3 token\n`);
		return null;
	}

	const cookies: TCookieItem[] = [
		{
			name: "_px3",
			value: px3Token,
			domain: hostname,
			path: "/",
		},
		{
			name: "_pxvid",
			value: identity.vid,
			domain: hostname,
			path: "/",
		},
		{
			name: "_pxhd",
			value: identity.pxhd,
			domain: hostname,
			path: "/",
		},
	];

	return cookies;
};
