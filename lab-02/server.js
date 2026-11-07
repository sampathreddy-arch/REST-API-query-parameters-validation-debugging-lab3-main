const path = require("path");

const express = require("express");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

const app = express();

const PORT = Number(process.env.PORT) || 3000;

// The database lives next to server.js. Tests can point to a temporary file
// by setting the DB_PATH environment variable.
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "books.db");

// express.json() reads the JSON request body and makes it available as req.body.
app.use(express.json());

// The connection is created inside initializeDBAndServer() before the server starts.
let db;

// Sample data is inserted only when the table is empty, so restarting the
// server does not create duplicate rows.
const SAMPLE_BOOKS = [
  { title: "Clean Code", author: "Robert C. Martin", price: 450, pages: 464 },
  { title: "The Pragmatic Programmer", author: "Andrew Hunt and David Thomas", price: 550, pages: 352 },
  { title: "Eloquent JavaScript", author: "Marijn Haverbeke", price: 400, pages: 472 },
  { title: "You Don't Know JS Yet", author: "Kyle Simpson", price: 300, pages: 146 },
  { title: "Node.js Design Patterns", author: "Mario Casciaro", price: 650, pages: 660 },
  { title: "JavaScript: The Good Parts", author: "Douglas Crockford", price: 350, pages: 176 },
  { title: "Head First JavaScript Programming", author: "Eric Freeman and Elisabeth Robson", price: 500, pages: 704 },
  { title: "The Rust Programming Language", author: "Steve Klabnik and Carol Nichols", price: 600, pages: 560 },
  { title: "Designing Data-Intensive Applications", author: "Martin Kleppmann", price: 750, pages: 616 },
];

/**
 * Converts the :bookId route parameter to a positive integer.
 * Returns null when the value is not a valid book ID.
 */
function parseBookId(rawBookId) {
  if (!/^\d+$/.test(rawBookId)) {
    return null;
  }

  const bookId = Number(rawBookId);

  if (!Number.isSafeInteger(bookId) || bookId <= 0) {
    return null;
  }

  return bookId;
}

/**
 * Validates the JSON body used by POST and PUT.
 * Returns an array of readable error messages.
 */
function validateBookBody(body) {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return ["Request body must be a JSON object."];
  }

  const errors = [];
  const { title, author, price, pages } = body;

  if (typeof title !== "string" || title.trim() === "") {
    errors.push("title is required and must be a non-empty string.");
  }

  if (typeof author !== "string" || author.trim() === "") {
    errors.push("author is required and must be a non-empty string.");
  }

  if (!Number.isInteger(price) || price <= 0) {
    errors.push("price is required and must be a positive integer.");
  }

  if (!Number.isInteger(pages) || pages <= 0) {
    errors.push("pages is required and must be a positive integer.");
  }

  return errors;
}

// ---------------------------------------------------------------------------
// CRUD routes
// ---------------------------------------------------------------------------

// GET /books/ - retrieve every book.
app.get("/books/", async (request, response, next) => {
  try {
    const books = await db.all(
      "SELECT id, title, author, price, pages FROM book ORDER BY id"
    );

    response.status(200).json(books);
  } catch (error) {
    next(error);
  }
});

// GET /books/:bookId/ - retrieve one book by ID.
app.get("/books/:bookId/", async (request, response, next) => {
  try {
    const bookId = parseBookId(request.params.bookId);

    if (bookId === null) {
      return response.status(400).json({
        error: "Invalid book ID. It must be a positive integer.",
      });
    }

    const book = await db.get(
      "SELECT id, title, author, price, pages FROM book WHERE id = ?",
      [bookId]
    );

    if (!book) {
      return response.status(404).json({
        error: `Book with ID ${bookId} was not found.`,
      });
    }

    response.status(200).json(book);
  } catch (error) {
    next(error);
  }
});

// POST /books/ - add a new book.
app.post("/books/", async (request, response, next) => {
  try {
    const validationErrors = validateBookBody(request.body);

    if (validationErrors.length > 0) {
      return response.status(400).json({
        error: "Validation failed.",
        details: validationErrors,
      });
    }

    const { title, author, price, pages } = request.body;

    // The ? placeholders keep user input separate from the SQL statement.
    const result = await db.run(
      "INSERT INTO book (title, author, price, pages) VALUES (?, ?, ?, ?)",
      [title.trim(), author.trim(), price, pages]
    );

    const createdBook = await db.get(
      "SELECT id, title, author, price, pages FROM book WHERE id = ?",
      [result.lastID]
    );

    response.status(201).json(createdBook);
  } catch (error) {
    next(error);
  }
});

