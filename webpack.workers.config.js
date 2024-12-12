const path = require("path");

module.exports = {
	entry: {
		fileWorker: "./src/workers/fileWorker.js",
		indexWorker: "./src/workers/indexWorker.js",
	},
	target: "node",
	mode: "development",
	output: {
		filename: "[name].js",
		path: path.resolve(__dirname, ".webpack/main"),
	},
	resolve: {
		extensions: [".js", ".json"],
	},
	externals: {
		worker_threads: "commonjs worker_threads",
		events: "commonjs events",
	},
	node: {
		__dirname: false,
		__filename: false,
	},
};
