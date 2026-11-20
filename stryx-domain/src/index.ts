export type TWafVendor =
	| "cloudflare"
	| "turnstile"
	| "perimeterx"
	| "datadome"
	| "captcha"
	| "generic"
	| "none";

export type TScrapeOptions = {
	timeoutMs?: number;
	headers?: Record<string, string>;
	params?: Record<string, string | number>;
	proxy?: string;
	cookies?: Record<string, string>;
};

export type TBrowserOptions = {
	headless?: boolean;
	timeoutMs?: number;
	proxy?: string;
	cookies?: Record<string, string>;
};

export type TRetryPolicy = {
	maxAttempts: number;
	initialDelayMs: number;
	maxDelayMs: number;
};

export type TCookieItem = {
	name: string;
	value: string;
	domain?: string;
	path?: string;
	expires?: number;
	httpOnly?: boolean;
	secure?: boolean;
};

export type TScrapeResponse = {
	status: number;
	body: string;
	headers: Record<string, string>;
	cookies: Record<string, string>;
};

export type TPageSnapshot = {
	url: string;
	status: number;
	html: string;
	cookies: TCookieItem[];
};

export type TSolverOutcome = {
	unblockedHtml: string;
	cookies: TCookieItem[];
	cleared: boolean;
};

export interface ITransportClient {
	fetch(url: string, options?: TScrapeOptions): Promise<TScrapeResponse>;
}

export interface IBrowserClient {
	fetchPage(url: string, options?: TBrowserOptions): Promise<TPageSnapshot>;
}

export interface IWafDetector {
	detect(statusCode: number, html: string): TWafVendor;
}

export interface IChallengeSolver {
	readonly vendor: TWafVendor;
	detects(statusCode: number, html: string): boolean;
	solve(url: string, options?: TScrapeOptions): Promise<TSolverOutcome>;
}

export interface ISolverRegistry {
	get(vendor: TWafVendor): IChallengeSolver;
	register(solver: IChallengeSolver): void;
}

export interface ICache {
	get(key: string): Promise<Record<string, string> | null>;
	set(
		key: string,
		cookies: Record<string, string> | TCookieItem[],
		ttlSeconds?: number,
	): Promise<void>;
}

export class StryxError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "StryxError";
	}
}

export class ChallengeBlockedError extends StryxError {
	constructor(
		public readonly vendor: TWafVendor,
		message: string,
	) {
		super(message);
		this.name = "ChallengeBlockedError";
	}
}
