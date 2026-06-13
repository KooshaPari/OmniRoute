/**
 * Comprehensive Test Suite for Utility Helpers
 * Tests string utilities, array utilities, object utilities, date utilities, validation, etc.
 */

import { describe, it, expect, vi } from "vitest";

// Mock implementations of utility functions for testing
const stringUtils = {
  capitalize: (str: string) => str.charAt(0).toUpperCase() + str.slice(1),
  truncate: (str: string, length: number) => str.length > length ? str.slice(0, length) + "..." : str,
  slugify: (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, ""),
  camelCase: (str: string) => str.replace(/[-_\s]+(.)?/g, (_, char) => char ? char.toUpperCase() : ""),
  kebabCase: (str: string) => str.replace(/([A-Z])/g, "-$1").toLowerCase().replace(/^-/, ""),
  snakeCase: (str: string) => str.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, ""),
  stripHtml: (str: string) => str.replace(/<[^>]*>/g, ""),
  escapeHtml: (str: string) => str.replace(/[&<>"']/g, (match) => {
    const escapeMap: { [key: string]: string } = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return escapeMap[match];
  }),
  unescapeHtml: (str: string) => str.replace(/&amp;|&lt;|&gt;|&quot;|&#39;/g, (match) => {
    const unescapeMap: { [key: string]: string } = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };
    return unescapeMap[match];
  }),
  padStart: (str: string, length: number, padString = " ") => str.padStart(length, padString),
  padEnd: (str: string, length: number, padString = " ") => str.padEnd(length, padString)
};

const arrayUtils = {
  unique: <T>(arr: T[]) => [...new Set(arr)],
  chunk: <T>(arr: T[], size: number) => {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  },
  shuffle: <T>(arr: T[]) => {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  },
  groupBy: <T>(arr: T[], key: keyof T | ((item: T) => string)) => {
    return arr.reduce((groups, item) => {
      const groupKey = typeof key === "function" ? key(item) : String(item[key]);
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(item);
      return groups;
    }, {} as Record<string, T[]>);
  },
  flatten: <T>(arr: (T | T[])[]): T[] => arr.reduce((flat: T[], item) => flat.concat(Array.isArray(item) ? arrayUtils.flatten(item) : item), []),
  difference: <T>(arr1: T[], arr2: T[]) => arr1.filter(x => !arr2.includes(x)),
  intersection: <T>(arr1: T[], arr2: T[]) => arr1.filter(x => arr2.includes(x)),
  union: <T>(arr1: T[], arr2: T[]) => [...new Set([...arr1, ...arr2])],
  compact: <T>(arr: (T | null | undefined)[]) => arr.filter(Boolean) as T[],
  sortBy: <T>(arr: T[], key: keyof T | ((item: T) => any)) => [...arr].sort((a, b) => {
    const aVal = typeof key === "function" ? key(a) : a[key];
    const bVal = typeof key === "function" ? key(b) : b[key];
    return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
  })
};

const objectUtils = {
  pick: <T, K extends keyof T>(obj: T, keys: K[]) => {
    const result = {} as Pick<T, K>;
    keys.forEach(key => {
      if (key in obj) result[key] = obj[key];
    });
    return result;
  },
  omit: <T, K extends keyof T>(obj: T, keys: K[]) => {
    const result = { ...obj };
    keys.forEach(key => delete result[key]);
    return result;
  },
  deepClone: <T>(obj: T): T => JSON.parse(JSON.stringify(obj)),
  merge: <T>(target: T, ...sources: Partial<T>[]): T => Object.assign({}, target, ...sources),
  isEmpty: (obj: any) => obj == null || (typeof obj === "object" && Object.keys(obj).length === 0),
  hasProperty: (obj: any, prop: string) => Object.prototype.hasOwnProperty.call(obj, prop),
  getNestedValue: (obj: any, path: string) => path.split(".").reduce((current, key) => current?.[key], obj),
  setNestedValue: (obj: any, path: string, value: any) => {
    const keys = path.split(".");
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => current[key] = current[key] || {}, obj);
    target[lastKey] = value;
  },
  flattenObject: (obj: any, prefix = "") => {
    let result: any = {};
    for (const key in obj) {
      const newKey = prefix ? `${prefix}.${key}` : key;
      if (typeof obj[key] === "object" && obj[key] !== null && !Array.isArray(obj[key])) {
        Object.assign(result, objectUtils.flattenObject(obj[key], newKey));
      } else {
        result[newKey] = obj[key];
      }
    }
    return result;
  }
};

