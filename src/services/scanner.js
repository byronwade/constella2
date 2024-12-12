import { fdir } from "fdir";
import path from "path";

export async function scanDirectory(dirPath) {
	const normalizedPath = path.normalize(dirPath);

	const crawler = new fdir()
		.withFullPaths()
		.withMaxDepth(10)
		.withSymlinks()
		.withDirs()
		.normalize()
		.withBasePath(normalizedPath)
		.filter((filePath, isDirectory) => {
			const normalizedFilePath = path.normalize(filePath);
			return !normalizedFilePath.includes("node_modules") && !normalizedFilePath.includes(".git") && !normalizedFilePath.includes(".cache");
		});

	try {
		const files = await crawler.crawl(normalizedPath).withPromise();
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
