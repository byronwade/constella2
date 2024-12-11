import React, { useState, useEffect } from "react";
import { Command } from "cmdk";
import { Progress } from "./components/ui/progress";
import { Button } from "./components/ui/button";
import { ScrollArea } from "./components/ui/scroll-area";
import { useHotkeys } from "react-hotkeys-hook";

function App() {
	const [isScanning, setIsScanning] = useState(false);
	const [isPaused, setIsPaused] = useState(false);
	const [totalFiles, setTotalFiles] = useState(0);
	const [scanSpeed, setScanSpeed] = useState(0);
	const [scanTime, setScanTime] = useState(0);
	const [status, setStatus] = useState("");
	const [searchOpen, setSearchOpen] = useState(false);
	const [searchResults, setSearchResults] = useState([]);
	const [indexedCount, setIndexedCount] = useState(0);
	const [totalToIndex, setTotalToIndex] = useState(0);
	const [isIndexing, setIsIndexing] = useState(false);

	// Hotkey to open search
	useHotkeys("ctrl+shift+f", () => setSearchOpen(true));

	useEffect(() => {
		// Listen for scan updates
		window.electron.on("scanUpdate", (data) => {
			if (data.type === "status") {
				setStatus(data.message);
			} else if (data.type === "result") {
				setTotalFiles(data.stats.totalFiles);
				setScanSpeed(data.stats.filesPerSecond);
				setScanTime(data.stats.timeInSeconds);
				setIsScanning(false);
			} else if (data.type === "error") {
				setStatus(`Error: ${data.error}`);
				setIsScanning(false);
			}
		});

		// Listen for indexing updates
		window.electron.on("indexUpdate", (data) => {
			if (data.type === "progress") {
				setIndexedCount(data.indexed);
				setTotalToIndex(data.total);
			} else if (data.type === "status") {
				setStatus(data.message);
			} else if (data.type === "result") {
				setIsIndexing(false);
				setStatus("Indexing complete");
			} else if (data.type === "error") {
				setStatus(`Indexing error: ${data.error}`);
				setIsIndexing(false);
			}
		});

		// Listen for search results
		window.electron.on("searchResults", (results) => {
			setSearchResults(results);
		});
	}, []);

	const handleSelectDirectory = async () => {
		setIsScanning(true);
		setStatus("Selecting directory...");
		const result = await window.electron.selectDirectory();
		if (result) {
			setStatus("Starting scan...");
			window.electron.startScan(result);
		} else {
			setIsScanning(false);
			setStatus("Scan cancelled");
		}
	};

	const handlePause = () => {
		setIsPaused(!isPaused);
		window.electron.pauseScan(isPaused);
	};

	const handleCancel = () => {
		window.electron.cancelScan();
		setIsScanning(false);
		setIsIndexing(false);
		setStatus("Scan cancelled");
	};

	const handleSearch = async (query) => {
		if (!query) {
			setSearchResults([]);
			return;
		}
		window.electron.search(query);
	};

	return (
		<div className="container mx-auto p-4 min-h-screen bg-background text-foreground">
			<div className="space-y-4">
				<div className="flex justify-between items-center">
					<h1 className="text-2xl font-bold">File System Scanner</h1>
					<div className="space-x-2">
						<Button onClick={handleSelectDirectory} disabled={isScanning || isIndexing}>
							Select Directory
						</Button>
						{(isScanning || isIndexing) && (
							<>
								<Button onClick={handlePause}>{isPaused ? "Resume" : "Pause"}</Button>
								<Button onClick={handleCancel} variant="destructive">
									Cancel
								</Button>
							</>
						)}
					</div>
				</div>

				<div className="space-y-2">
					<div className="flex justify-between text-sm">
						<span>{status}</span>
						{(isScanning || isIndexing) && <span>{isIndexing ? `Indexed: ${indexedCount.toLocaleString()} / ${totalToIndex.toLocaleString()}` : `Files: ${totalFiles.toLocaleString()}`}</span>}
					</div>
					{(isScanning || isIndexing) && <Progress value={isIndexing ? (indexedCount / totalToIndex) * 100 : undefined} />}
				</div>

				{!isScanning && !isIndexing && totalFiles > 0 && (
					<div className="text-sm space-y-1">
						<p>Total Files: {totalFiles.toLocaleString()}</p>
						<p>Scan Time: {scanTime.toFixed(2)}s</p>
						<p>Speed: {scanSpeed.toLocaleString()} files/second</p>
					</div>
				)}

				{/* Search Command Palette */}
				<Command.Dialog open={searchOpen} onOpenChange={setSearchOpen} label="Search files" className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[640px] max-w-[90vw] max-h-[80vh] bg-background border rounded-lg shadow-lg">
					<Command.Input placeholder="Search files..." onValueChange={handleSearch} className="w-full border-b p-4 outline-none bg-transparent" />
					<ScrollArea className="p-4 h-[300px]">
						<Command.List>
							<Command.Empty>No results found.</Command.Empty>
							{searchResults.map((result) => (
								<Command.Item key={result.path} className="flex items-start p-2 hover:bg-accent rounded cursor-pointer" onSelect={() => window.electron.openFile(result.path)}>
									<div className="flex flex-col">
										<span className="font-medium">{result.name}</span>
										<span className="text-sm text-muted-foreground">{result.path}</span>
										<div className="text-xs text-muted-foreground mt-1">
											<span>
												{new Date(result.modified).toLocaleDateString()} • {(result.size / 1024).toFixed(2)} KB
											</span>
										</div>
									</div>
								</Command.Item>
							))}
						</Command.List>
					</ScrollArea>
				</Command.Dialog>
			</div>
		</div>
	);
}

export default App;
