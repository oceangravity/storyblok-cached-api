# 🚀 Storyblok Cached API for Astro

A lightweight, disk-caching wrapper for the Storyblok API in Astro projects that speeds up development by caching API responses to disk.

## 📦 Installation

```bash
pnpm add storyblok-cached-api
```

```bash
npm install storyblok-cached-api
```

```bash
yarn add storyblok-cached-api
```

## ✨ Features

- **💾 Disk-based caching** - Automatically caches API responses during development
- **⚡ Faster development** - Load cached stories instead of making repeated API calls
- **🎯 Drop-in replacement** - Works exactly like the original `useStoryblokApi()`
- **🔧 Configurable** - Control cache directory, verbosity, and enable/disable caching
- **📝 TypeScript strict** - Written in strict TypeScript with full type safety
- **🧪 Fully tested** - Comprehensive test suite with 100% coverage

## 🎯 Why?

During development, you often refresh your page multiple times, causing repeated API calls to Storyblok. This library caches those responses to disk, making subsequent requests instant and reducing API quota usage.

## 📖 Usage

### Basic Usage

Simply replace `useStoryblokApi()` with `useCachedStoryblokApi()`:

```typescript
// Before
import { useStoryblokApi } from "@storyblok/astro";

const storyblokApi = useStoryblokApi();
const { data } = await storyblokApi.get("cdn/stories/home");
```

```typescript
// After
import { useCachedStoryblokApi } from "storyblok-cached-api";

const storyblokApi = useCachedStoryblokApi();
const { data } = await storyblokApi.get("cdn/stories/home");
```

That's it! Your API responses are now cached to `.sb-dev-cache/` in your project root.

### With Custom Options

```typescript
import { useCachedStoryblokApi } from "storyblok-cached-api";

const storyblokApi = useCachedStoryblokApi({
  enableCache: true,           // Enable/disable caching (default: NODE_ENV === 'development')
  cacheDir: "my-custom-cache", // Custom cache directory (default: '.sb-dev-cache')
  verbose: false,              // Disable console logs (default: true)
});

const { data } = await storyblokApi.get("cdn/stories/home", {
  version: "draft",
});
```

### Complete Example in Astro

```astro
---
// src/pages/index.astro
import { useCachedStoryblokApi } from "storyblok-cached-api";

const storyblokApi = useCachedStoryblokApi();

// First request hits the API and caches the response
const { data } = await storyblokApi.get("cdn/stories/home", {
  version: "draft",
});

// Subsequent requests load from cache instantly
const story = data.story;
---

<html>
  <head>
    <title>{story.name}</title>
  </head>
  <body>
    <h1>{story.content.title}</h1>
  </body>
</html>
```

## 🔧 API Reference

### `useCachedStoryblokApi(options?)`

Returns a Storyblok API instance with caching enabled.

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enableCache` | `boolean` | `process.env.NODE_ENV === 'development'` | Enable or disable caching |
| `cacheDir` | `string` | `'.sb-dev-cache'` | Directory path for cache storage |
| `verbose` | `boolean` | `true` | Enable console logging for cache operations |

### `generateCacheKey(path, params?)`

Generates a unique cache key based on the path and parameters.

```typescript
import { generateCacheKey } from "storyblok-cached-api";

const key = generateCacheKey("cdn/stories/home", { version: "draft" });
// Returns: "cdn_stories_home__a1b2c3d4e5f6g7h8.json"
```

### `readFromCache(cacheKey, cacheDir?, verbose?)`

Reads data from the disk cache.

```typescript
import { readFromCache } from "storyblok-cached-api";

const data = readFromCache("cdn_stories_home__hash.json");
```

### `writeToCache(cacheKey, data, cacheDir?, verbose?)`

Writes data to the disk cache.

```typescript
import { writeToCache } from "storyblok-cached-api";

writeToCache("cdn_stories_home__hash.json", { story: { name: "Home" } });
```

### `clearCache(cacheDir?)`

Clears all cache files from the cache directory.

```typescript
import { clearCache } from "storyblok-cached-api";

const filesDeleted = clearCache(); // Deletes all .json files in .sb-dev-cache/
console.log(`Deleted ${filesDeleted} cache files`);
```

## 🧹 Clearing the Cache

To clear the cache, simply delete the cache directory:

```bash
# Default cache directory
rm -rf .sb-dev-cache
```

Or use the `clearCache()` function:

```typescript
import { clearCache } from "storyblok-cached-api";

clearCache(); // Clears default .sb-dev-cache/
clearCache("my-custom-cache"); // Clears custom directory
```

## 🎛️ Environment-based Behavior

By default, caching is **only enabled in development**:

```typescript
// Caching enabled when NODE_ENV === 'development'
const api = useCachedStoryblokApi();

// Force enable/disable regardless of environment
const apiAlwaysCached = useCachedStoryblokApi({ enableCache: true });
const apiNeverCached = useCachedStoryblokApi({ enableCache: false });
```

## 📂 Cache Directory

The cache directory (`.sb-dev-cache/` by default) should be added to your `.gitignore`:

```gitignore
# .gitignore
.sb-dev-cache/
```

## 🔄 How It Works

1. When you call `storyblokApi.get(slug, params)`, the library generates a unique cache key based on the slug and parameters
2. If a cached file exists, it loads the data from disk (instant)
3. If no cache exists, it queries the Storyblok API and saves the response to disk
4. Next time you request the same slug/params, it loads from cache

## 🧪 Testing

The library comes with a comprehensive test suite:

```bash
# Run tests
pnpm test

# Run tests with UI
pnpm test:ui

# Run tests with coverage
pnpm test:coverage
```

## 🛠️ Development

```bash
# Install dependencies
pnpm install

# Build the library
pnpm build

# Run tests
pnpm test

# Run type checking
pnpm typecheck

# Lint
pnpm lint
```

## 📋 Requirements

- Node.js >= 18.0.0
- `@storyblok/astro` >= 7.0.0 (peer dependency)

## 🤝 Peer Dependencies

This library requires `@storyblok/astro` to be installed in your project:

```bash
pnpm add @storyblok/astro
```

The library uses **peerDependencies** to ensure you're using your own version of Storyblok, avoiding version conflicts and duplicate installations.

## 📝 License

MIT

## 🙏 Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## 🐛 Issues

Found a bug? Please [open an issue](https://github.com/your-repo/storyblok-cached-api/issues).

---

Made with ❤️ for faster Astro + Storyblok development
