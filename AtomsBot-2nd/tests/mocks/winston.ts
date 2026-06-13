/**
 * Winston Logger Mock Implementation
 * 
 * Comprehensive mock for winston logger to prevent actual logging during tests
 * and allow testing of logging calls.
 */

import { vi } from "vitest";

// Mock logger interface
export interface MockLogger {
  error: any;
  warn: any;
  info: any;
  http: any;
  verbose: any;
  debug: any;
  silly: any;
  log: any;
  level: string;
  levels: Record<string, number>;
  transports: any[];
  format: any;
  defaultMeta: any;
  exitOnError: boolean;
  silent: boolean;
  query: any;
  stream: any;
  close: any;
  clear: any;
  add: any;
  remove: any;
  configure: any;
  child: any;
  isLevelEnabled: any;
  profile: any;
  startTimer: any;
}

// Create mock logger instance
export const createMockLogger = (): MockLogger => ({
  error: vi.fn().mockReturnThis(),
  warn: vi.fn().mockReturnThis(),
  info: vi.fn().mockReturnThis(),
  http: vi.fn().mockReturnThis(),
  verbose: vi.fn().mockReturnThis(),
  debug: vi.fn().mockReturnThis(),
  silly: vi.fn().mockReturnThis(),
  log: vi.fn().mockReturnThis(),
  level: 'info',
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    verbose: 4,
    debug: 5,
    silly: 6
  },
  transports: [],
  format: {},
  defaultMeta: {},
  exitOnError: true,
  silent: false,
  query: vi.fn().mockResolvedValue([]),
  stream: vi.fn().mockReturnValue({}),
  close: vi.fn().mockImplementation((callback) => {
    if (callback) callback();
    return Promise.resolve();
  }),
  clear: vi.fn(),
  add: vi.fn().mockReturnThis(),
  remove: vi.fn().mockReturnThis(),
  configure: vi.fn().mockReturnThis(),
  child: vi.fn().mockImplementation(() => createMockLogger()),
  isLevelEnabled: vi.fn().mockReturnValue(true),
  profile: vi.fn().mockReturnThis(),
  startTimer: vi.fn().mockReturnValue({
    done: vi.fn().mockReturnThis()
  })
});

// Mock format functions - simplified approach
export const mockFormat = {
  combine: (...args: any[]) => ({
    transform: vi.fn().mockImplementation((info: any) => info),
    ...args.reduce((acc, arg) => ({ ...acc, ...arg }), {})
  }),
  
  timestamp: (options: any = {}) => ({
    transform: vi.fn().mockImplementation((info: any) => ({
      ...info,
      timestamp: options.format ? 
        new Date().toLocaleString('en-US', { 
          month: '2-digit', 
          day: '2-digit', 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit',
          hour12: false 
        }) : 
        new Date().toISOString()
    }))
  }),
  
  errors: (options: any = {}) => ({
    transform: vi.fn().mockImplementation((info: any) => {
      if (info.stack) {
        info.stack = options.stack !== false ? info.stack : undefined;
      }
      return info;
    })
  }),
  
  json: () => ({
    transform: vi.fn().mockImplementation((info: any) => ({
      ...info,
      message: JSON.stringify(info)
    }))
  }),
  
  simple: () => ({
    transform: vi.fn().mockImplementation((info: any) => ({
      ...info,
      message: `${info.level}: ${info.message}`
    }))
  }),
  
  colorize: (options: any = {}) => ({
    transform: vi.fn().mockImplementation((info: any) => ({
      ...info,
      level: options.all ? `\u001b[36m${info.level}\u001b[39m` : info.level,
      message: options.all ? `\u001b[36m${info.message}\u001b[39m` : info.message
    }))
  }),
  
  printf: (templateFn: Function) => ({
    transform: vi.fn().mockImplementation((info: any) => ({
      ...info,
      message: templateFn(info)
    }))
  }),
  
  label: (options: any = {}) => ({
    transform: vi.fn().mockImplementation((info: any) => ({
      ...info,
      label: options.label || 'default'
    }))
  }),
  
  metadata: (options: any = {}) => ({
    transform: vi.fn().mockImplementation((info: any) => info)
  }),
  
  prettyPrint: (options: any = {}) => ({
    transform: vi.fn().mockImplementation((info: any) => ({
      ...info,
      message: JSON.stringify(info, null, 2)
    }))
  }),
  
  splat: () => ({
    transform: vi.fn().mockImplementation((info: any) => info)
  }),
  
  uncolorize: () => ({
    transform: vi.fn().mockImplementation((info: any) => info)
  }),
  
  ms: () => ({
    transform: vi.fn().mockImplementation((info: any) => ({
      ...info,
      ms: '+0ms'
    }))
  })
};

