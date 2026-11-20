import type {
	IBrowserClient,
	ICache,
	IChallengeSolver,
	TScrapeOptions,
	TSolverOutcome,
} from "@stryx/domain";

export type TNativeSolverDeps = {
	browser: IBrowserClient;
	cache?: ICache;
};

const GENERIC_ANTI_MODAL_SCRIPT = `
	(() => {
		const css = \`
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
		\`;
		const style = document.createElement("style");
		style.id = "stryx-anti-popup";
		const textNode = document.createTextNode(css);
		style.appendChild(textNode);
		const attach = () => {
			if (document.head) {
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

export const createNativeSolver = (deps: TNativeSolverDeps): IChallengeSolver => {
	const vendor = "generic";

	const detects = (statusCode: number, html: string): boolean => {
		const isBlockedStatus = statusCode === 403 || statusCode === 429 || statusCode === 503;
		return isBlockedStatus;
	};

	const solve = async (url: string, options?: TScrapeOptions): Promise<TSolverOutcome> => {
		const browserOpts = {
			headless: true,
			timeoutMs: options?.timeoutMs ?? 45000,
			cookies: options?.cookies,
			initScript: GENERIC_ANTI_MODAL_SCRIPT,
			dismissSelectors: GENERIC_DISMISS_SELECTORS,
		};
		const page = await deps.browser.fetchPage(url, browserOpts);

		if (deps.cache && page.cookies.length > 0) {
			const parsedUrl = new URL(url);
			const hostname = parsedUrl.hostname;
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
