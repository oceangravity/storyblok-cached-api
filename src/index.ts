import { useStoryblokApi } from "@storyblok/astro";
import type { ISbStoryParams } from "@storyblok/astro";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const CACHE_DIR = ".sb-dev-cache";

/**
 * Configuration options for the cached Storyblok API
 */
export interface CachedApiOptions {
  /**
   * Enable or disable caching
   * @default process.env.NODE_ENV === 'development'
   */
  enableCache?: boolean;

  /**
   * Directory path for cache storage
   * @default '.sb-dev-cache'
   */
  cacheDir?: string;

  /**
   * Enable console logging for cache operations
   * @default true
   */
  verbose?: boolean;
}

/**
 * Generates a unique cache key based on the path and request parameters
 * 
 * @param path - The Storyblok story path
 * @param params - Optional story parameters
 * @returns A sanitized cache key string
 */
export function generateCacheKey(path: string, params?: ISbStoryParams): string {
  // Normalize path by removing leading slash
  const normalizedPath = path.replace(/^\//, "");
  
  const paramsStr = params ? JSON.stringify(params, Object.keys(params).sort()) : "";
  const combined = `${normalizedPath}::${paramsStr}`;
  const hash = createHash("sha256").update(combined).digest("hex").substring(0, 16);

  // Sanitize the path to use as part of the filename
  const sanitizedPath = normalizedPath
    .replace(/\//g, "_")
    .replace(/[^a-zA-Z0-9_-]/g, "-");

  return `${sanitizedPath}__${hash}.json`;
}

/**
 * Reads data from the disk cache
 * 
 * @param cacheKey - The cache key to read
 * @param cacheDir - The cache directory path
 * @param verbose - Enable verbose logging
 * @returns The cached data or null if not found
 */
export function readFromCache<T = unknown>(
  cacheKey: string,
  cacheDir: string = CACHE_DIR,
  verbose: boolean = true
): T | null {
  const cachePath = join(process.cwd(), cacheDir, cacheKey);

  if (!existsSync(cachePath)) {
    return null;
  }

  try {
    const content = readFileSync(cachePath, "utf-8");
    return JSON.parse(content) as T;
  } catch (error) {
    if (verbose) {
      console.warn(`[Cache] Error reading cache for ${cacheKey}:`, error);
    }
    return null;
  }
}

/**
 * Writes data to the disk cache
 * 
 * @param cacheKey - The cache key to write
 * @param data - The data to cache
 * @param cacheDir - The cache directory path
 * @param verbose - Enable verbose logging
 */
export function writeToCache<T = unknown>(
  cacheKey: string,
  data: T,
  cacheDir: string = CACHE_DIR,
  verbose: boolean = true
): void {
  const cacheDirPath = join(process.cwd(), cacheDir);

  // Create directory if it doesn't exist
  if (!existsSync(cacheDirPath)) {
    mkdirSync(cacheDirPath, { recursive: true });
  }

  const cachePath = join(cacheDirPath, cacheKey);

  try {
    writeFileSync(cachePath, JSON.stringify(data, null, 2), "utf-8");
    if (verbose) {
      console.log(`[Cache] ✓ Saved to cache: ${cacheKey}`);
    }
  } catch (error) {
    if (verbose) {
      console.warn(`[Cache] Error writing cache for ${cacheKey}:`, error);
    }
  }
}

/**
 * Clears all cache files from the cache directory
 * 
 * @param cacheDir - The cache directory path
 * @returns Number of files deleted
 */
export function clearCache(cacheDir: string = CACHE_DIR): number {
  const cacheDirPath = join(process.cwd(), cacheDir);
  
  if (!existsSync(cacheDirPath)) {
    return 0;
  }

  const files = readdirSync(cacheDirPath);
  
  files.forEach((file: string) => {
    if (file.endsWith(".json")) {
      unlinkSync(join(cacheDirPath, file));
    }
  });

  return files.length;
}

/**
 * Storyblok API wrapper with disk caching for development
 * 
 * In development mode, API responses are cached to the .sb-dev-cache/ folder.
 * If the cache exists, it loads from disk. Otherwise, it queries the API and saves the response.
 * To clear the cache, simply delete the .sb-dev-cache/ folder or use clearCache().
 * 
 * @param options - Configuration options for caching behavior
 * @returns The Storyblok API instance with caching enabled
 * 
 * @example
 * ```typescript
 * import { useCachedStoryblokApi } from 'storyblok-cached-api';
 * 
 * const storyblokApi = useCachedStoryblokApi();
 * const { data } = await storyblokApi.get('cdn/stories/home');
 * ```
 * 
 * @example
 * ```typescript
 * // With custom options
 * const storyblokApi = useCachedStoryblokApi({
 *   enableCache: true,
 *   cacheDir: 'my-cache',
 *   verbose: false
 * });
 * ```
 */
export function useCachedStoryblokApi(options?: CachedApiOptions) {
  const {
    enableCache = process.env["NODE_ENV"] === "development",
    cacheDir = CACHE_DIR,
    verbose = true,
  } = options ?? {};

  const originalApi = useStoryblokApi();
  const originalGet = originalApi.get.bind(originalApi);

  // Override the get method with caching logic
  originalApi.get = async (slug: string, params?: ISbStoryParams) => {
    const cacheKey = generateCacheKey(slug, params);

    // Try to read from cache only if caching is enabled
    if (enableCache) {
      const cached = readFromCache(cacheKey, cacheDir, verbose);
      if (cached) {
        if (verbose) {
          console.log(`[Cache] ✓ Loaded from cache: ${slug}`);
        }
        return cached as Awaited<ReturnType<typeof originalGet>>;
      }
    }

    // If no cache, query the original API
    if (verbose) {
      console.log(`[Cache] → Querying API: ${slug}`);
    }
    const result = await originalGet(slug, params);

    // Save to cache only if caching is enabled
    if (enableCache) {
      writeToCache(cacheKey, result, cacheDir, verbose);
    }

    return result;
  };

  return originalApi;
}