// Mock transports
export const mockTransports = {
  Console: class MockConsoleTransport {
    name = 'console';
    level: string;
    silent: boolean;
    handleExceptions: boolean;
    handleRejections: boolean;
    format: any;
    log = vi.fn();
    query = vi.fn().mockResolvedValue([]);
    stream = vi.fn().mockReturnValue({});
    close = vi.fn().mockImplementation((callback: any) => {
      if (callback) callback();
      return Promise.resolve();
    });

    constructor(options: any = {}) {
      this.level = options.level || 'info';
      this.silent = options.silent || false;
      this.handleExceptions = options.handleExceptions || false;
      this.handleRejections = options.handleRejections || false;
      this.format = options.format || null;
    }
  },
  
  File: class MockFileTransport {
    name = 'file';
    filename: string;
    level: string;
    silent: boolean;
    handleExceptions: boolean;
    handleRejections: boolean;
    format: any;
    maxsize: number | null;
    maxFiles: number | null;
    tailable: boolean;
    log = vi.fn();
    query = vi.fn().mockResolvedValue([]);
    stream = vi.fn().mockReturnValue({});
    close = vi.fn().mockImplementation((callback: any) => {
      if (callback) callback();
      return Promise.resolve();
    });

    constructor(options: any = {}) {
      this.filename = options.filename || 'winston.log';
      this.level = options.level || 'info';
      this.silent = options.silent || false;
      this.handleExceptions = options.handleExceptions || false;
      this.handleRejections = options.handleRejections || false;
      this.format = options.format || null;
      this.maxsize = options.maxsize || null;
      this.maxFiles = options.maxFiles || null;
      this.tailable = options.tailable || false;
    }
  },
  
  Http: (options: any = {}) => ({
    name: 'http',
    host: options.host || 'localhost',
    port: options.port || 80,
    path: options.path || '/',
    level: options.level || 'info',
    silent: options.silent || false,
    log: vi.fn(),
    close: vi.fn().mockImplementation((callback: any) => {
      if (callback) callback();
      return Promise.resolve();
    })
  }),
  
  Stream: (options: any = {}) => ({
    name: 'stream',
    stream: options.stream || process.stdout,
    level: options.level || 'info',
    silent: options.silent || false,
    log: vi.fn(),
    close: vi.fn().mockImplementation((callback: any) => {
      if (callback) callback();
      return Promise.resolve();
    })
  })
};

// Mock Logger class for instanceof checks
export class MockLogger {
  public level: string = 'info';
  public levels: Record<string, number> = {
    error: 0, warn: 1, info: 2, http: 3, verbose: 4, debug: 5, silly: 6
  };
  public transports: any[] = [];
  public format: any = {};
  public defaultMeta: any = {};
  public exitOnError: boolean = true;
  public silent: boolean = false;

  error = vi.fn().mockReturnThis();
  warn = vi.fn().mockReturnThis();
  info = vi.fn().mockReturnThis();
  http = vi.fn().mockReturnThis();
  verbose = vi.fn().mockReturnThis();
  debug = vi.fn().mockReturnThis();
  silly = vi.fn().mockReturnThis();
  log = vi.fn().mockReturnThis();

