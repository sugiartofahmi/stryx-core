import type { IChallengeSolver, ISolverRegistry, TWafVendor } from "@stryx/domain";

export const createSolverRegistry = (initialSolvers?: IChallengeSolver[]): ISolverRegistry => {
	const registry = new Map<TWafVendor, IChallengeSolver>();

	if (initialSolvers) {
		for (const solver of initialSolvers) {
			registry.set(solver.vendor, solver);
		}
	}

	const register = (solver: IChallengeSolver): void => {
		registry.set(solver.vendor, solver);
	};

	const get = (vendor: TWafVendor): IChallengeSolver => {
		const matched = registry.get(vendor);
		if (matched) {
			return matched;
		}

		const fallback = registry.get("generic");
		if (fallback) {
			return fallback;
		}

		const errMessage = `No solver registered for vendor: ${vendor}`;
		throw new Error(errMessage);
	};

	return {
		register: register,
		get: get,
	};
};
