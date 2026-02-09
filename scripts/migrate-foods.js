#!/usr/bin/env node
/**
 * foods migrator
 * - scans ./foods
 * - builds normalized structure in ./foods_normalized (default)
 * - generates out/products.json + reports
 *
 * Usage:
 *   node scripts/migrate-foods.js                 (dry run)
 *   node scripts/migrate-foods.js --apply         (write files)
 *   node scripts/migrate-foods.js --src foods --dst foods_normalized --apply
 */

const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const crypto = require("crypto");
const fg = require("fast-glob");
const pLimit = require("p-limit");
const sizeOf = require("image-size");

const args = new Set(process.argv.slice(2));
const getArgValue = (name, def) => {
  const idx = process.argv.indexOf(name);
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return def;
};

const APPLY = args.has("--apply");
const SRC = path.resolve(getArgValue("--src", "foods"));
const DST = path.resolve(getArgValue("--dst", "foods_normalized"));
const OUT_DIR = path.resolve(getArgValue("--out", "out"));

const IMG_EXT = new Set([".webp", ".jpg", ".jpeg", ".png"]);
const DOC_EXT = new Set([".docx", ".doc", ".pdf"]);

const SERVICE_WORDS = [
  "текстовка",
  "маркировка",
  "состав",
  "описание",
  "этикетка",
  "label",
  "text",
  "info",
];

function isWin() {
  return process.platform === "win32";
}

// Windows long path helper: \\?\ prefix for fs ops if needed
function toFsPath(p) {
  if (!isWin()) return p;
  // normalize to absolute
  const abs = path.resolve(p);
  if (abs.startsWith("\\\\?\\")) return abs;
  // only add prefix for very long paths
  if (abs.length > 240) return "\\\\?\\" + abs;
  return abs;
}

function md5(s) {
  return crypto.createHash("md5").update(s).digest("hex");
}

function safeSlug(s, max = 80) {
  const cleaned = s
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ") // illegal file chars
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > max ? cleaned.slice(0, max).trim() : cleaned;
}

