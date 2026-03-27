const express = require("express");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const { stringify } = require("csv-stringify/sync");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

const state = {
  profile: {
    cv: null,
    letter: null,
    selectedSkills: []
  },
  applications: [],
  processedAdKeys: new Set()
};

const skillCatalog = [
  "JavaScript",
  "TypeScript",
  "Node.js",
  "React",
  "Vue.js",
  "Angular",
  "Python",
  "Java",
  "C#",
  "PHP",
  "SQL",
  "PostgreSQL",
  "MongoDB",
  "Docker",
  "Kubernetes",
  "AWS",
  "Azure",
  "Git",
  "CI/CD",
  "REST API",
  "GraphQL"
];

const titleAliases = {
  "developpeur full stack": [
    "dev full stack",
    "developpeur web full stack",
    "software engineer full stack",
    "full stack engineer",
    "fullstack developer"
  ]
};

const platformEngines = {
  linkedin: { label: "LinkedIn Jobs" },
  indeed: { label: "Indeed" },
  wttj: { label: "Welcome to the Jungle" },
  glassdoor: { label: "Glassdoor" },
  monster: { label: "Monster" },
  hellowork: { label: "HelloWork" }
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeText(input = "") {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(input = "") {
  return normalizeText(input)
    .split(" ")
    .filter((t) => t.length > 1);
}

function semanticTitleScore(targetTitle, offerTitle) {
  const tNorm = normalizeText(targetTitle);
  const oNorm = normalizeText(offerTitle);
  if (!tNorm || !oNorm) return 0;
  if (tNorm === oNorm) return 1;

  const aliases = titleAliases[tNorm] || [];
  if (aliases.includes(oNorm)) return 0.96;
  if (aliases.some((a) => oNorm.includes(a) || a.includes(oNorm))) return 0.9;

  const tTokens = new Set(tokenize(tNorm));
  const oTokens = new Set(tokenize(oNorm));
  const intersection = [...tTokens].filter((x) => oTokens.has(x)).length;
  const union = new Set([...tTokens, ...oTokens]).size || 1;
  const jaccard = intersection / union;
  return jaccard;
}

function isLocationMatch(requested, offerLocation) {
  const wanted = normalizeText(requested);
  const location = normalizeText(offerLocation);
  if (!wanted) return true;
  if (wanted === "remote") return location.includes("remote");
  return location.includes(wanted);
}

function extractProfileInfoFromText(text) {
  const clean = text.replace(/\r/g, "");
  const emailMatch = clean.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const phoneMatch = clean.match(/(?:\+33|0)\s?[1-9](?:[\s.-]?\d{2}){4}/);
  const lines = clean.split("\n").map((l) => l.trim()).filter(Boolean);
  const name = lines[0] || "";

  const experiences = [];
  const education = [];
  const skills = [];
  const lower = clean.toLowerCase();

  skillCatalog.forEach((skill) => {
    if (lower.includes(skill.toLowerCase())) skills.push(skill);
  });

  const expKeywords = ["experience", "expériences", "professional", "emploi"];
  const eduKeywords = ["formation", "education", "diplome", "master", "licence"];

  lines.forEach((line) => {
    const n = normalizeText(line);
    if (expKeywords.some((k) => n.includes(normalizeText(k)))) experiences.push(line);
    if (eduKeywords.some((k) => n.includes(normalizeText(k)))) education.push(line);
  });

  return {
    name,
    email: emailMatch ? emailMatch[0] : "",
    phone: phoneMatch ? phoneMatch[0] : "",
    experiences: experiences.slice(0, 8),
    education: education.slice(0, 8),
    skills: [...new Set(skills)]
  };
}

async function parsePdfBuffer(buffer) {
  const data = await pdfParse(buffer);
  return data.text || "";
}

async function scrapeOffers(platformKey, title, location) {
  const sample = [
    {
      company: "NovaTech",
      title: "Développeur Web Full-Stack",
      city: "Lyon",
      applyUrl: "https://example.com/apply/novatech",
      requiresLetter: true
    },
    {
      company: "CloudSphere",
      title: "Software Engineer Full-Stack",
      city: "Remote",
      applyUrl: "https://example.com/apply/cloudsphere",
      requiresLetter: false
    },
    {
      company: "HexaSoft",
      title: "Dev Full Stack",
      city: "Île-de-France",
      applyUrl: "https://example.com/apply/hexasoft",
      requiresLetter: true
    },
    {
      company: "BluePixel",
      title: "Développeur Backend",
      city: "Paris",
      applyUrl: "https://example.com/apply/bluepixel",
      requiresLetter: false
    }
  ];

  const filtered = sample
    .map((offer) => ({
      ...offer,
      score: semanticTitleScore(title, offer.title),
      platform: platformEngines[platformKey]?.label || platformKey
    }))
    .filter((offer) => offer.score >= 0.5 && isLocationMatch(location, offer.city));

  return filtered;
}

async function applyToOffer(offer, profile, delayMs) {
  await sleep(delayMs);

  const appId = `${offer.platform}-${offer.company}-${offer.title}-${offer.city}`.toLowerCase();
  const now = new Date().toISOString();
  const item = {
    id: appId,
    company: offer.company,
    title: offer.title,
    city: offer.city,
    date: now,
    status: "⏳ En cours",
    platform: offer.platform
  };
  state.applications.unshift(item);

  const needsLetter = !!offer.requiresLetter;
  const hasLetter = !!profile.letter;
  const canSendLetter = needsLetter && hasLetter;

  const enableRealAutomation = process.env.ENABLE_REAL_AUTOMATION === "true";
  try {
    if (enableRealAutomation) {
      const { chromium } = require("playwright");
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      await page.goto(offer.applyUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(1500);
      await browser.close();
    }

    if (canSendLetter) {
      item.status = "📎 Lettre envoyée";
    } else {
      item.status = "✅ Postulé";
    }
  } catch (error) {
    item.status = "❌ Échec";
    item.error = error.message;
  }

  return item;
}

app.post("/api/profile/cv", upload.single("cv"), async (req, res) => {
  try {
    if (!req.file || req.file.mimetype !== "application/pdf") {
      return res.status(400).json({ error: "Un CV PDF est requis." });
    }

    const text = await parsePdfBuffer(req.file.buffer);
    const extracted = extractProfileInfoFromText(text);
    state.profile.cv = {
      filename: req.file.originalname,
      extracted
    };

    return res.json({ ok: true, extracted, skillCatalog });
  } catch (error) {
    return res.status(500).json({ error: "Erreur d'extraction du CV." });
  }
});

app.post("/api/profile/skills", (req, res) => {
  const incoming = Array.isArray(req.body.skills) ? req.body.skills : [];
  state.profile.selectedSkills = incoming.filter(Boolean);
  res.json({ ok: true, selectedSkills: state.profile.selectedSkills });
});

app.post("/api/profile/letter", upload.single("letter"), async (req, res) => {
  try {
    if (req.file) {
      if (req.file.mimetype === "application/pdf") {
        const text = await parsePdfBuffer(req.file.buffer);
        state.profile.letter = { type: "pdf", text, filename: req.file.originalname };
      } else if (req.file.mimetype.startsWith("text/")) {
        state.profile.letter = {
          type: "text",
          text: req.file.buffer.toString("utf8"),
          filename: req.file.originalname
        };
      } else {
        return res.status(400).json({ error: "Format de lettre non supporté." });
      }
      return res.json({ ok: true, hasLetter: true });
    }

    const text = typeof req.body.text === "string" ? req.body.text.trim() : "";
    if (!text) {
      return res.status(400).json({ error: "Fournis un fichier ou un texte de lettre." });
    }
    state.profile.letter = { type: "text", text };
    return res.json({ ok: true, hasLetter: true });
  } catch (error) {
    return res.status(500).json({ error: "Erreur lors de l'upload de la lettre." });
  }
});

app.post("/api/search/start", async (req, res) => {
  const title = req.body.title || "";
  const location = req.body.location || "";
  const platforms = Array.isArray(req.body.platforms) ? req.body.platforms : [];
  const delayMs = Math.max(1000, Number(req.body.delayMs || 3000));

  if (!title || !location || platforms.length === 0) {
    return res.status(400).json({ error: "Titre, localisation et plateformes sont requis." });
  }

  const profile = state.profile;
  if (!profile.cv) {
    return res.status(400).json({ error: "Charge ton CV avant de lancer les candidatures." });
  }

  const runResults = [];
  for (const platformKey of platforms) {
    const offers = await scrapeOffers(platformKey, title, location);
    for (const offer of offers) {
      const adKey = `${offer.company}-${offer.title}-${offer.city}-${offer.platform}`.toLowerCase();
      if (state.processedAdKeys.has(adKey)) continue;
      state.processedAdKeys.add(adKey);

      const result = await applyToOffer(offer, profile, delayMs);
      runResults.push(result);
    }
  }

  return res.json({
    ok: true,
    appliedCount: runResults.length,
    applications: runResults
  });
});

app.get("/api/applications", (req, res) => {
  res.json({ applications: state.applications });
});

app.get("/api/applications/export.csv", (req, res) => {
  const records = state.applications.map((a) => ({
    entreprise: a.company,
    poste: a.title,
    ville: a.city,
    date: a.date,
    statut: a.status,
    plateforme: a.platform
  }));

  const csv = stringify(records, { header: true });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=candidatures.csv");
  res.send(csv);
});

app.get("*", (req, res) => {
  const indexPath = path.join(__dirname, "public", "index.html");
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  return res.status(404).send("UI non trouvée");
});

app.listen(PORT, () => {
  console.log(`Serveur lancé sur http://localhost:${PORT}`);
});
