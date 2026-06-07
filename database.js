const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./gastos.db", (err) => {
  if (err) {
    console.error(err.message);
  } else {
    console.log("Banco SQLite conectado.");
  }
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS gastos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      descricao TEXT NOT NULL,
      valor REAL NOT NULL,
      categoria TEXT NOT NULL,
      data TEXT NOT NULL
    )
  `);
});

module.exports = db;