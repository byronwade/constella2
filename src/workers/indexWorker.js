const { parentPort } = require("worker_threads");
const { fdir } = require("fdir");
const fs = require("fs").promises;
const path = require("path");
const searchService = require("../services/searchService");

// File extensions we want to index content for
const TEXT_FILE_EXTENSIONS = new Set([".txt", ".js", ".jsx", ".ts", ".tsx", ".md", ".json", ".css", ".scss", ".html", ".htm", ".xml", ".yaml", ".yml", ".ini", ".conf", ".py", ".java", ".cpp", ".c", ".h", ".hpp", ".cs", ".go", ".rs", ".swift", ".kt", ".rb"]);

const MAX_FILE_SIZE = 1024 * 1024; // 1MB limit for text file indexing

let isPaused = false;
let shouldCancel = false;
let totalIndexed = 0;
let totalFiles = 0;

async function handlePause() {
	while (isPaused && !shouldCancel) {
		await new Promise((resolve) => setTimeout(resolve, 100));
	}
	return shouldCancel;
}

async function readFileContent(filePath, stats) {
	if (!TEXT_FILE_EXTENSIONS.has(path.extname(filePath).toLowerCase())) {
		return null;
	}

	if (stats.size > MAX_FILE_SIZE) {
		return null;
	}

	try {
		const content = await fs.readFile(filePath, "utf8");
		return content;
	} catch (error) {
		return null;
	}
}

async function processFile(filePath) {
	try {
		const stats = await fs.stat(filePath);
		const ext = path.extname(filePath).toLowerCase();
		const isTextFile = TEXT_FILE_EXTENSIONS.has(ext);

		// Read content for text files
		const content = isTextFile ? await readFileContent(filePath, stats) : null;

		const metadata = {
			path: filePath,
			name: path.basename(filePath),
			size: stats.size,
			modified: stats.mtime.getTime(),
			created: stats.birthtime.getTime(),
			isTextFile,
		};

		// Process for search indexing
		return await searchService.processFileForIndexing(metadata, content);
	} catch (error) {
		return null;
	}
}

async function indexBatch(files, startIdx, batchSize) {
	const batch = [];
	const endIdx = Math.min(startIdx + batchSize, files.length);

	for (let i = startIdx; i < endIdx; i++) {
		if (shouldCancel) return null;

		if (isPaused) {
			const cancelled = await handlePause();
			if (cancelled) return null;
		}

		const processedFile = await processFile(files[i]);
		if (processedFile) {
			batch.push(processedFile);
			totalIndexed++;

			if (totalIndexed % 100 === 0) {
				parentPort.postMessage({
					type: "progress",
					indexed: totalIndexed,
					total: totalFiles,
				});
			}
		}
	}

	return batch;
}

parentPort.on("message", async (message) => {
	if (message.type === "index") {
		try {
			if (!message.dirPath) {
				throw new Error("No directory path provided");
			}

			isPaused = false;
			shouldCancel = false;
			totalIndexed = 0;

			// Initialize search service
			await searchService.initialize();
			await searchService.deleteAllDocuments();

			const startTime = process.hrtime();

			// Get all files first
			const api = new fdir().withFullPaths().withDirs().crawl(message.dirPath);

			const files = await api.withPromise();
			totalFiles = files.length;

			parentPort.postMessage({
				type: "status",
				message: `Starting indexing of ${totalFiles} files...`,
			});

			// Process in batches of 1000 files
			const BATCH_SIZE = 1000;
			for (let i = 0; i < files.length; i += BATCH_SIZE) {
				if (shouldCancel) {
					parentPort.postMessage({ type: "cancelled" });
					return;
				}

				const batch = await indexBatch(files, i, BATCH_SIZE);
				if (!batch) {
					parentPort.postMessage({ type: "cancelled" });
					return;
				}

				if (batch.length > 0) {
					await searchService.addDocuments(batch);
				}
			}

			// Calculate timing information
			const [seconds, nanoseconds] = process.hrtime(startTime);
			const timeInSeconds = seconds + nanoseconds / 1e9;
			const filesPerSecond = Math.round(totalIndexed / timeInSeconds);

			parentPort.postMessage({
				type: "result",
				success: true,
				stats: {
					totalFiles: totalIndexed,
					timeInSeconds: timeInSeconds,
					filesPerSecond: filesPerSecond,
				},
			});
		} catch (error) {
			parentPort.postMessage({
				type: "error",
				error: error.message || "Unknown error occurred",
			});
		}
	} else if (message.type === "pause") {
		isPaused = message.isPaused;
		parentPort.postMessage({
			type: "paused",
			isPaused,
		});
	} else if (message.type === "cancel") {
		shouldCancel = true;
		isPaused = false;
	}
});

// Handle errors
process.on("uncaughtException", (error) => {
	parentPort.postMessage({
		type: "error",
		error: `Uncaught error: ${error.message}`,
	});
});

process.on("unhandledRejection", (reason) => {
	parentPort.postMessage({
		type: "error",
		error: `Unhandled rejection: ${reason}`,
	});
});