function normalizeName(raw) {
  if (!raw) return null;
  let s = raw;

  // remove extension if present
  s = s.replace(/\.[a-z0-9]{2,5}$/i, "");

  // remove quotes and edge punctuation
  s = s.replace(/[«»"]/g, "");
  s = s.replace(/[_]+/g, " ");
  s = s.replace(/\s+/g, " ").trim();

  // remove service words
  for (const w of SERVICE_WORDS) {
    const re = new RegExp(`\\b${w}\\b`, "gi");
    s = s.replace(re, "");
  }

  // normalize separators
  s = s.replace(/\s*[|•·]\s*/g, " ");
  s = s.replace(/\s+/g, " ").trim();

  // soften multiple commas
  s = s.replace(/\s*,\s*/g, ", ");

  // remove trailing dashes/commas
  s = s.replace(/[-,]+$/g, "").trim();

  return s || null;
}

function extractBrand(relPath) {
  // expected relPath like "01 Tayas/..."
  const first = relPath.split(/[\\/]/)[0] || "";
  // strip leading number prefixes: "01 Tayas" -> "Tayas"
  return safeSlug(first.replace(/^\d+\s+/, "").trim(), 60) || "Unknown";
}

function extractSku(text) {
  if (!text) return null;
  const t = text.toUpperCase();

  // 1) A-Z prefix + digits: PL1169, BS0001...
  let m = t.match(/\b([A-Z]{1,3}\d{3,6})\b/);
  if (m) return m[1];

  // 2) № 1753
  m = text.match(/№\s*(\d{3,6})/);
  if (m) return m[1];

  // 3) pure digits 3-6, but avoid weights/pack
  // take candidates and filter
  const candidates = [...text.matchAll(/\b(\d{3,6})\b/g)].map((x) => x[1]);
  if (!candidates.length) return null;

  const badAround = /(г|гр|gr|kg|кг|ml|мл|шт|pcs|box|carton)/i;
  for (const c of candidates) {
    const idx = text.indexOf(c);
    const around = text.slice(
      Math.max(0, idx - 6),
      Math.min(text.length, idx + c.length + 6),
    );
    if (badAround.test(around)) continue;
    // avoid common weight-like numbers if appear alone
    if (["1000", "500", "250", "100"].includes(c)) continue;
    return c;
  }
  return null;
}

function isPlaceholderImage(filePath) {
  try {
    const dim = sizeOf(toFsPath(filePath));
    // your audit: 478x58 placeholders "название"
    return dim && dim.width === 478 && dim.height === 58;
  } catch {
    return false;
  }
}

async function ensureDir(p) {
  if (!APPLY) return;
  await fsp.mkdir(toFsPath(p), { recursive: true });
}

async function copyFile(src, dst) {
  if (!APPLY) return;
  await ensureDir(path.dirname(dst));
  await fsp.copyFile(toFsPath(src), toFsPath(dst));
}

function pickProductFolder(fileRel) {
  // Heuristic: product folder = directory of the file
  // We will group by (brand + sku + folder) to avoid collapsing no-sku
  return path.dirname(fileRel);
}

function fileBase(p) {
  return path.basename(p, path.extname(p));
}

function getExt(p) {
  return path.extname(p).toLowerCase();
}

async function main() {
  console.log("🧹 FOODS MIGRATOR");
  console.log(
    "================================================================================",
  );
  console.log("SRC:", SRC);
  console.log("DST:", DST);
  console.log("OUT:", OUT_DIR);
  console.log("MODE:", APPLY ? "APPLY (writes files)" : "DRY-RUN (no writes)");
  console.log("");

  // sanity
  if (!fs.existsSync(toFsPath(SRC))) {
    console.error("❌ SRC folder not found:", SRC);
    process.exit(1);
  }

  const patterns = ["**/*.{webp,jpg,jpeg,png}", "**/*.{docx,doc,pdf}"];
  const files = await fg(patterns, {
    cwd: SRC,
    onlyFiles: true,
    dot: false,
    followSymbolicLinks: false,
  });

  console.log(`🔍 Found files: ${files.length}`);

  const items = files.map((rel) => {
    const abs = path.join(SRC, rel);
    const ext = getExt(abs);
    const kind = IMG_EXT.has(ext)
      ? "image"
      : DOC_EXT.has(ext)
        ? "doc"
        : "other";
    const brand = extractBrand(rel);
    const sku = extractSku(rel);
    const productFolderRel = pickProductFolder(rel);
    return { rel, abs, ext, kind, brand, sku, productFolderRel };
  });

  // Grouping: brand + (sku if exists else folder hash) + productFolderRel
  const groups = new Map();
  for (const it of items) {
    const baseKey = it.sku
      ? `${it.brand}|${it.sku}`
      : `${it.brand}|NO-SKU|${md5(it.productFolderRel).slice(0, 8)}`;
    const key = `${baseKey}|${it.productFolderRel}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        brand: it.brand,
        sku: it.sku,
        productFolderRel: it.productFolderRel,
        images: [],
        docs: [],
        placeholderImages: [],
        sourcePaths: [],
      });
    }
    const g = groups.get(key);
    g.sourcePaths.push(it.rel);
    if (it.kind === "image") {
      if (isPlaceholderImage(it.abs)) g.placeholderImages.push(it);
      else g.images.push(it);
    } else if (it.kind === "doc") {
      g.docs.push(it);
    }
  }

  console.log(`📦 Product groups: ${groups.size}`);

  const limit = pLimit(8);

  const products = [];
  const issues = [];
  const manifest = [];

  let placeholdersRemoved = 0;

  for (const g of groups.values()) {
    // Determine ID
    const id = g.sku
      ? g.sku
      : `NO-SKU-${md5(g.brand + "|" + g.productFolderRel).slice(0, 10)}`;

    // Name priority:
    // 1) doc basename
    // 2) placeholder image basename
    // 3) folder name
    let rawName = null;
    if (g.docs.length) rawName = fileBase(g.docs[0].rel);
    else if (g.placeholderImages.length)
      rawName = fileBase(g.placeholderImages[0].rel);
    else rawName = path.basename(g.productFolderRel);

    const name = normalizeName(rawName) || `Product ${id}`;

    // Category/type/flavor from path (light heuristic)
    const relParts = g.productFolderRel.split(/[\\/]/).filter(Boolean);
    // after brand folder segment
    const catParts = relParts.slice(1); // drop "01 Tayas"
    const category = catParts[0] ? safeSlug(catParts[0], 60) : null;
    const type = catParts[1] ? safeSlug(catParts[1], 60) : null;
    const flavor = null;

    // choose main image
    let main = null;
    if (g.images.length) {
      main = g.images[0];
    }

    placeholdersRemoved += g.placeholderImages.length;

    const missingText = g.docs.length === 0;
    const missingImages = g.images.length === 0;

    const product = {
      id,
      brand: g.brand,
      name,
      slug: safeSlug(`${id}-${name}`.toLowerCase().replace(/\s+/g, "-"), 120),
      category,
      type,
      flavor,
      weight: { value: null, unit: null },
      packaging: {
        unit_weight_g: null,
        units_in_box: null,
        boxes_in_carton: null,
        raw: null,
      },
      description: missingText ? "" : "",
      composition: null,
      nutrition: { kcal: null, protein: null, fat: null, carb: null },
      images: [],
      source: {
        paths: g.sourcePaths,
        docs: g.docs.map((d) => d.rel),
      },
      flags: {
        missing_text: missingText,
        missing_images: missingImages,
        placeholder_images_removed: g.placeholderImages.length > 0,
        placeholder_used_for_name:
          !g.docs.length && g.placeholderImages.length > 0,
        needs_review: missingText || missingImages || !g.sku,
      },
    };

    // Build destination folder: DST/<brand>/<id - name>/
    const productFolderName = safeSlug(`${id} - ${name}`, 140);
    const dstFolder = path.join(DST, g.brand, productFolderName);

    // Copy/rename files
    const copyTasks = [];

    // main image
    if (main) {
      const dstMain = path.join(dstFolder, `main${main.ext}`);
      product.images.push(
        path.relative(process.cwd(), dstMain).replace(/\\/g, "/"),
      );
      copyTasks.push(limit(() => copyFile(main.abs, dstMain)));
    }

    // other images
    const others = g.images.filter((x) => x !== main);
    let idx = 1;
    for (const im of others) {
      const dstImg = path.join(
        dstFolder,
        `img-${String(idx).padStart(2, "0")}${im.ext}`,
      );
      product.images.push(
        path.relative(process.cwd(), dstImg).replace(/\\/g, "/"),
      );
      copyTasks.push(limit(() => copyFile(im.abs, dstImg)));
      idx++;
    }

    // docs
    let docIdx = 1;
    for (const d of g.docs) {
      const base =
        docIdx === 1 ? "text" : `doc-${String(docIdx).padStart(2, "0")}`;
      const dstDoc = path.join(dstFolder, `${base}${d.ext}`);
      copyTasks.push(limit(() => copyFile(d.abs, dstDoc)));
      docIdx++;
    }

    // meta.json per product
    const metaPath = path.join(dstFolder, "meta.json");
    copyTasks.push(
      limit(async () => {
        if (!APPLY) return;
        await ensureDir(dstFolder);
        await fsp.writeFile(
          toFsPath(metaPath),
          JSON.stringify(product, null, 2),
          "utf8",
        );
      }),
    );

    // run copies
    await Promise.all(copyTasks);

    // collect issues
    if (product.flags.needs_review) {
      issues.push({
        id,
        brand: product.brand,
        name: product.name,
        missing_text: missingText,
        missing_images: missingImages,
        no_sku: !g.sku,
        productFolderRel: g.productFolderRel,
      });
    }

    manifest.push({
      id,
      brand: product.brand,
      srcFolder: g.productFolderRel,
      dstFolder: path.relative(process.cwd(), dstFolder).replace(/\\/g, "/"),
      usedDocName: g.docs.length ? g.docs[0].rel : null,
      usedPlaceholderName:
        !g.docs.length && g.placeholderImages.length
          ? g.placeholderImages[0].rel
          : null,
    });

    products.push(product);
  }

  // write outputs
  await ensureDir(OUT_DIR);

  const outProducts = path.join(OUT_DIR, "products.json");
  const outReport = path.join(OUT_DIR, "migrate-report.json");
  const outManifest = path.join(OUT_DIR, "migrate-manifest.json");
  const outIssues = path.join(OUT_DIR, "issues.json");

  const report = {
    timestamp: new Date().toISOString(),
    mode: APPLY ? "apply" : "dry-run",
    src: SRC,
    dst: DST,
    stats: {
      totalFiles: files.length,
      productGroups: groups.size,
      productsCreated: products.length,
      issuesFound: issues.length,
      placeholdersRemoved,
    },
  };

  if (APPLY) {
    await fsp.writeFile(
      toFsPath(outProducts),
      JSON.stringify(products, null, 2),
      "utf8",
    );
    await fsp.writeFile(
      toFsPath(outIssues),
      JSON.stringify(issues, null, 2),
      "utf8",
    );
    await fsp.writeFile(
      toFsPath(outReport),
      JSON.stringify(report, null, 2),
      "utf8",
    );
    await fsp.writeFile(
      toFsPath(outManifest),
      JSON.stringify(manifest, null, 2),
      "utf8",
    );
  }

  console.log("");
  console.log("✅ DONE");
  console.log("Products:", products.length);
  console.log("Issues:", issues.length);
  console.log("Placeholders removed:", placeholdersRemoved);
  console.log("");
  console.log(
    APPLY
      ? "🟢 Files written."
      : "🟡 Dry run only. Add --apply to write files.",
  );
  console.log("Output:", OUT_DIR);
  console.log("Normalized folder:", DST);
}

main().catch((e) => {
  console.error("❌ ERROR:", e);
  process.exit(1);
});
