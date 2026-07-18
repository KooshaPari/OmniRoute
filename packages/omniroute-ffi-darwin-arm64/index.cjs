// CommonJS shim so bundlers and Node CommonJS callers still work.
const m = require("./index.js");
module.exports = m;
module.exports.default = m.default;
module.exports.platform = m.platform;
module.exports.nativeDir = m.nativeDir;
module.exports.listCrates = m.listCrates;
module.exports.resolve = m.resolve;
