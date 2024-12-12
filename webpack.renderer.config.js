const rules = require("./webpack.rules");
const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const webpack = require("webpack");

rules.push({
	test: /\.css$/,
	use: [{ loader: "style-loader" }, { loader: "css-loader", options: { importLoaders: 1 } }, { loader: "postcss-loader" }],
});

module.exports = {
	entry: {
		"main_window/index": "./src/index.js",
		"main_window/preload": "./src/preload.js",
	},
	output: {
		path: path.resolve(__dirname, ".webpack/renderer"),
		filename: "[name].js",
		publicPath: "./",
	},
	module: {
		rules,
	},
	resolve: {
		extensions: [".js", ".jsx", ".json"],
		alias: {
			"@": path.resolve(__dirname, "src"),
		},
		fallback: {
			path: require.resolve("path-browserify"),
			fs: false,
			os: false,
			events: require.resolve("events/"),
		},
	},
	plugins: [
		new HtmlWebpackPlugin({
			template: path.resolve(__dirname, "src/index.html"),
			filename: "main_window/index.html",
			chunks: ["main_window/index"],
		}),
		new webpack.ProvidePlugin({
			process: "process/browser",
		}),
	],
	target: "web",
};
