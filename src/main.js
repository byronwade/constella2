import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "node:path";
import started from "electron-squirrel-startup";
import { Worker } from "worker_threads";
import { exec } from "child_process";
import { spawn } from "child_process";
import searchService from "./services/searchService";

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
	app.quit();
}

let mainWindow = null;
let fileWorker = null;
let indexWorker = null;
let meiliSearchProcess = null;

const MEILISEARCH_MASTER_KEY = "O4FcFl_zfVnYZt6Tm007DyfzpmoiccdK1PTn6g7Ei14";

function log(...args) {
	const timestamp = new Date().toISOString();
	console.log(`[${timestamp}]`, ...args);
}

const createWindow = async () => {
	log("Application ready, creating window");

	// Create the browser window.
	mainWindow = new BrowserWindow({
		width: 1200,
		height: 800,
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
			preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
		},
	});

	// and load the index.html of the app.
	await mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

	// Open the DevTools in development.
	if (process.env.NODE_ENV === "development") {
		mainWindow.webContents.openDevTools();
	}
};

// Start MeiliSearch server
async function startMeiliSearch() {
	return new Promise((resolve, reject) => {
		try {
			// Start MeiliSearch server
			meiliSearchProcess = spawn("meilisearch", ["--master-key", MEILISEARCH_MASTER_KEY], {
				stdio: "pipe",
			});

			meiliSearchProcess.stdout.on("data", (data) => {
				log("MeiliSearch:", data.toString());
				if (data.toString().includes("Server is listening")) {
					resolve();
				}
			});

			meiliSearchProcess.stderr.on("data", (data) => {
				log("MeiliSearch Error:", data.toString());
			});

			meiliSearchProcess.on("error", (error) => {
				log("Failed to start MeiliSearch:", error);
				reject(error);
			});

			// Clean up MeiliSearch process on app quit
			app.on("before-quit", () => {
				if (meiliSearchProcess) {
					meiliSearchProcess.kill();
				}
			});
		} catch (error) {
			log("Error starting MeiliSearch:", error);
			reject(error);
		}
	});
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
	try {
		await startMeiliSearch();
		await createWindow();
	} catch (error) {
		log("Error during app initialization:", error);
	}

	app.on("activate", async () => {
		// On macOS it's common to re-create a window in the app when the
		// dock icon is clicked and there are no other windows open.
		if (BrowserWindow.getAllWindows().length === 0) {
			await createWindow();
		}
	});
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit();
	}
});

// Safely send message to renderer
function safelySendToRenderer(channel, ...args) {
	try {
		if (mainWindow && !mainWindow.isDestroyed()) {
			mainWindow.webContents.send(channel, ...args);
		}
	} catch (error) {
		console.error("Error sending to renderer:", error);
	}
}

function cleanupWorker() {
	if (fileWorker) {
		try {
			fileWorker.terminate();
		} catch (error) {
			console.error("Error terminating worker:", error);
		}
		fileWorker = null;
	}
	if (indexWorker) {
		try {
			indexWorker.terminate();
		} catch (error) {
			console.error("Error terminating worker:", error);
		}
		indexWorker = null;
	}
}

function createFileWorker() {
	// Clean up any existing worker
	cleanupWorker();

	log("Creating new file worker thread");

	// Create new worker with correct webpack path
	const workerPath = path.join(__dirname, "fileWorker.js");
	log("Worker path:", workerPath);

	fileWorker = new Worker(workerPath);

	fileWorker.on("message", (message) => {
		log("Received worker message:", message);
		mainWindow.webContents.send("scanUpdate", message);

		if (message.type === "result") {
			log(`Worker completed: ${message.stats.totalFiles} files in ${message.stats.timeInSeconds.toFixed(3)}s`);
			// Start indexing after counting is complete
			startIndexing(message.dirPath);
		}
	});

	fileWorker.on("error", (error) => {
		console.error("Worker error:", error);
		mainWindow.webContents.send("scanUpdate", {
			type: "error",
			error: error.message,
		});
	});

	fileWorker.on("exit", (code) => {
		log("Worker stopped with exit code", code);
		fileWorker = null;
	});

	return fileWorker;
}

function createIndexWorker() {
	log("Creating new index worker thread");
	const workerPath = path.join(__dirname, "indexWorker.js");
	log("Index worker path:", workerPath);

	indexWorker = new Worker(workerPath);

	indexWorker.on("message", (message) => {
		log("Received index worker message:", message);
		mainWindow.webContents.send("indexUpdate", message);
	});

	indexWorker.on("error", (error) => {
		console.error("Index worker error:", error);
		mainWindow.webContents.send("indexUpdate", {
			type: "error",
			error: error.message,
		});
	});

	indexWorker.on("exit", (code) => {
		log("Index worker stopped with exit code", code);
		indexWorker = null;
	});

	return indexWorker;
}

function startIndexing(dirPath) {
	if (!dirPath) {
		log("No directory path provided for indexing");
		return;
	}

	log("Starting indexing for directory:", dirPath);
	if (indexWorker) {
		indexWorker.terminate();
	}

	indexWorker = createIndexWorker();
	indexWorker.postMessage({
		type: "index",
		dirPath,
	});
}

// Handle directory selection
ipcMain.handle("select-directory", async () => {
	log("Opening directory selection dialog");
	const result = await dialog.showOpenDialog({
		properties: ["openDirectory"],
	});

	if (!result.canceled && result.filePaths.length > 0) {
		log("Selected directory:", result.filePaths[0]);
		return result.filePaths[0];
	}
	log("Directory selection cancelled");
	return null;
});

// Handle directory scanning
ipcMain.on("start-scan", async (event, dirPath) => {
	log("Starting directory scan:", dirPath);

	// Check if directory exists and is accessible
	try {
		const fs = require("fs");
		await fs.promises.access(dirPath, fs.constants.R_OK);
	} catch (error) {
		log("Directory access error:", error);
		mainWindow.webContents.send("scanUpdate", {
			type: "error",
			error: `Cannot access directory: ${error.message}`,
		});
		return;
	}

	// Create and start worker
	const worker = createFileWorker(dirPath);
	worker.postMessage({ type: "scan", dirPath });
});

// Handle pause/resume
ipcMain.handle("toggle-pause-scan", () => {
	if (fileWorker) {
		fileWorker.postMessage({ type: "pause", isPaused: true });
	}
	if (indexWorker) {
		indexWorker.postMessage({ type: "pause", isPaused: true });
	}
});

// Handle cancel
ipcMain.handle("cancel-scan", () => {
	if (fileWorker) {
		fileWorker.postMessage({ type: "cancel" });
	}
	if (indexWorker) {
		indexWorker.postMessage({ type: "cancel" });
	}
});

// Search handlers
ipcMain.on("search", async (event, query) => {
	try {
		const results = await searchService.search(query);
		mainWindow.webContents.send("searchResults", results.hits);
	} catch (error) {
		console.error("Search error:", error);
		mainWindow.webContents.send("searchResults", []);
	}
});

// File opening handler
ipcMain.on("open-file", (event, filePath) => {
	// Use the default system application to open the file
	const command = process.platform === "win32" ? `start "" "${filePath}"` : `open "${filePath}"`;

	exec(command, (error) => {
		if (error) {
			console.error("Error opening file:", error);
		}
	});
});
