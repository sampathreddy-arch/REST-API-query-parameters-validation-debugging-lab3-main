# Node.js and Express - Course Lab Repository

This repository contains the lab work for **Backend Development Fundamentals**.

| Lab | Topic | Folder |
| --- | --- | --- |
| Lab 01 | Node.js and Express server | [`lab-01/`](lab-01/) |
| Lab 02 | SQLite database and CRUD routes | [`lab-02/`](lab-02/) |
| Lab 03 | REST API, query parameters, validation, debugging | [`lab-03/`](lab-03/) |

## Lab 01

The original Lab 1 files are preserved unchanged in [`lab-01/`](lab-01/).

```bash
cd lab-01
npm install
npm start
```

The Lab 1 server runs at `http://localhost:3000`.

## Lab 02

Lab 2 adds a SQLite database and a complete CRUD API for books.

```bash
cd lab-02
npm install
npm run dev
```

The Lab 2 server also runs at `http://localhost:3000`. Run only one lab at a time,
or change the `PORT` environment variable for one of them.

See [`lab-02/README.md`](lab-02/README.md) for the database schema, endpoint
documentation, sample requests, test results, and viva answers.

## Lab 03

Lab 3 turns the Lab 2 CRUD routes into a REST API with search, sorting,
pagination, a price filter, validation, and consistent status codes and error
messages.

```bash
cd lab-03
npm install
npm run dev
```

The Lab 3 server also runs at `http://localhost:3000`. Run only one lab at a
time, or change the `PORT` environment variable for one of them.

See [`lab-03/README.md`](lab-03/README.md) for the query parameters, the
endpoint documentation, the 30-request Postman collection, and test results.

## Repository notes

- `node_modules/` is not committed; run `npm install` inside the lab folder.
- Do not commit `.env` files or secrets.
- `lab-02/books.db` is committed intentionally so the lab submission includes
  the database file required by the lab sheet.
