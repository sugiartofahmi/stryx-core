import type {
	IBrowserClient,
	ICache,
	IChallengeSolver,
	ITransportClient,
	TScrapeOptions,
	TSolverOutcome,
} from "@stryx/domain";

export type TNativeSolverDeps = {
	browser: IBrowserClient;
	transport: ITransportClient;
	cache: ICache;
};

const GENERIC_ANTI_MODAL_CSS = `
	.contextual-sign-in-modal,
	.modal__outlet,
	#artdeco-modal-outlet,
	[data-modal],
	.modal-wormhole,
	.sign-in-modal,
	.modal-backdrop,
	.modal__overlay,
	div[data-view-name*="sign-in-modal"],
	section[data-view-name*="sign-in-modal"] {
		display: none !important;
		opacity: 0 !important;
		pointer-events: none !important;
		visibility: hidden !important;
	}
	body {
		overflow: auto !important;
	}
`;

const GENERIC_ANTI_MODAL_SCRIPT = `
	(() => {
		const style = document.createElement("style");
		style.id = "stryx-anti-popup";
		const textNode = document.createTextNode(\`${GENERIC_ANTI_MODAL_CSS}\`);
		style.appendChild(textNode);
		const attach = () => {
			const hasHead = Boolean(document.head);
			if (hasHead) {
				document.head.appendChild(style);
			}
		};
		attach();
		document.addEventListener("DOMContentLoaded", attach);
	})();
`;

const GENERIC_DISMISS_SELECTORS = [
	".contextual-sign-in-modal",
	".modal__outlet",
	"#artdeco-modal-outlet",
	"[data-modal]",
	".modal-wormhole",
	".sign-in-modal",
	".modal-backdrop",
	".modal__overlay",
];

const injectAntiModalCss = (html: string): string => {
	const styleTag = `<style id="stryx-anti-popup">${GENERIC_ANTI_MODAL_CSS}</style>`;
	const hasHead = html.includes("</head>");
	if (hasHead) {
		const replaced = html.replace("</head>", `${styleTag}</head>`);
		return replaced;
	}
	const prepended = `${styleTag}${html}`;
	return prepended;
};

export const createNativeSolver = (deps: TNativeSolverDeps): IChallengeSolver => {
	const vendor = "generic";

	const detects = (statusCode: number, html: string): boolean => {
		const isForbidden = statusCode === 403;
		const isTooManyRequests = statusCode === 429;
		const isServiceUnavailable = statusCode === 503;
		const isBlockedStatus = isForbidden || isTooManyRequests || isServiceUnavailable;
		return isBlockedStatus;
	};

	const fetchCleanHtmlViaHttp = async (
		url: string,
		options?: TScrapeOptions,
	): Promise<TSolverOutcome | null> => {
		try {
			process.stderr.write("[native:pure-http] attempting pure http request with dom unlocking...\n");
			const response = await deps.transport.fetch(url, options);
			const isOkStatus = response.status === 200;
			const hasContent = response.body.length > 5000;
			const isSuccessful = isOkStatus && hasContent;

			if (isSuccessful) {
				process.stderr.write("[native:pure-http:cleared] extracted clean html via pure http\n");
				const cleanedHtml = injectAntiModalCss(response.body);
				const parsedUrl = new URL(url);
				const hostname = parsedUrl.hostname;
				const cookieItems = Object.entries(response.cookies).map(([name, value]) => ({
					name: name,
					value: value,
					domain: hostname,
					path: "/",
				}));

				const hasCookies = cookieItems.length > 0;
				if (hasCookies) {
					await deps.cache.set(hostname, cookieItems, 3600);
				}

				return {
					unblockedHtml: cleanedHtml,
					cookies: cookieItems,
					cleared: true,
				};
			}

			process.stderr.write(`[native:pure-http:failed] status=${response.status}, length=${response.body.length}\n`);
			return null;
		} catch (err: unknown) {
			const errorMessage = err instanceof Error ? err.message : String(err);
			process.stderr.write(`[native:pure-http:error] fetch error: ${errorMessage}\n`);
			return null;
		}
	};

	const harvestCleanHtmlWithBrowser = async (
		url: string,
		options?: TScrapeOptions,
	): Promise<TSolverOutcome> => {
		process.stderr.write("[native:browser] launching camoufox with anti-modal script...\n");
		const browserOpts = {
			headless: true,
			timeoutMs: options?.timeoutMs ?? 45000,
			cookies: options?.cookies,
			initScript: GENERIC_ANTI_MODAL_SCRIPT,
			dismissSelectors: GENERIC_DISMISS_SELECTORS,
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

	const solve = async (url: string, options?: TScrapeOptions): Promise<TSolverOutcome> => {
		const pureOutcome = await fetchCleanHtmlViaHttp(url, options);
		const hasPureOutcome = Boolean(pureOutcome);
		if (hasPureOutcome) {
			return pureOutcome!;
		}

		const fallbackOutcome = await harvestCleanHtmlWithBrowser(url, options);
		return fallbackOutcome;
	};

	return {
		vendor: vendor,
		detects: detects,
		solve: solve,
	};
};
