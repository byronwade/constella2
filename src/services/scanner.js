import { fdir } from "fdir";

export async function scanDirectory(path) {
	const crawler = new fdir()
		.withFullPaths()
		.withMaxDepth(10)
		.withSymlinks()
		.withDirs()
		.withBasePath(path)
		.filter((path, isDirectory) => !path.includes("node_modules") && !path.includes(".git"));

	try {
		const files = await crawler.crawl(path).withPromise();
		return {
			success: true,
			files,
			error: null,
		};
	} catch (error) {
		return {
			success: false,
			files: [],
			error: error.message,
		};
	}
}
