// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer } = require("electron");

function log(...args) {
	const timestamp = new Date().toISOString();
	console.log(`[Preload ${timestamp}]`, ...args);
}

contextBridge.exposeInMainWorld("electron", {
	selectDirectory: () => ipcRenderer.invoke("select-directory"),
	startScan: (dirPath) => {
		log("Starting scan for directory:", dirPath);
		ipcRenderer.send("start-scan", dirPath);
	},
	pauseScan: (isPaused) => ipcRenderer.send("pause-scan", isPaused),
	cancelScan: () => ipcRenderer.send("cancel-scan"),
	search: (query) => ipcRenderer.send("search", query),
	openFile: (path) => ipcRenderer.send("open-file", path),
	on: (channel, callback) => {
		const validChannels = ["scanUpdate", "indexUpdate", "searchResults"];
		if (validChannels.includes(channel)) {
			const subscription = (_event, ...args) => callback(...args);
			ipcRenderer.on(channel, subscription);
			return () => {
				ipcRenderer.removeListener(channel, subscription);
			};
		}
	},
});

log("Preload script initialized");
