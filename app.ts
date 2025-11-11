import express, { Request, Response } from "express";
import dotenv from "dotenv";
import { pool } from "./db.js";
dotenv.config();

const PORT = process.env.PORT || 3000;
const app = express();
app.use(express.json());

app.get("/health", (req: Request, res: Response) => {
  res.json({ ok: true });
});

app.post("/data", async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name)
      return res.status(400).json({ message: "Name field is required." });
    const { rows } = await pool.query(
      "INSERT INTO items(name) VALUES ($1) RETURNING *",
      [name]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error inserting item into database" });
  }
});

app.get("/items", async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query("SELECT * FROM items");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching items from database" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}...`);
});
