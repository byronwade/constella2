const { MeiliSearch } = require("meilisearch");

class SearchService {
	constructor() {
		// Initialize MeiliSearch client
		this.client = new MeiliSearch({
			host: "http://localhost:7700",
			apiKey: "O4FcFl_zfVnYZt6Tm007DyfzpmoiccdK1PTn6g7Ei14", // Use the generated master key
		});
		this.indexName = "files";
		this.initialized = false;
	}

	async initialize() {
		if (this.initialized) return;

		try {
			// Get or create the files index
			this.index = this.client.index(this.indexName);

			// Create index if it doesn't exist
			try {
				await this.client.createIndex(this.indexName, { primaryKey: "path" });
			} catch (error) {
				// Index might already exist, which is fine
				if (!error.message.includes("already exists")) {
					throw error;
				}
			}

			// Configure searchable attributes
			await this.index.updateSettings({
				searchableAttributes: ["path", "name", "content", "extension"],
				filterableAttributes: ["size", "modified", "created", "extension", "isTextFile"],
				sortableAttributes: ["size", "modified", "created"],
				rankingRules: ["words", "typo", "proximity", "attribute", "sort", "exactness"],
			});

			this.initialized = true;
		} catch (error) {
			console.error("Failed to initialize MeiliSearch:", error);
			throw error;
		}
	}

	async addDocuments(documents, options = {}) {
		if (!this.initialized) await this.initialize();

		try {
			const result = await this.index.addDocuments(documents, options);
			return result;
		} catch (error) {
			console.error("Failed to add documents:", error);
			throw error;
		}
	}

	async search(query, options = {}) {
		if (!this.initialized) await this.initialize();

		try {
			const searchResults = await this.index.search(query, {
				limit: 50,
				...options,
			});
			return searchResults;
		} catch (error) {
			console.error("Failed to perform search:", error);
			throw error;
		}
	}

	async deleteAllDocuments() {
		if (!this.initialized) await this.initialize();

		try {
			const result = await this.index.deleteAllDocuments();
			return result;
		} catch (error) {
			console.error("Failed to delete documents:", error);
			throw error;
		}
	}

	// Helper method to create trigrams from text
	createTrigrams(text) {
		if (!text || typeof text !== "string") return [];
		const normalized = text
			.toLowerCase()
			.replace(/[^a-z0-9]/g, " ")
			.trim();
		const words = normalized.split(/\s+/);
		const trigrams = new Set();

		// Word-level trigrams
		words.forEach((word) => {
			if (word.length >= 3) {
				for (let i = 0; i <= word.length - 3; i++) {
					trigrams.add(word.slice(i, i + 3));
				}
			} else {
				trigrams.add(word);
			}
		});

		return Array.from(trigrams);
	}

	// Process file metadata and content for indexing
	async processFileForIndexing(metadata, content = null) {
		const { path, name, size, modified, created, isTextFile } = metadata;

		const extension = name.split(".").pop().toLowerCase();
		const trigrams = new Set([...this.createTrigrams(path), ...this.createTrigrams(name)]);

		if (content && isTextFile) {
			trigrams.add(...this.createTrigrams(content));
		}

		return {
			path,
			name,
			size,
			modified,
			created,
			extension,
			isTextFile,
			trigrams: Array.from(trigrams),
			content: content || null,
		};
	}
}

module.exports = new SearchService();
