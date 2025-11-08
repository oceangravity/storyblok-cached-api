import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  generateCacheKey,
  readFromCache,
  writeToCache,
  clearCache,
  useCachedStoryblokApi,
} from "../src/index";
import type { ISbStoryParams } from "@storyblok/astro";
import { useStoryblokApi } from "@storyblok/astro";

// Mock @storyblok/astro module
vi.mock("@storyblok/astro", () => ({
  useStoryblokApi: vi.fn(() => ({
    get: vi.fn(),
  })),
}));

const TEST_CACHE_DIR = ".test-cache";
const TEST_CACHE_PATH = join(process.cwd(), TEST_CACHE_DIR);

describe("generateCacheKey", () => {
  it("should generate a consistent cache key for the same path and params", () => {
    const path = "cdn/stories/home";
    const params: ISbStoryParams = { version: "draft" };

    const key1 = generateCacheKey(path, params);
    const key2 = generateCacheKey(path, params);

    expect(key1).toBe(key2);
  });

  it("should generate different keys for different paths", () => {
    const key1 = generateCacheKey("cdn/stories/home");
    const key2 = generateCacheKey("cdn/stories/about");

    expect(key1).not.toBe(key2);
  });

  it("should generate different keys for different params", () => {
    const path = "cdn/stories/home";
    const params1: ISbStoryParams = { version: "draft" };
    const params2: ISbStoryParams = { version: "published" };

    const key1 = generateCacheKey(path, params1);
    const key2 = generateCacheKey(path, params2);

    expect(key1).not.toBe(key2);
  });

  it("should handle paths with leading slashes", () => {
    const key1 = generateCacheKey("/cdn/stories/home");
    const key2 = generateCacheKey("cdn/stories/home");

    expect(key1).toBe(key2);
  });

  it("should sanitize paths to create valid filenames", () => {
    const key = generateCacheKey("cdn/stories/my-page/special?chars");

    expect(key).toMatch(/^cdn_stories_my-page_special-chars__[a-f0-9]{16}\.json$/);
  });

  it("should handle paths with multiple slashes", () => {
    const key = generateCacheKey("cdn/stories/deep/nested/path");

    expect(key).toMatch(/^cdn_stories_deep_nested_path__[a-f0-9]{16}\.json$/);
  });

  it("should generate same key for params with different property order", () => {
    const path = "cdn/stories/home";
    const params1: ISbStoryParams = { version: "draft", cv: 12345 };
    const params2: ISbStoryParams = { cv: 12345, version: "draft" };

    const key1 = generateCacheKey(path, params1);
    const key2 = generateCacheKey(path, params2);

    expect(key1).toBe(key2);
  });

  it("should handle empty path", () => {
    const key = generateCacheKey("");

    expect(key).toMatch(/^__[a-f0-9]{16}\.json$/);
  });

  it("should handle undefined params", () => {
    const key1 = generateCacheKey("cdn/stories/home");
    const key2 = generateCacheKey("cdn/stories/home", undefined);

    expect(key1).toBe(key2);
  });
});

