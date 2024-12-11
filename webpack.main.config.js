module.exports = {
	/**
	 * This is the main entry point for your application, it's the first file
	 * that runs in the main process.
	 */
	entry: {
		main: "./src/main.js",
		fileWorker: "./src/workers/fileWorker.js",
	},
	// Put your normal webpack config below here
	module: {
		rules: require("./webpack.rules"),
	},
	output: {
		filename: "[name].js",
	},
	node: {
		__dirname: false,
		__filename: false,
	},
	target: "electron-main",
};