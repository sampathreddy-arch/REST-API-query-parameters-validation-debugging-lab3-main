const { describe, test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const SERVER_DIR = path.resolve(__dirname, "..");
const TEST_DB_PATH = path.join(__dirname, "test-books.db");
const PORT = 3100;
const BASE_URL = `http://127.0.0.1:${PORT}`;

let serverProcess;

function removeTestDatabase() {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    const file = `${TEST_DB_PATH}${suffix}`;
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  }
}

function startServer() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["server.js"], {
      cwd: SERVER_DIR,
      env: {
        ...process.env,
        PORT: String(PORT),
        DB_PATH: TEST_DB_PATH,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let output = "";
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`Server did not start in time.\n${output}`));
    }, 15000);

    const collectOutput = (chunk) => {
      output += chunk.toString();

      if (output.includes("Server running at")) {
        clearTimeout(timeout);
        resolve(child);
      }
    };

    child.stdout.on("data", collectOutput);
    child.stderr.on("data", collectOutput);

    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Server exited before it was ready (code ${code}).\n${output}`));
    });
  });
}

function stopServer(child) {
  if (!child || child.exitCode !== null) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    child.once("exit", resolve);
    child.kill();
  });
}

async function request(method, pathname, body) {
  const options = { method, headers: {} };

  if (body !== undefined) {
    options.headers["Content-Type"] = "application/json";
    options.body = typeof body === "string" ? body : JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${pathname}`, options);
  const text = await response.text();
  let parsedBody = null;

  if (text !== "") {
    try {
      parsedBody = JSON.parse(text);
    } catch {
      parsedBody = text;
    }
  }

  return { status: response.status, body: parsedBody };
}

const validBook = {
  title: "Clean Architecture",
  author: "Robert C. Martin",
  price: 480,
  pages: 432,
};

describe("Lab 2 - Books CRUD API", () => {
  let createdBookId;
  let persistedBookId;

  before(async () => {
    removeTestDatabase();
    serverProcess = await startServer();
  });

  after(async () => {
    await stopServer(serverProcess);
    removeTestDatabase();
  });

  test("GET /books/ returns all seeded books", async () => {
    const { status, body } = await request("GET", "/books/");

    assert.equal(status, 200);
    assert.ok(Array.isArray(body));
    assert.equal(body.length, 9);
    assert.deepEqual(Object.keys(body[0]), ["id", "title", "author", "price", "pages"]);
  });

  test("GET /books/:bookId/ returns one book", async () => {
    const { status, body } = await request("GET", "/books/1/");

    assert.equal(status, 200);
    assert.equal(body.id, 1);
    assert.equal(body.title, "Clean Code");
  });

  test("GET /books/:bookId/ returns 404 for a missing book", async () => {
    const { status, body } = await request("GET", "/books/999999/");

    assert.equal(status, 404);
    assert.match(body.error, /not found/i);
  });

  test("GET /books/:bookId/ returns 400 for an invalid ID", async () => {
    const { status, body } = await request("GET", "/books/not-a-number/");

    assert.equal(status, 400);
    assert.match(body.error, /Invalid book ID/i);
  });

  test("POST /books/ creates a book and returns 201", async () => {
    const { status, body } = await request("POST", "/books/", validBook);

    assert.equal(status, 201);
    assert.ok(Number.isInteger(body.id));
    assert.equal(body.title, validBook.title);
    assert.equal(body.author, validBook.author);
    assert.equal(body.price, validBook.price);
    assert.equal(body.pages, validBook.pages);

    createdBookId = body.id;
  });

  test("POST /books/ rejects a body with missing fields", async () => {
    const { status, body } = await request("POST", "/books/", {
      title: "Incomplete Book",
    });

    assert.equal(status, 400);
    assert.equal(body.error, "Validation failed.");
    assert.ok(body.details.length >= 3);
  });

  test("POST /books/ rejects invalid JSON", async () => {
    const { status, body } = await request(
      "POST",
      "/books/",
      '{"title": "Broken JSON",'
    );

    assert.equal(status, 400);
    assert.match(body.error, /Invalid JSON/i);
  });

  test("PUT /books/:bookId/ updates an existing book", async () => {
    const updatedBook = {
      title: "Clean Architecture (Updated)",
      author: "Robert C. Martin",
      price: 500,
      pages: 450,
    };

    const { status, body } = await request(
      "PUT",
      `/books/${createdBookId}/`,
      updatedBook
    );

    assert.equal(status, 200);
    assert.equal(body.id, createdBookId);
    assert.equal(body.title, updatedBook.title);
    assert.equal(body.price, updatedBook.price);
    assert.equal(body.pages, updatedBook.pages);
  });

  test("PUT /books/:bookId/ returns 404 for a missing book", async () => {
    const { status, body } = await request("PUT", "/books/999999/", validBook);

    assert.equal(status, 404);
    assert.match(body.error, /not found/i);
  });

  test("DELETE /books/:bookId/ deletes an existing book", async () => {
    const { status, body } = await request(
      "DELETE",
      `/books/${createdBookId}/`
    );

    assert.equal(status, 200);
    assert.equal(body.deletedBook.id, createdBookId);
    assert.match(body.message, /deleted successfully/i);

    const getResponse = await request("GET", `/books/${createdBookId}/`);
    assert.equal(getResponse.status, 404);
  });

  test("DELETE /books/:bookId/ returns 404 for a missing book", async () => {
    const { status, body } = await request(
      "DELETE",
      `/books/${createdBookId}/`
    );

    assert.equal(status, 404);
    assert.match(body.error, /not found/i);
  });

  test("changes persist in SQLite after a server restart", async () => {
    const createResponse = await request("POST", "/books/", {
      title: "Persistent Book",
      author: "Test Author",
      price: 250,
      pages: 200,
    });

    assert.equal(createResponse.status, 201);
    persistedBookId = createResponse.body.id;

    await stopServer(serverProcess);
    serverProcess = await startServer();

    const getResponse = await request("GET", `/books/${persistedBookId}/`);

    assert.equal(getResponse.status, 200);
    assert.equal(getResponse.body.title, "Persistent Book");

    const countResponse = await request("GET", "/books/");
    assert.equal(countResponse.body.length, 10);
  });
});