describe("readFromCache", () => {
  beforeEach(() => {
    // Clean up test cache directory before each test
    if (existsSync(TEST_CACHE_PATH)) {
      rmSync(TEST_CACHE_PATH, { recursive: true });
    }
    mkdirSync(TEST_CACHE_PATH, { recursive: true });
  });

  afterEach(() => {
    // Clean up after tests
    if (existsSync(TEST_CACHE_PATH)) {
      rmSync(TEST_CACHE_PATH, { recursive: true });
    }
  });

  it("should return null if cache file does not exist", () => {
    const result = readFromCache("non-existent.json", TEST_CACHE_DIR, false);

    expect(result).toBeNull();
  });

  it("should read cached data successfully", () => {
    const cacheKey = "test-cache.json";
    const testData = { story: { name: "Test Story" } };

    writeFileSync(
      join(TEST_CACHE_PATH, cacheKey),
      JSON.stringify(testData),
      "utf-8"
    );

    const result = readFromCache(cacheKey, TEST_CACHE_DIR, false);

    expect(result).toEqual(testData);
  });

  it("should return null for corrupted cache file", () => {
    const cacheKey = "corrupted-cache.json";

    writeFileSync(
      join(TEST_CACHE_PATH, cacheKey),
      "{ invalid json",
      "utf-8"
    );

    const result = readFromCache(cacheKey, TEST_CACHE_DIR, false);

    expect(result).toBeNull();
  });

  it("should handle complex nested objects", () => {
    const cacheKey = "complex-cache.json";
    const testData = {
      story: {
        name: "Complex Story",
        content: {
          body: [
            { component: "hero", text: "Hello" },
            { component: "text", content: "World" },
          ],
        },
        meta: {
          tags: ["tag1", "tag2"],
          published: true,
        },
      },
    };

    writeFileSync(
      join(TEST_CACHE_PATH, cacheKey),
      JSON.stringify(testData),
      "utf-8"
    );

    const result = readFromCache(cacheKey, TEST_CACHE_DIR, false);

    expect(result).toEqual(testData);
  });

  it("should handle empty objects", () => {
    const cacheKey = "empty-cache.json";
    const testData = {};

    writeFileSync(
      join(TEST_CACHE_PATH, cacheKey),
      JSON.stringify(testData),
      "utf-8"
    );

    const result = readFromCache(cacheKey, TEST_CACHE_DIR, false);

    expect(result).toEqual(testData);
  });

  it("should suppress warnings when verbose is false", () => {
    const consoleSpy = vi.spyOn(console, "warn");
    const cacheKey = "corrupted.json";

    writeFileSync(join(TEST_CACHE_PATH, cacheKey), "invalid", "utf-8");

    readFromCache(cacheKey, TEST_CACHE_DIR, false);

    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("should show warnings when verbose is true", () => {
    const consoleSpy = vi.spyOn(console, "warn");
    const cacheKey = "corrupted.json";

    writeFileSync(join(TEST_CACHE_PATH, cacheKey), "invalid", "utf-8");

    readFromCache(cacheKey, TEST_CACHE_DIR, true);

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe("writeToCache", () => {
  beforeEach(() => {
    if (existsSync(TEST_CACHE_PATH)) {
      rmSync(TEST_CACHE_PATH, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(TEST_CACHE_PATH)) {
      rmSync(TEST_CACHE_PATH, { recursive: true });
    }
  });

  it("should create cache directory if it does not exist", () => {
    const cacheKey = "test-cache.json";
    const testData = { story: { name: "Test" } };

    writeToCache(cacheKey, testData, TEST_CACHE_DIR, false);

    expect(existsSync(TEST_CACHE_PATH)).toBe(true);
  });

  it("should write data to cache file", () => {
    const cacheKey = "test-cache.json";
    const testData = { story: { name: "Test Story" } };

    writeToCache(cacheKey, testData, TEST_CACHE_DIR, false);

    const cachePath = join(TEST_CACHE_PATH, cacheKey);
    const content = readFileSync(cachePath, "utf-8");
    const parsed = JSON.parse(content);

    expect(parsed).toEqual(testData);
  });

  it("should format JSON with pretty print", () => {
    const cacheKey = "test-cache.json";
    const testData = { story: { name: "Test" } };

    writeToCache(cacheKey, testData, TEST_CACHE_DIR, false);

    const cachePath = join(TEST_CACHE_PATH, cacheKey);
    const content = readFileSync(cachePath, "utf-8");

    expect(content).toContain("\n");
    expect(content).toContain("  ");
  });

  it("should overwrite existing cache file", () => {
    const cacheKey = "test-cache.json";
    const oldData = { story: { name: "Old" } };
    const newData = { story: { name: "New" } };

    writeToCache(cacheKey, oldData, TEST_CACHE_DIR, false);
    writeToCache(cacheKey, newData, TEST_CACHE_DIR, false);

    const result = readFromCache(cacheKey, TEST_CACHE_DIR, false);

    expect(result).toEqual(newData);
  });

  it("should handle arrays", () => {
    const cacheKey = "array-cache.json";
    const testData = [1, 2, 3, 4, 5];

    writeToCache(cacheKey, testData, TEST_CACHE_DIR, false);

    const result = readFromCache(cacheKey, TEST_CACHE_DIR, false);

    expect(result).toEqual(testData);
  });

  it("should handle null values", () => {
    const cacheKey = "null-cache.json";
    const testData = { value: null };

    writeToCache(cacheKey, testData, TEST_CACHE_DIR, false);

    const result = readFromCache(cacheKey, TEST_CACHE_DIR, false);

    expect(result).toEqual(testData);
  });

  it("should suppress logs when verbose is false", () => {
    const consoleSpy = vi.spyOn(console, "log");
    const cacheKey = "test-cache.json";
    const testData = { story: { name: "Test" } };

    writeToCache(cacheKey, testData, TEST_CACHE_DIR, false);

    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("should show logs when verbose is true", () => {
    const consoleSpy = vi.spyOn(console, "log");
    const cacheKey = "test-cache.json";
    const testData = { story: { name: "Test" } };

    writeToCache(cacheKey, testData, TEST_CACHE_DIR, true);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[Cache] ✓ Saved to cache:")
    );
    consoleSpy.mockRestore();
  });
});

describe("clearCache", () => {
  beforeEach(() => {
    if (existsSync(TEST_CACHE_PATH)) {
      rmSync(TEST_CACHE_PATH, { recursive: true });
    }
    mkdirSync(TEST_CACHE_PATH, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_CACHE_PATH)) {
      rmSync(TEST_CACHE_PATH, { recursive: true });
    }
  });

  it("should return 0 if cache directory does not exist", () => {
    rmSync(TEST_CACHE_PATH, { recursive: true });

    const result = clearCache(TEST_CACHE_DIR);

    expect(result).toBe(0);
  });

  it("should delete all JSON files in cache directory", () => {
    writeFileSync(join(TEST_CACHE_PATH, "file1.json"), "{}", "utf-8");
    writeFileSync(join(TEST_CACHE_PATH, "file2.json"), "{}", "utf-8");
    writeFileSync(join(TEST_CACHE_PATH, "file3.json"), "{}", "utf-8");

    const result = clearCache(TEST_CACHE_DIR);

    expect(result).toBe(3);
    expect(existsSync(join(TEST_CACHE_PATH, "file1.json"))).toBe(false);
    expect(existsSync(join(TEST_CACHE_PATH, "file2.json"))).toBe(false);
    expect(existsSync(join(TEST_CACHE_PATH, "file3.json"))).toBe(false);
  });

  it("should only delete JSON files and ignore other files", () => {
    writeFileSync(join(TEST_CACHE_PATH, "file1.json"), "{}", "utf-8");
    writeFileSync(join(TEST_CACHE_PATH, "file2.txt"), "text", "utf-8");
    writeFileSync(join(TEST_CACHE_PATH, "file3.json"), "{}", "utf-8");

    clearCache(TEST_CACHE_DIR);

    expect(existsSync(join(TEST_CACHE_PATH, "file1.json"))).toBe(false);
    expect(existsSync(join(TEST_CACHE_PATH, "file2.txt"))).toBe(true);
    expect(existsSync(join(TEST_CACHE_PATH, "file3.json"))).toBe(false);
  });

  it("should handle empty cache directory", () => {
    const result = clearCache(TEST_CACHE_DIR);

    expect(result).toBe(0);
  });
});

describe("useCachedStoryblokApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (existsSync(TEST_CACHE_PATH)) {
      rmSync(TEST_CACHE_PATH, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(TEST_CACHE_PATH)) {
      rmSync(TEST_CACHE_PATH, { recursive: true });
    }
  });

  it("should call original API when cache is disabled", async () => {
    const mockGet = vi.fn().mockResolvedValue({ data: { story: { name: "Test" } } });
    vi.mocked(useStoryblokApi).mockReturnValue({
      get: mockGet,
    } as never);

    const api = useCachedStoryblokApi({ enableCache: false });
    const result = await api.get("cdn/stories/home");

    expect(mockGet).toHaveBeenCalledWith("cdn/stories/home", undefined);
    expect(result).toEqual({ data: { story: { name: "Test" } } });
  });

  it("should cache API response when cache is enabled", async () => {
    const mockGet = vi.fn().mockResolvedValue({ data: { story: { name: "Test" } } });
    vi.mocked(useStoryblokApi).mockReturnValue({
      get: mockGet,
    } as never);

    const api = useCachedStoryblokApi({
      enableCache: true,
      cacheDir: TEST_CACHE_DIR,
      verbose: false,
    });

    await api.get("cdn/stories/home");

    const files = readdirSync(TEST_CACHE_PATH);
    expect(files.length).toBeGreaterThan(0);
    expect(files[0]).toMatch(/\.json$/);
  });

  it("should use cached data on subsequent requests", async () => {
    const mockGet = vi.fn().mockResolvedValue({ data: { story: { name: "Test" } } });
    vi.mocked(useStoryblokApi).mockReturnValue({
      get: mockGet,
    } as never);

    const api = useCachedStoryblokApi({
      enableCache: true,
      cacheDir: TEST_CACHE_DIR,
      verbose: false,
    });

    // First call - should hit API
    await api.get("cdn/stories/home");
    expect(mockGet).toHaveBeenCalledTimes(1);

    // Second call - should use cache
    const result = await api.get("cdn/stories/home");
    expect(mockGet).toHaveBeenCalledTimes(1); // Not called again
    expect(result).toEqual({ data: { story: { name: "Test" } } });
  });

  it("should pass params to original API", async () => {
    const mockGet = vi.fn().mockResolvedValue({ data: { story: { name: "Test" } } });
    vi.mocked(useStoryblokApi).mockReturnValue({
      get: mockGet,
    } as never);

    const api = useCachedStoryblokApi({ enableCache: false });
    const params: ISbStoryParams = { version: "draft", cv: 12345 };

    await api.get("cdn/stories/home", params);

    expect(mockGet).toHaveBeenCalledWith("cdn/stories/home", params);
  });

  it("should use default cache directory when not specified", async () => {
    const mockGet = vi.fn().mockResolvedValue({ data: { story: { name: "Test" } } });
    vi.mocked(useStoryblokApi).mockReturnValue({
      get: mockGet,
    } as never);

    const api = useCachedStoryblokApi({ enableCache: true, verbose: false });

    await api.get("cdn/stories/home");

    const defaultCachePath = join(process.cwd(), ".sb-dev-cache");
    expect(existsSync(defaultCachePath)).toBe(true);

    // Clean up
    if (existsSync(defaultCachePath)) {
      rmSync(defaultCachePath, { recursive: true });
    }
  });

  it("should enable cache by default in development", async () => {
    const originalEnv = process.env["NODE_ENV"];
    process.env["NODE_ENV"] = "development";

    const mockGet = vi.fn().mockResolvedValue({ data: { story: { name: "Test" } } });
    vi.mocked(useStoryblokApi).mockReturnValue({
      get: mockGet,
    } as never);

    const api = useCachedStoryblokApi({ cacheDir: TEST_CACHE_DIR, verbose: false });

    await api.get("cdn/stories/home");

    const files = readdirSync(TEST_CACHE_PATH);
    expect(files.length).toBeGreaterThan(0);

    process.env["NODE_ENV"] = originalEnv;
  });

  it("should handle different slugs with separate cache files", async () => {
    const mockGet = vi
      .fn()
      .mockResolvedValueOnce({ data: { story: { name: "Home" } } })
      .mockResolvedValueOnce({ data: { story: { name: "About" } } });

    vi.mocked(useStoryblokApi).mockReturnValue({
      get: mockGet,
    } as never);

    const api = useCachedStoryblokApi({
      enableCache: true,
      cacheDir: TEST_CACHE_DIR,
      verbose: false,
    });

    await api.get("cdn/stories/home");
    await api.get("cdn/stories/about");

    const files = readdirSync(TEST_CACHE_PATH);
    expect(files.length).toBe(2);
  });

  it("should log when verbose is enabled", async () => {
    const consoleSpy = vi.spyOn(console, "log");
    const mockGet = vi.fn().mockResolvedValue({ data: { story: { name: "Test" } } });
    vi.mocked(useStoryblokApi).mockReturnValue({
      get: mockGet,
    } as never);

    const api = useCachedStoryblokApi({
      enableCache: true,
      cacheDir: TEST_CACHE_DIR,
      verbose: true,
    });

    await api.get("cdn/stories/home");

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
