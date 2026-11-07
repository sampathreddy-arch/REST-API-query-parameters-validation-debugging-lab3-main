const express = require("express");

const app = express();
const PORT = 3000;

// GET /
app.get("/", (request, response) => {
  response.status(200).send("Welcome to my Lab 1 server!");
});

// GET /about
app.get("/about", (request, response) => {
  response.status(200).json({
    name: "Maduru Sampath Kumar Reddy",
    section: "CSE(FSD)2B"
  });
});

// GET /time
app.get("/time", (request, response) => {
  response.status(200).json({
    currentDateTime: new Date()
  });
});

// Handle unknown routes
app.use((request, response) => {
  response.status(404).send("404 - Page Not Found");
});

// Start the server
app.listen(PORT, () => {
  console.log(`Express server running at http://localhost:${PORT}`);
});
