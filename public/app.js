const state = {
  selectedSkills: new Set(),
  page: 1,
  totalPages: 1
};

const cvFile = document.getElementById("cvFile");
const uploadCvBtn = document.getElementById("uploadCvBtn");
const cvOutput = document.getElementById("cvOutput");
const skillsTags = document.getElementById("skillsTags");
const saveSkillsBtn = document.getElementById("saveSkillsBtn");
const letterFile = document.getElementById("letterFile");
const letterText = document.getElementById("letterText");
const uploadLetterBtn = document.getElementById("uploadLetterBtn");
const jobTitle = document.getElementById("jobTitle");
const locationInput = document.getElementById("location");
const delayMs = document.getElementById("delayMs");
const startBtn = document.getElementById("startBtn");
const runMessage = document.getElementById("runMessage");
const applicationsBody = document.getElementById("applicationsBody");
const statTotal = document.getElementById("statTotal");
const statSuccess = document.getElementById("statSuccess");
const statFailed = document.getElementById("statFailed");
const statPending = document.getElementById("statPending");
const statLetter = document.getElementById("statLetter");
const searchQuery = document.getElementById("searchQuery");
const statusFilter = document.getElementById("statusFilter");
const platformFilter = document.getElementById("platformFilter");
const cityFilter = document.getElementById("cityFilter");
const pageSize = document.getElementById("pageSize");
const prevPageBtn = document.getElementById("prevPageBtn");
const nextPageBtn = document.getElementById("nextPageBtn");
const pageInfo = document.getElementById("pageInfo");
const chart = document.getElementById("chart");

function showMessage(msg) {
  runMessage.textContent = msg;
}

function renderSkills(skills = []) {
  skillsTags.innerHTML = "";
  skills.forEach((skill) => {
    const button = document.createElement("button");
    button.textContent = skill;
    button.className = state.selectedSkills.has(skill) ? "tag active" : "tag";
    button.addEventListener("click", () => {
      if (state.selectedSkills.has(skill)) state.selectedSkills.delete(skill);
      else state.selectedSkills.add(skill);
      renderSkills(skills);
    });
    skillsTags.appendChild(button);
  });
}

async function uploadCv() {
  const file = cvFile.files?.[0];
  if (!file) return showMessage("Sélectionne un CV PDF.");

  const formData = new FormData();
  formData.append("cv", file);

  const res = await fetch("/api/profile/cv", { method: "POST", body: formData });
  const data = await res.json();
  if (!res.ok) return showMessage(data.error || "Erreur upload CV.");

  const extracted = data.extracted;
  extracted.skills.forEach((s) => state.selectedSkills.add(s));
  renderSkills(data.skillCatalog || []);
  cvOutput.textContent = JSON.stringify(extracted, null, 2);
  showMessage("CV extrait avec succès.");
}

async function saveSkills() {
  const skills = [...state.selectedSkills];
  const res = await fetch("/api/profile/skills", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ skills })
  });
  const data = await res.json();
  if (!res.ok) return showMessage(data.error || "Erreur d'enregistrement des compétences.");
  showMessage(`Compétences enregistrées: ${data.selectedSkills.length}`);
}

async function uploadLetter() {
  const formData = new FormData();
  const file = letterFile.files?.[0];
  const text = letterText.value.trim();

  if (file) formData.append("letter", file);
  else formData.append("text", text);

  const res = await fetch("/api/profile/letter", { method: "POST", body: formData });
  const data = await res.json();
  if (!res.ok) return showMessage(data.error || "Erreur upload lettre.");
  showMessage("Lettre enregistrée.");
}

function renderChart(byDay = []) {
  chart.innerHTML = "";
  const max = Math.max(1, ...byDay.map((x) => x.count));
  byDay.forEach((row) => {
    const bar = document.createElement("div");
    bar.className = "bar";
    bar.style.height = `${Math.max(8, Math.round((row.count / max) * 100))}px`;
    bar.title = `${row.day}: ${row.count}`;
    const label = document.createElement("span");
    label.className = "bar-label";
    label.textContent = row.day.slice(5);
    bar.appendChild(label);
    chart.appendChild(bar);
  });
}

function refillSelect(select, values) {
  const current = select.value;
  const first = select.querySelector("option")?.outerHTML || "";
  select.innerHTML = first;
  values.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    select.appendChild(opt);
  });
  if ([...select.options].some((o) => o.value === current)) select.value = current;
}

async function refreshApplications() {
  const params = new URLSearchParams({
    page: String(state.page),
    pageSize: pageSize.value,
    q: searchQuery.value.trim(),
    status: statusFilter.value,
    platform: platformFilter.value,
    city: cityFilter.value
  });
  const res = await fetch(`/api/dashboard?${params.toString()}`);
  const data = await res.json();
  const apps = data.items || [];

  applicationsBody.innerHTML = "";
  apps.forEach((app) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${app.company}</td>
      <td>${app.title}</td>
      <td>${app.city}</td>
      <td>${new Date(app.date).toLocaleString("fr-FR")}</td>
      <td>${app.status}</td>
      <td>${app.platform}</td>
    `;
    applicationsBody.appendChild(tr);
  });

  statTotal.textContent = String(data.summary?.total || 0);
  statSuccess.textContent = String(data.summary?.success || 0);
  statFailed.textContent = String(data.summary?.failed || 0);
  statPending.textContent = String(data.summary?.pending || 0);
  statLetter.textContent = String(data.summary?.withLetter || 0);

  refillSelect(platformFilter, data.filters?.platforms || []);
  refillSelect(cityFilter, data.filters?.cities || []);
  renderChart(data.byDay || []);

  state.totalPages = data.totalPages || 1;
  pageInfo.textContent = `Page ${data.page || 1} / ${state.totalPages}`;
  prevPageBtn.disabled = state.page <= 1;
  nextPageBtn.disabled = state.page >= state.totalPages;
}

async function startRun() {
  const title = jobTitle.value.trim();
  const location = locationInput.value;
  const platforms = [...document.querySelectorAll(".platforms input:checked")].map((x) => x.value);
  const antiSpamDelay = Number(delayMs.value || 3000);

  if (!title) return showMessage("Renseigne un intitulé de poste.");
  if (platforms.length === 0) return showMessage("Sélectionne au moins une plateforme.");

  startBtn.disabled = true;
  showMessage("Lancement des candidatures en cours...");
  try {
    const res = await fetch("/api/search/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, location, platforms, delayMs: antiSpamDelay })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erreur lancement.");

    showMessage(`Terminé: ${data.appliedCount} candidature(s) traitée(s).`);
    state.page = 1;
    await refreshApplications();
  } catch (error) {
    showMessage(error.message);
  } finally {
    startBtn.disabled = false;
  }
}

uploadCvBtn.addEventListener("click", uploadCv);
saveSkillsBtn.addEventListener("click", saveSkills);
uploadLetterBtn.addEventListener("click", uploadLetter);
startBtn.addEventListener("click", startRun);
searchQuery.addEventListener("input", () => {
  state.page = 1;
  refreshApplications();
});
[statusFilter, platformFilter, cityFilter, pageSize].forEach((el) => {
  el.addEventListener("change", () => {
    state.page = 1;
    refreshApplications();
  });
});
prevPageBtn.addEventListener("click", () => {
  state.page = Math.max(1, state.page - 1);
  refreshApplications();
});
nextPageBtn.addEventListener("click", () => {
  state.page = Math.min(state.totalPages, state.page + 1);
  refreshApplications();
});

refreshApplications();
