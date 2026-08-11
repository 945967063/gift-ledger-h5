const { DatabaseSync } = require('node:sqlite');

class NodeSqliteAdapter {
  constructor(filename) {
    this.database = new DatabaseSync(filename);
  }

  pragma(statement) {
    this.database.exec(`PRAGMA ${statement}`);
  }

  exec(sql) {
    return this.database.exec(sql);
  }

  prepare(sql) {
    const statement = this.database.prepare(sql);
    return {
      run: (...params) => statement.run(...params),
      get: (...params) => statement.get(...params),
      all: (...params) => statement.all(...params),
    };
  }

  transaction(callback) {
    return (...args) => {
      this.database.exec('BEGIN IMMEDIATE');
      try {
        const result = callback(...args);
        this.database.exec('COMMIT');
        return result;
      } catch (error) {
        this.database.exec('ROLLBACK');
        throw error;
      }
    };
  }

  close() {
    this.database.close();
  }
}

module.exports = NodeSqliteAdapter;
