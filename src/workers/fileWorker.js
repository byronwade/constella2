const { parentPort } = require("worker_threads");
const { fdir } = require("fdir");

// System directories to exclude for maximum performance
const EXCLUDED_DIRS = ["Windows", "Program Files", "Program Files (x86)", "ProgramData", "Windows.old", "$Recycle.Bin", "System Volume Information", "node_modules", ".git"];

let isPaused = false;
let shouldCancel = false;

function shouldExcludeDir(dirPath) {
	return EXCLUDED_DIRS.some((excluded) => dirPath.includes(excluded));
}

// Helper to handle pausing
async function handlePause() {
	while (isPaused && !shouldCancel) {
		await new Promise((resolve) => setTimeout(resolve, 100));
	}
	return shouldCancel;
}

parentPort.on("message", async (message) => {
	if (message.type === "scan") {
		try {
			if (!message.dirPath) {
				throw new Error("No directory path provided");
			}

			isPaused = false;
			shouldCancel = false;

			// Start the count and timer
			const startTime = process.hrtime();

			parentPort.postMessage({
				type: "status",
				message: "Counting files...",
			});

			// Configure fdir for maximum speed
			const api = new fdir().withFullPaths().withDirs().crawl(message.dirPath);

			let totalItems = 0;
			await api.withPromise().then((files) => {
				// Process files in chunks to allow for pause/cancel
				for (let i = 0; i < files.length; i++) {
					if (shouldCancel) {
						parentPort.postMessage({ type: "cancelled" });
						return;
					}

					if (isPaused) {
						handlePause().then((cancelled) => {
							if (cancelled) {
								parentPort.postMessage({ type: "cancelled" });
								return;
							}
						});
					}

					const filePath = files[i];
					if (!shouldExcludeDir(filePath)) {
						totalItems++;
					}
				}

				// Calculate elapsed time
				const [seconds, nanoseconds] = process.hrtime(startTime);
				const timeInSeconds = seconds + nanoseconds / 1e9;
				const filesPerSecond = Math.round(totalItems / timeInSeconds);

				// Send the final count with timing information
				parentPort.postMessage({
					type: "result",
					success: true,
					stats: {
						totalFiles: totalItems,
						timeInSeconds: timeInSeconds,
						filesPerSecond: filesPerSecond,
					},
				});
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
