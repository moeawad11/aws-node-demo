import express, { Request, Response } from "express";
import dotenv from "dotenv";
import { pool } from "./db.js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import multer from "multer";
dotenv.config();

const PORT = process.env.PORT || 3000;
const app = express();
app.use(express.json());

const s3 = new S3Client({
  region: "eu-north-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});
const BUCKET = process.env.BUCKET;
const upload = multer();

app.get("/", (req: Request, res: Response) => {
  res.json({ message: "Hello There!" });
});

app.get("/filteritems", async (req, res) => {
  try {
    const { q } = req.query;
    const search = `${q || ""}%`;
    const result = await pool.query("SELECT * FROM items WHERE name ILIKE $1", [
      search,
    ]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error filtering item from database" });
  }
});

app.post("/data", async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name)
      return res.status(400).json({ message: "Name field is required." });

    const result = await pool.query("SELECT name FROM items WHERE name=$1", [
      name,
    ]);
    if (result.rows.length > 0)
      return res.status(409).json({ message: "Item name already exists." });
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

app.post("/upload", async (req: Request, res: Response) => {
  try {
    if (!BUCKET)
      return res.status(500).json({ message: "Bucket not configured." });

    const body = Buffer.from("Hello from aws-node-demo");
    const key = `test-${Date.now()}.txt`;

    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: body,
        ContentType: "text/plain",
      })
    );
    res.status(201).json({ message: "Uploaded", key });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error uploading to S3" });
  }
});

app.post(
  "/upload-file",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) res.status(400).json({ message: "File required." });

      const key = `${Date.now()}-${req.file?.originalname}`;

      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: key,
          Body: req.file?.buffer,
          ContentType: req.file?.mimetype,
        })
      );

      res.status(201).json({ message: "Uploaded to file", key });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "S3 upload failed" });
    }
  }
);

app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}...`);
});