// PUT /books/:bookId/ - replace the details of an existing book.
app.put("/books/:bookId/", async (request, response, next) => {
  try {
    const bookId = parseBookId(request.params.bookId);

    if (bookId === null) {
      return response.status(400).json({
        error: "Invalid book ID. It must be a positive integer.",
      });
    }

    const validationErrors = validateBookBody(request.body);

    if (validationErrors.length > 0) {
      return response.status(400).json({
        error: "Validation failed.",
        details: validationErrors,
      });
    }

    const existingBook = await db.get(
      "SELECT id FROM book WHERE id = ?",
      [bookId]
    );

    if (!existingBook) {
      return response.status(404).json({
        error: `Book with ID ${bookId} was not found.`,
      });
    }

    const { title, author, price, pages } = request.body;

    await db.run(
      "UPDATE book SET title = ?, author = ?, price = ?, pages = ? WHERE id = ?",
      [title.trim(), author.trim(), price, pages, bookId]
    );

    const updatedBook = await db.get(
      "SELECT id, title, author, price, pages FROM book WHERE id = ?",
      [bookId]
    );

    response.status(200).json(updatedBook);
  } catch (error) {
    next(error);
  }
});

// DELETE /books/:bookId/ - remove a book.
app.delete("/books/:bookId/", async (request, response, next) => {
  try {
    const bookId = parseBookId(request.params.bookId);

    if (bookId === null) {
      return response.status(400).json({
        error: "Invalid book ID. It must be a positive integer.",
      });
    }

    const book = await db.get(
      "SELECT id, title, author, price, pages FROM book WHERE id = ?",
      [bookId]
    );

    if (!book) {
      return response.status(404).json({
        error: `Book with ID ${bookId} was not found.`,
      });
    }

    await db.run("DELETE FROM book WHERE id = ?", [bookId]);

    response.status(200).json({
      message: "Book deleted successfully.",
      deletedBook: book,
    });
  } catch (error) {
    next(error);
  }
});

// Unknown routes return a consistent JSON 404 response.
app.use((request, response) => {
  response.status(404).json({
    error: `Route ${request.method} ${request.originalUrl} was not found.`,
  });
});

// Express recognises this as an error handler because it has four parameters.
app.use((error, request, response, next) => {
  // express.json() throws this error when the request body is not valid JSON.
  if (error.type === "entity.parse.failed") {
    return response.status(400).json({
      error: "Invalid JSON in request body.",
    });
  }

  console.error("Unexpected server error:", error);

  response.status(500).json({
    error: "Internal server error.",
  });
});

/**
 * Opens the database, creates the table, adds sample data when needed,
 * and only then starts the Express server.
 */
async function initializeDBAndServer() {
  try {
    db = await open({
      filename: DB_PATH,
      driver: sqlite3.Database,
    });

    await db.exec(`
      CREATE TABLE IF NOT EXISTS book (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        price INTEGER NOT NULL,
        pages INTEGER NOT NULL
      );
    `);

    const { count } = await db.get("SELECT COUNT(*) AS count FROM book");

    if (count === 0) {
      const insertBookQuery =
        "INSERT INTO book (title, author, price, pages) VALUES (?, ?, ?, ?)";

      for (const book of SAMPLE_BOOKS) {
        await db.run(insertBookQuery, [
          book.title,
          book.author,
          book.price,
          book.pages,
        ]);
      }

      console.log(`Inserted ${SAMPLE_BOOKS.length} sample books.`);
    } else {
      console.log(
        `Database already contains ${count} books. Skipping sample data.`
      );
    }

    const server = app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
      console.log(`SQLite database: ${DB_PATH}`);
    });

    // A port conflict is not a database error, but it should still be reported
    // clearly instead of showing a long Node.js stack trace.
    server.on("error", (error) => {
      if (error.code === "EADDRINUSE") {
        console.error(
          `Port ${PORT} is already in use. Stop the other server or set a different PORT.`
        );
      } else {
        console.error("Failed to start the server:", error);
      }

      process.exit(1);
    });
  } catch (error) {
    console.error("Failed to initialize the database or server:");
    console.error(error);
    process.exit(1);
  }
}

// Start the server when this file is run directly (node server.js / nodemon).
// Tests can require this file without starting another server.
if (require.main === module) {
  initializeDBAndServer();
}

module.exports = {
  app,
  initializeDBAndServer,
  DB_PATH,
};