const dateUtils = {
  isValidDate: (date: any) => date instanceof Date && !isNaN(date.getTime()),
  formatDate: (date: Date, format = "YYYY-MM-DD") => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return format.replace("YYYY", String(year)).replace("MM", month).replace("DD", day);
  },
  parseDate: (dateString: string) => new Date(dateString),
  addDays: (date: Date, days: number) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000),
  subtractDays: (date: Date, days: number) => dateUtils.addDays(date, -days),
  getDaysDifference: (date1: Date, date2: Date) => Math.ceil((date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24)),
  isToday: (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  },
  isYesterday: (date: Date) => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return date.toDateString() === yesterday.toDateString();
  },
  isTomorrow: (date: Date) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return date.toDateString() === tomorrow.toDateString();
  },
  getStartOfDay: (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()),
  getEndOfDay: (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
};

const validationUtils = {
  isEmail: (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
  isUrl: (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },
  isPhoneNumber: (phone: string) => /^\+?[\d\s\-\(\)]+$/.test(phone),
  isNumeric: (value: any) => !isNaN(value) && !isNaN(parseFloat(value)),
  isInteger: (value: any) => Number.isInteger(Number(value)),
  isPositive: (value: number) => value > 0,
  isNegative: (value: number) => value < 0,
  isInRange: (value: number, min: number, max: number) => value >= min && value <= max,
  hasMinLength: (str: string, minLength: number) => str.length >= minLength,
  hasMaxLength: (str: string, maxLength: number) => str.length <= maxLength,
  matchesPattern: (str: string, pattern: RegExp) => pattern.test(str)
};

const numberUtils = {
  isEven: (num: number) => num % 2 === 0,
  isOdd: (num: number) => num % 2 !== 0,
  clamp: (num: number, min: number, max: number) => Math.min(Math.max(num, min), max),
  random: (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min,
  round: (num: number, decimals = 0) => Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals),
  toFixed: (num: number, decimals: number) => num.toFixed(decimals),
  formatCurrency: (num: number, currency = "USD", locale = "en-US") => 
    new Intl.NumberFormat(locale, { style: "currency", currency }).format(num),
  formatNumber: (num: number, locale = "en-US") => new Intl.NumberFormat(locale).format(num),
  percentage: (value: number, total: number) => (value / total) * 100,
  fibonacci: (n: number): number => n <= 1 ? n : numberUtils.fibonacci(n - 1) + numberUtils.fibonacci(n - 2)
};

const functionUtils = {
  debounce: <T extends (...args: any[]) => any>(func: T, delay: number) => {
    let timeoutId: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  },
  throttle: <T extends (...args: any[]) => any>(func: T, limit: number) => {
    let inThrottle: boolean;
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },
  memoize: <T extends (...args: any[]) => any>(func: T) => {
    const cache = new Map();
    return (...args: Parameters<T>): ReturnType<T> => {
      const key = JSON.stringify(args);
      if (cache.has(key)) return cache.get(key);
      const result = func(...args);
      cache.set(key, result);
      return result;
    };
  },
  once: <T extends (...args: any[]) => any>(func: T) => {
    let called = false;
    let result: ReturnType<T>;
    return (...args: Parameters<T>): ReturnType<T> => {
      if (!called) {
        result = func(...args);
        called = true;
      }
      return result;
    };
  },
  pipe: (...funcs: Function[]) => (value: any) => funcs.reduce((acc, func) => func(acc), value),
  compose: (...funcs: Function[]) => (value: any) => funcs.reduceRight((acc, func) => func(acc), value)
};

describe("String Utilities", () => {
  it("should capitalize first letter", () => {
    expect(stringUtils.capitalize("hello")).toBe("Hello");
    expect(stringUtils.capitalize("")).toBe("");
    expect(stringUtils.capitalize("a")).toBe("A");
  });

  it("should truncate string", () => {
    expect(stringUtils.truncate("hello world", 5)).toBe("hello...");
    expect(stringUtils.truncate("hi", 5)).toBe("hi");
    expect(stringUtils.truncate("", 5)).toBe("");
  });

  it("should create slug", () => {
    expect(stringUtils.slugify("Hello World!")).toBe("hello-world");
    expect(stringUtils.slugify("Test@#$%String")).toBe("test-string");
  });

  it("should convert to camelCase", () => {
    expect(stringUtils.camelCase("hello-world")).toBe("helloWorld");
    expect(stringUtils.camelCase("test_string")).toBe("testString");
    expect(stringUtils.camelCase("simple")).toBe("simple");
  });

  it("should convert to kebab-case", () => {
    expect(stringUtils.kebabCase("helloWorld")).toBe("hello-world");
    expect(stringUtils.kebabCase("TestString")).toBe("test-string");
  });

  it("should convert to snake_case", () => {
    expect(stringUtils.snakeCase("helloWorld")).toBe("hello_world");
    expect(stringUtils.snakeCase("TestString")).toBe("test_string");
  });

  it("should strip HTML tags", () => {
    expect(stringUtils.stripHtml("<p>Hello</p>")).toBe("Hello");
    expect(stringUtils.stripHtml("<div><span>Test</span></div>")).toBe("Test");
  });

  it("should escape HTML", () => {
    expect(stringUtils.escapeHtml("<script>")).toBe("&lt;script&gt;");
    expect(stringUtils.escapeHtml("&")).toBe("&amp;");
  });

  it("should unescape HTML", () => {
    expect(stringUtils.unescapeHtml("&lt;script&gt;")).toBe("<script>");
    expect(stringUtils.unescapeHtml("&amp;")).toBe("&");
  });

  it("should pad strings", () => {
    expect(stringUtils.padStart("5", 3, "0")).toBe("005");
    expect(stringUtils.padEnd("5", 3, "0")).toBe("500");
  });
});

describe("Array Utilities", () => {
  it("should get unique values", () => {
    expect(arrayUtils.unique([1, 2, 2, 3, 3, 3])).toEqual([1, 2, 3]);
    expect(arrayUtils.unique(["a", "b", "a", "c"])).toEqual(["a", "b", "c"]);
  });

  it("should chunk arrays", () => {
    expect(arrayUtils.chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(arrayUtils.chunk([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]]);
  });

  it("should shuffle arrays", () => {
    const original = [1, 2, 3, 4, 5];
    const shuffled = arrayUtils.shuffle(original);
    expect(shuffled).toHaveLength(5);
    expect(shuffled).toContain(1);
    expect(shuffled).toContain(2);
    expect(shuffled).toContain(3);
    expect(shuffled).toContain(4);
    expect(shuffled).toContain(5);
  });

  it("should group by key", () => {
    const items = [
      { type: "A", value: 1 },
      { type: "B", value: 2 },
      { type: "A", value: 3 }
    ];
    const grouped = arrayUtils.groupBy(items, "type");
    expect(grouped.A).toHaveLength(2);
    expect(grouped.B).toHaveLength(1);
  });

  it("should flatten arrays", () => {
    expect(arrayUtils.flatten([1, [2, 3], [4, [5]]])).toEqual([1, 2, 3, 4, 5]);
    expect(arrayUtils.flatten([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it("should find array difference", () => {
    expect(arrayUtils.difference([1, 2, 3], [2, 3, 4])).toEqual([1]);
    expect(arrayUtils.difference([1, 2], [3, 4])).toEqual([1, 2]);
  });

  it("should find array intersection", () => {
    expect(arrayUtils.intersection([1, 2, 3], [2, 3, 4])).toEqual([2, 3]);
    expect(arrayUtils.intersection([1, 2], [3, 4])).toEqual([]);
  });

  it("should find array union", () => {
    expect(arrayUtils.union([1, 2], [2, 3])).toEqual([1, 2, 3]);
    expect(arrayUtils.union([1], [2])).toEqual([1, 2]);
  });

  it("should compact arrays", () => {
    expect(arrayUtils.compact([1, null, 2, undefined, 3, false, 0, ""])).toEqual([1, 2, 3]);
  });

  it("should sort by key", () => {
    const items = [{ name: "c", value: 3 }, { name: "a", value: 1 }, { name: "b", value: 2 }];
    const sorted = arrayUtils.sortBy(items, "name");
    expect(sorted[0].name).toBe("a");
    expect(sorted[1].name).toBe("b");
    expect(sorted[2].name).toBe("c");
  });
});

describe("Object Utilities", () => {
  it("should pick object properties", () => {
    const obj = { a: 1, b: 2, c: 3 };
    expect(objectUtils.pick(obj, ["a", "c"])).toEqual({ a: 1, c: 3 });
  });

  it("should omit object properties", () => {
    const obj = { a: 1, b: 2, c: 3 };
    expect(objectUtils.omit(obj, ["b"])).toEqual({ a: 1, c: 3 });
  });

  it("should deep clone objects", () => {
    const obj = { a: { b: { c: 1 } } };
    const cloned = objectUtils.deepClone(obj);
    expect(cloned).toEqual(obj);
    expect(cloned).not.toBe(obj);
    expect(cloned.a).not.toBe(obj.a);
  });

  it("should merge objects", () => {
    const obj1 = { a: 1, b: 2 };
    const obj2 = { b: 3, c: 4 };
    expect(objectUtils.merge(obj1, obj2)).toEqual({ a: 1, b: 3, c: 4 });
  });

  it("should check if object is empty", () => {
    expect(objectUtils.isEmpty({})).toBe(true);
    expect(objectUtils.isEmpty({ a: 1 })).toBe(false);
    expect(objectUtils.isEmpty(null)).toBe(true);
    expect(objectUtils.isEmpty(undefined)).toBe(true);
  });

  it("should check if object has property", () => {
    const obj = { a: 1 };
    expect(objectUtils.hasProperty(obj, "a")).toBe(true);
    expect(objectUtils.hasProperty(obj, "b")).toBe(false);
  });

  it("should get nested value", () => {
    const obj = { a: { b: { c: 1 } } };
    expect(objectUtils.getNestedValue(obj, "a.b.c")).toBe(1);
    expect(objectUtils.getNestedValue(obj, "a.x.y")).toBeUndefined();
  });

  it("should set nested value", () => {
    const obj: any = {};
    objectUtils.setNestedValue(obj, "a.b.c", 1);
    expect(obj.a.b.c).toBe(1);
  });

  it("should flatten object", () => {
    const obj = { a: { b: { c: 1 } }, d: 2 };
    expect(objectUtils.flattenObject(obj)).toEqual({ "a.b.c": 1, d: 2 });
  });
});

describe("Date Utilities", () => {
  it("should validate dates", () => {
    expect(dateUtils.isValidDate(new Date())).toBe(true);
    expect(dateUtils.isValidDate(new Date("invalid"))).toBe(false);
    expect(dateUtils.isValidDate("2023-01-01")).toBe(false);
  });

  it("should format dates", () => {
    const date = new Date("2023-01-15T12:00:00.000Z");
    expect(dateUtils.formatDate(date)).toBe("2023-01-15");
    expect(dateUtils.formatDate(date, "DD/MM/YYYY")).toBe("15/01/2023");
  });

  it("should parse dates", () => {
    const date = dateUtils.parseDate("2023-01-15T12:00:00.000Z");
    expect(date.getFullYear()).toBe(2023);
    expect(date.getMonth()).toBe(0);
    expect(date.getUTCDate()).toBe(15);
  });

  it("should add and subtract days", () => {
    const date = new Date("2023-01-15T12:00:00.000Z");
    const added = dateUtils.addDays(date, 5);
    const subtracted = dateUtils.subtractDays(date, 3);
    
    expect(added.getUTCDate()).toBe(20);
    expect(subtracted.getUTCDate()).toBe(12);
  });

  it("should calculate days difference", () => {
    const date1 = new Date("2023-01-15T12:00:00.000Z");
    const date2 = new Date("2023-01-20T12:00:00.000Z");
    expect(dateUtils.getDaysDifference(date1, date2)).toBe(5);
  });

  it("should check if date is today", () => {
    const today = new Date();
    const yesterday = dateUtils.subtractDays(today, 1);
    
    expect(dateUtils.isToday(today)).toBe(true);
    expect(dateUtils.isToday(yesterday)).toBe(false);
  });

  it("should get start and end of day", () => {
    const date = new Date("2023-01-15T14:30:45.000Z");
    const start = dateUtils.getStartOfDay(date);
    const end = dateUtils.getEndOfDay(date);
    
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
  });
});

describe("Validation Utilities", () => {
  it("should validate emails", () => {
    expect(validationUtils.isEmail("test@example.com")).toBe(true);
    expect(validationUtils.isEmail("invalid-email")).toBe(false);
    expect(validationUtils.isEmail("test@")).toBe(false);
  });

  it("should validate URLs", () => {
    expect(validationUtils.isUrl("https://example.com")).toBe(true);
    expect(validationUtils.isUrl("http://test.org")).toBe(true);
    expect(validationUtils.isUrl("invalid-url")).toBe(false);
  });

  it("should validate phone numbers", () => {
    expect(validationUtils.isPhoneNumber("+1-234-567-8900")).toBe(true);
    expect(validationUtils.isPhoneNumber("(555) 123-4567")).toBe(true);
    expect(validationUtils.isPhoneNumber("invalid")).toBe(false);
  });

  it("should validate numeric values", () => {
    expect(validationUtils.isNumeric("123")).toBe(true);
    expect(validationUtils.isNumeric("123.45")).toBe(true);
    expect(validationUtils.isNumeric("abc")).toBe(false);
  });

  it("should validate integers", () => {
    expect(validationUtils.isInteger("123")).toBe(true);
    expect(validationUtils.isInteger("123.45")).toBe(false);
    expect(validationUtils.isInteger("abc")).toBe(false);
  });

  it("should validate positive/negative numbers", () => {
    expect(validationUtils.isPositive(5)).toBe(true);
    expect(validationUtils.isPositive(-5)).toBe(false);
    expect(validationUtils.isNegative(-5)).toBe(true);
    expect(validationUtils.isNegative(5)).toBe(false);
  });

  it("should validate ranges", () => {
    expect(validationUtils.isInRange(5, 1, 10)).toBe(true);
    expect(validationUtils.isInRange(15, 1, 10)).toBe(false);
  });

  it("should validate string lengths", () => {
    expect(validationUtils.hasMinLength("hello", 3)).toBe(true);
    expect(validationUtils.hasMinLength("hi", 3)).toBe(false);
    expect(validationUtils.hasMaxLength("hello", 10)).toBe(true);
    expect(validationUtils.hasMaxLength("verylongstring", 5)).toBe(false);
  });

  it("should validate patterns", () => {
    expect(validationUtils.matchesPattern("abc123", /^[a-z]+\d+$/)).toBe(true);
    expect(validationUtils.matchesPattern("123abc", /^[a-z]+\d+$/)).toBe(false);
  });
});

describe("Number Utilities", () => {
  it("should check even/odd numbers", () => {
    expect(numberUtils.isEven(4)).toBe(true);
    expect(numberUtils.isEven(5)).toBe(false);
    expect(numberUtils.isOdd(5)).toBe(true);
    expect(numberUtils.isOdd(4)).toBe(false);
  });

  it("should clamp numbers", () => {
    expect(numberUtils.clamp(15, 1, 10)).toBe(10);
    expect(numberUtils.clamp(-5, 1, 10)).toBe(1);
    expect(numberUtils.clamp(5, 1, 10)).toBe(5);
  });

  it("should generate random numbers", () => {
    const random = numberUtils.random(1, 10);
    expect(random).toBeGreaterThanOrEqual(1);
    expect(random).toBeLessThanOrEqual(10);
  });

  it("should round numbers", () => {
    expect(numberUtils.round(3.14159, 2)).toBe(3.14);
    expect(numberUtils.round(3.5)).toBe(4);
  });

  it("should format currency", () => {
    expect(numberUtils.formatCurrency(1234.56)).toContain("$");
    expect(numberUtils.formatCurrency(1234.56)).toContain("1,234.56");
  });

  it("should calculate percentage", () => {
    expect(numberUtils.percentage(25, 100)).toBe(25);
    expect(numberUtils.percentage(1, 4)).toBe(25);
  });

  it("should calculate fibonacci", () => {
    expect(numberUtils.fibonacci(0)).toBe(0);
    expect(numberUtils.fibonacci(1)).toBe(1);
    expect(numberUtils.fibonacci(5)).toBe(5);
    expect(numberUtils.fibonacci(10)).toBe(55);
  });
});

describe("Function Utilities", () => {
  it("should debounce functions", () => {
    vi.useFakeTimers();
    const mockFn = vi.fn();
    const debouncedFn = functionUtils.debounce(mockFn, 100);
    
    debouncedFn();
    debouncedFn();
    debouncedFn();
    
    expect(mockFn).not.toHaveBeenCalled();
    
    vi.advanceTimersByTime(100);
    expect(mockFn).toHaveBeenCalledTimes(1);
    
    vi.useRealTimers();
  });

  it("should throttle functions", () => {
    vi.useFakeTimers();
    const mockFn = vi.fn();
    const throttledFn = functionUtils.throttle(mockFn, 100);
    
    throttledFn();
    throttledFn();
    throttledFn();
    
    expect(mockFn).toHaveBeenCalledTimes(1);
    
    vi.advanceTimersByTime(100);
    throttledFn();
    expect(mockFn).toHaveBeenCalledTimes(2);
    
    vi.useRealTimers();
  });

  it("should memoize functions", () => {
    const expensiveFn = vi.fn((x: number) => x * 2);
    const memoizedFn = functionUtils.memoize(expensiveFn);
    
    expect(memoizedFn(5)).toBe(10);
    expect(memoizedFn(5)).toBe(10);
    expect(expensiveFn).toHaveBeenCalledTimes(1);
  });

  it("should call function only once", () => {
    const mockFn = vi.fn(() => "result");
    const onceFn = functionUtils.once(mockFn);
    
    expect(onceFn()).toBe("result");
    expect(onceFn()).toBe("result");
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it("should pipe functions", () => {
    const add1 = (x: number) => x + 1;
    const multiply2 = (x: number) => x * 2;
    const piped = functionUtils.pipe(add1, multiply2);
    
    expect(piped(5)).toBe(12); // (5 + 1) * 2
  });

  it("should compose functions", () => {
    const add1 = (x: number) => x + 1;
    const multiply2 = (x: number) => x * 2;
    const composed = functionUtils.compose(add1, multiply2);
    
    expect(composed(5)).toBe(11); // (5 * 2) + 1
  });
});

describe("Integration Tests", () => {
  it("should work with combined utilities", () => {
    const data = [
      { name: "John Doe", email: "john@example.com", age: 30 },
      { name: "jane smith", email: "jane@test.com", age: 25 },
      { name: "bob johnson", email: "invalid-email", age: 35 }
    ];

    const processed = data
      .filter(person => validationUtils.isEmail(person.email))
      .map(person => ({
        ...person,
        name: stringUtils.capitalize(person.name.toLowerCase()),
        slug: stringUtils.slugify(person.name)
      }))
      .sort((a, b) => a.age - b.age);

    expect(processed).toHaveLength(2);
    expect(processed[0].name).toBe("Jane smith");
    expect(processed[0].slug).toBe("jane-smith");
    expect(processed[0].age).toBe(25);
  });

  it("should handle edge cases gracefully", () => {
    expect(stringUtils.capitalize("")).toBe("");
    expect(arrayUtils.unique([])).toEqual([]);
    expect(objectUtils.isEmpty({})).toBe(true);
    expect(validationUtils.isEmail("")).toBe(false);
    expect(numberUtils.clamp(5, 1, 10)).toBe(5); // normal case
  });
});