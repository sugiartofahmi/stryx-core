import { type TCamoufoxClientOptions, createCamoufoxClient } from "@stryx/browser";
import { createMemoryCache } from "@stryx/cache";
import { createWafDetector } from "@stryx/detector";
import type {
	IBrowserClient,
	ICache,
	ISolverRegistry,
	ITransportClient,
	IWafDetector,
} from "@stryx/domain";
import {
	createCaptchaSolver,
	createCloudflareSolver,
	createDatadomeSolver,
	createNativeSolver,
	createPerimeterxSolver,
	createSolverRegistry,
	createTurnstileSolver,
} from "@stryx/solver";
import { createTransportClient } from "@stryx/transport";
import { type TFetchHtml, makeFetchHtml } from "./make-fetch-html.js";

export type TEngineConfig = {
	camoufox?: TCamoufoxClientOptions;
	cache?: ICache;
};

export type TStryxEngine = {
	fetchHtml: TFetchHtml;
	transport: ITransportClient;
	browser: IBrowserClient;
	detector: IWafDetector;
	solvers: ISolverRegistry;
	cache: ICache;
};

export const buildStryxEngine = (config?: TEngineConfig): TStryxEngine => {
	const transport = createTransportClient();
	const browser = createCamoufoxClient(config?.camoufox);
	const cache = config?.cache || createMemoryCache();
	const detector = createWafDetector();

	const cloudflareDeps = { browser: browser, cache: cache };
	const turnstileDeps = { browser: browser, cache: cache };
	const perimeterxDeps = { browser: browser, cache: cache };
	const datadomeDeps = { browser: browser, cache: cache };
	const captchaDeps = { browser: browser, cache: cache };
	const nativeDeps = { browser: browser, cache: cache };

	const cloudflareSolver = createCloudflareSolver(cloudflareDeps);
	const turnstileSolver = createTurnstileSolver(turnstileDeps);
	const perimeterxSolver = createPerimeterxSolver(perimeterxDeps);
	const datadomeSolver = createDatadomeSolver(datadomeDeps);
	const captchaSolver = createCaptchaSolver(captchaDeps);
	const nativeSolver = createNativeSolver(nativeDeps);

	const initialSolvers = [
		cloudflareSolver,
		turnstileSolver,
		perimeterxSolver,
		datadomeSolver,
		captchaSolver,
		nativeSolver,
	];

	const solvers = createSolverRegistry(initialSolvers);

	const coreDeps = {
		transport: transport,
		detector: detector,
		solvers: solvers,
		cache: cache,
	};

	const fetchHtml = makeFetchHtml(coreDeps);

	return {
		fetchHtml: fetchHtml,
		transport: transport,
		browser: browser,
		detector: detector,
		solvers: solvers,
		cache: cache,
	};
};