  query = vi.fn().mockResolvedValue([]);
  stream = vi.fn().mockReturnValue({});
  close = vi.fn().mockImplementation((callback) => {
    if (callback) callback();
    return Promise.resolve();
  });
  clear = vi.fn();
  add = vi.fn().mockReturnThis();
  remove = vi.fn().mockReturnThis();
  configure = vi.fn().mockReturnThis();
  child = vi.fn().mockImplementation(() => new MockLogger());
  isLevelEnabled = vi.fn().mockReturnValue(true);
  profile = vi.fn().mockReturnThis();
  startTimer = vi.fn().mockReturnValue({
    done: vi.fn().mockReturnThis()
  });

  constructor(options: any = {}) {
    this.level = options.level || 'info';
    this.format = options.format || {};
    this.defaultMeta = options.defaultMeta || {};
    this.transports = options.transports || [];
    this.exitOnError = options.exitOnError !== false;
    this.silent = options.silent || false;
  }
}

// Mock winston module
export const mockWinston = {
  createLogger: (options: any = {}) => {
    const logger = createMockLogger();
    // Apply options if needed
    if (options.level) logger.level = options.level;
    if (options.format) logger.format = options.format;
    if (options.transports) logger.transports = options.transports;
    if (options.defaultMeta) logger.defaultMeta = options.defaultMeta;
    if (options.exitOnError !== undefined) logger.exitOnError = options.exitOnError;
    if (options.silent !== undefined) logger.silent = options.silent;
    return logger;
  },
  
  format: mockFormat,
  transports: mockTransports,
  
  // Default logger
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  http: vi.fn(),
  verbose: vi.fn(),
  debug: vi.fn(),
  silly: vi.fn(),
  log: vi.fn(),
  
  // Logger levels
  levels: {
    npm: {
      error: 0,
      warn: 1,
      info: 2,
      http: 3,
      verbose: 4,
      debug: 5,
      silly: 6
    },
    syslog: {
      emerg: 0,
      alert: 1,
      crit: 2,
      error: 3,
      warning: 4,
      notice: 5,
      info: 6,
      debug: 7
    }
  },
  
  // Configuration
  configure: vi.fn(),
  add: vi.fn(),
  remove: vi.fn(),
  clear: vi.fn(),
  profile: vi.fn(),
  startTimer: vi.fn().mockReturnValue({
    done: vi.fn()
  }),
  
  // Utilities
  query: vi.fn().mockResolvedValue([]),
  stream: vi.fn().mockReturnValue({}),
  close: vi.fn().mockImplementation((callback) => {
    if (callback) callback();
    return Promise.resolve();
  }),
  
  // Exception handling
  handleExceptions: vi.fn(),
  unhandleExceptions: vi.fn(),
  handleRejections: vi.fn(),
  unhandleRejections: vi.fn(),
  
  // Container
  Container: vi.fn().mockImplementation(() => ({
    add: vi.fn(),
    get: vi.fn().mockReturnValue(createMockLogger()),
    has: vi.fn().mockReturnValue(false),
    close: vi.fn().mockImplementation((callback) => {
      if (callback) callback();
      return Promise.resolve();
    })
  })),
  
  // Logform compatibility
  logform: {
    format: mockFormat,
    levels: {
      npm: {
        error: 0,
        warn: 1,
        info: 2,
        http: 3,
        verbose: 4,
        debug: 5,
        silly: 6
      }
    }
  },
  
  // Version
  version: '3.0.0',
  
  // Child logger
  child: vi.fn().mockImplementation(() => new MockLogger()),

  // Logger class export for instanceof checks
  Logger: MockLogger
};

// Export as both named and default export for compatibility
export { mockWinston as winston, MockLogger as Logger };

// Ensure proper default export for winston
export default mockWinston;