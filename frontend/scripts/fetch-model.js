/* eslint-disable no-undef */
// Downloads the embedding model assets used by the WASM memory engine
// (see src/services/wingMemoryEngine.ts) into assets/model, so they can be
// bundled and served from the add-in's own origin instead of being fetched
// from huggingface.co at runtime in the user's browser.
const fs = require("fs");
const path = require("path");
const https = require("https");

const BASE_URL = "https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main";
const OUT_DIR = path.resolve(__dirname, "../assets/model");
const FILES = ["config.json", "tokenizer.json", "model.safetensors"];

const download = (url, dest) =>
  new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.unlinkSync(dest);
          const redirectUrl = new URL(res.headers.location, url).toString();
          download(redirectUrl, dest).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Failed to fetch ${url}: ${res.statusCode}`));
          return;
        }
        res.pipe(file);
        file.on("finish", () => file.close(resolve));
      })
      .on("error", reject);
  });

const main = async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const name of FILES) {
    const dest = path.join(OUT_DIR, name);
    if (fs.existsSync(dest)) {
      console.log(`[fetch-model] ${name} already present, skipping.`);
      continue;
    }
    console.log(`[fetch-model] Downloading ${name}...`);
    await download(`${BASE_URL}/${name}`, dest);
  }
  console.log("[fetch-model] Done.");
};

main().catch((err) => {
  console.error("[fetch-model] Failed:", err);
  process.exit(1);
});
