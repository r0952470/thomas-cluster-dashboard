// Minimal persistence layer: JSON snapshots + append-only JSONL logs under a
// data directory. Stands in for the SQLite + vector store of the full
// prototype (paper §8, Month 1) without native dependencies.

const fs = require('fs');
const path = require('path');

class Store {
  constructor(dataDir) {
    this.dataDir = dataDir;
    fs.mkdirSync(dataDir, { recursive: true });
  }

  _file(name) {
    return path.join(this.dataDir, name);
  }

  readJson(name, fallback) {
    const file = this._file(name);
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }

  writeJson(name, value) {
    const file = this._file(name);
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
    fs.renameSync(tmp, file);
  }

  appendLine(name, record) {
    fs.appendFileSync(this._file(name), JSON.stringify(record) + '\n');
  }

  readLines(name) {
    const file = this._file(name);
    if (!fs.existsSync(file)) return [];
    return fs
      .readFileSync(file, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l));
  }
}

module.exports = { Store };
