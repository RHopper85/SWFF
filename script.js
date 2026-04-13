const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const fontkit = require("fontkit");
const { ipcRenderer } = require("electron");

let phraseInput;
let sizeInput;
let sizeLabel;
let fontList;
let fontCountSpan;
let reloadBtn;
let statusBar;
let footerStatusText;
let versionFooterText;

let modalOverlay;
let modalTitle;
let modalBody;
let modalActions;

let FONTS_DIR = "";
let descriptions = {};
let fontCache = [];
let updateAvailableModalShown = false;

window.addEventListener("DOMContentLoaded", async () => {
  phraseInput = document.getElementById("phraseInput");
  sizeInput = document.getElementById("sizeInput");
  sizeLabel = document.getElementById("sizeLabel");
  fontList = document.getElementById("fontList");
  fontCountSpan = document.getElementById("fontCount");
  reloadBtn = document.getElementById("reloadBtn");
  statusBar = document.getElementById("statusBar");
  footerStatusText = document.getElementById("footerStatusText");
  versionFooterText = document.getElementById("versionFooterText");

  modalOverlay = document.getElementById("modalOverlay");
  modalTitle = document.getElementById("modalTitle");
  modalBody = document.getElementById("modalBody");
  modalActions = document.getElementById("modalActions");

  phraseInput.value =
    "Quick Jedi Bravely Fix Damaged X-Wings On Foggy Naboo Swamp 1234567890";

  phraseInput.addEventListener("input", updateSamples);

  sizeInput.addEventListener("input", () => {
    sizeLabel.textContent = sizeInput.value + "px";
    updateSamples();
  });

  reloadBtn.addEventListener("click", async () => {
    await loadDescriptions();
    await loadFonts();
    showInlineStatus("Fonts reloaded.", "info", 1800);
  });

  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) {
      closeModal();
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modalOverlay.classList.contains("show")) {
      closeModal();
    }
  });

  wireIpcEvents();

  await initPaths();
  await loadDescriptions();
  await loadFonts();
});

function wireIpcEvents() {
  ipcRenderer.on("app-version", (_event, data) => {
    setVersionFooter(data?.version || "");
  });

  ipcRenderer.on("show-about-dialog", (_event, data) => {
    showAboutModal(data);
  });

  ipcRenderer.on("show-howto-dialog", (_event, data) => {
    showHowToModal(data);
  });

  ipcRenderer.on("update-available", (_event, data) => {
    footerStatusText.textContent = "";
    showUpdateAvailableModal(data);
  });

  ipcRenderer.on("update-download-progress", (_event, data) => {
    const percent = Math.max(0, Math.min(100, Math.round(data.percent || 0)));
    footerStatusText.textContent = `Downloading update... ${percent}%`;
  });

  ipcRenderer.on("update-downloaded", (_event, data) => {
    footerStatusText.textContent = `Update v${data.version || ""} ready to install`;
    showRestartReadyModal(data);
  });

  ipcRenderer.on("update-error", (_event, data) => {
    console.error("Updater error:", data?.message || "Unknown updater error");
  });

  ipcRenderer.on("update-status", (_event, data) => {
    if (data?.state === "checking") {
      footerStatusText.textContent = "Checking for updates...";
    } else if (data?.state === "not-available") {
      footerStatusText.textContent = "Up to date";

      clearTimeout(window._updateFooterTimer);
      window._updateFooterTimer = setTimeout(() => {
        footerStatusText.textContent = "";
      }, 2000);
    }
  });
  
  ipcRenderer.on("manual-update-check-result", (_event, data) => {
    if (!data?.ok) {
      showMessageModal("Update Check", data.message || "Update check failed.");
    }
  });

  ipcRenderer.on("manual-update-check-started", () => {
    footerStatusText.textContent = "Checking for updates...";
  });
}

async function initPaths() {
  const res = await ipcRenderer.invoke("get-fonts-dir");
  if (res.ok) {
    FONTS_DIR = res.fontsDir;
  } else {
    showInlineStatus(res.message || "Could not find fonts folder.", "error");
  }
}

async function loadDescriptions() {
  const res = await ipcRenderer.invoke("get-font-descriptions");
  if (res.ok) {
    descriptions = res.descriptions || {};
  } else {
    descriptions = {};
    showInlineStatus(res.message || "Failed to load descriptions.", "error");
  }
}

async function saveDescription(fontFile, description) {
  const res = await ipcRenderer.invoke("set-font-description", {
    fontFile,
    description
  });

  if (res.ok) {
    descriptions = res.descriptions || {};
    return true;
  }

  showMessageModal("Save Failed", res.message || "Failed to save description.");
  return false;
}

async function loadFonts() {
  fontList.innerHTML = "";

  if (!FONTS_DIR) {
    showInlineStatus("Fonts folder is not available.", "error");
    return;
  }

  let entries;
  try {
    entries = await fs.promises.readdir(FONTS_DIR, {
      withFileTypes: true
    });
  } catch (err) {
    showInlineStatus("Could not read the fonts folder.", "error");
    return;
  }

  const exts = [".ttf", ".otf", ".woff", ".woff2"];
  const fonts = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;

    const ext = path.extname(entry.name).toLowerCase();
    if (!exts.includes(ext)) continue;

    const fullPath = path.join(FONTS_DIR, entry.name);

    fonts.push({
      name: getDisplayName(fullPath, entry.name),
      file: entry.name,
      path: fullPath,
      url: pathToFileURL(fullPath).href,
      ext,
      description: descriptions[entry.name] || ""
    });
  }

  fonts.sort((a, b) =>
    a.file.localeCompare(b.file, undefined, {
      sensitivity: "base",
      numeric: true
    })
  );
  fontCache = fonts;

  renderFontList(fonts);
}

function getDisplayName(fullPath, filename) {
  try {
    const font = fontkit.openSync(fullPath);
    return font.fullName || font.familyName || filename;
  } catch {
    return filename;
  }
}

async function renderFontList(fonts) {
  fontList.innerHTML = "";
  fontCountSpan.textContent = fonts.length;

  if (!fonts.length) {
    const empty = document.createElement("div");
    empty.className = "status";
    empty.textContent = "No supported fonts found in the fonts folder.";
    fontList.appendChild(empty);
    return;
  }

  const phrase = phraseInput.value;
  const size = parseInt(sizeInput.value, 10);

  for (let i = 0; i < fonts.length; i += 1) {
    const font = fonts[i];

    const row = document.createElement("div");
    row.className = "font-row";

    row.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      showDescriptionModal(font);
    });

    const header = document.createElement("div");
    header.className = "font-header";

    const meta = document.createElement("div");
    meta.className = "font-meta";

    const name = document.createElement("div");
    name.className = "font-name";
    name.textContent = font.name;

    meta.appendChild(name);

    if (font.description) {
      const desc = document.createElement("div");
      desc.className = "font-description";
      desc.textContent = font.description;
      meta.appendChild(desc);
    }

    const actions = document.createElement("div");
    actions.className = "font-actions";

    const isInstallable = [".ttf", ".otf"].includes(font.ext);
    let installBtn = null;

    if (isInstallable) {
      installBtn = document.createElement("button");
      installBtn.className = "install-btn";
      installBtn.textContent = "Checking...";
      installBtn.disabled = true;
      actions.appendChild(installBtn);
    } else {
      const note = document.createElement("div");
      note.className = "not-installable";
      note.textContent = "Preview only";
      actions.appendChild(note);
    }

    header.appendChild(meta);
    header.appendChild(actions);

    const sample = document.createElement("div");
    sample.className = "font-sample";
    sample.textContent = phrase;
    sample.style.fontSize = size + "px";

    const fontId = "f_" + i + "_" + Date.now();

    try {
      const face = new FontFace(fontId, `url(${font.url})`);
      face.load()
        .then((loadedFace) => {
          document.fonts.add(loadedFace);
          sample.style.fontFamily = `"${fontId}"`;
        })
        .catch(() => {
          sample.style.fontFamily = "system-ui, sans-serif";
        });
    } catch {
      sample.style.fontFamily = "system-ui, sans-serif";
    }

    row.appendChild(header);
    row.appendChild(sample);

    // Append immediately so sorted order stays stable
    fontList.appendChild(row);

    // Check install status after append so rows do not reorder
    if (isInstallable && installBtn) {
      ipcRenderer.invoke("is-font-installed", {
        fontPath: font.path,
        displayName: font.name
      }).then((installStatus) => {
        if (installStatus.ok && installStatus.installed) {
          installBtn.textContent = "Installed";
          installBtn.classList.add("installed");
          installBtn.disabled = true;
        } else {
          installBtn.textContent = "Install";
          installBtn.disabled = false;

          installBtn.onclick = async () => {
            installBtn.disabled = true;
            installBtn.textContent = "Installing...";

            const result = await ipcRenderer.invoke("install-font", {
              fontPath: font.path,
              displayName: font.name
            });

            if (result.ok) {
              installBtn.textContent = "Installed";
              installBtn.classList.add("installed");
              installBtn.disabled = true;
              showInlineStatus(result.message || "Font installed.", "success", 2500);
            } else {
              installBtn.textContent = "Install";
              installBtn.disabled = false;
              showMessageModal("Install Failed", result.message || "Could not install font.");
            }
          };
        }
      });
    }
  }
}

function updateSamples() {
  const phrase = phraseInput.value;
  const size = sizeInput.value + "px";

  document.querySelectorAll(".font-sample").forEach((el) => {
    el.textContent = phrase;
    el.style.fontSize = size;
  });
}

function setVersionFooter(version) {
  versionFooterText.textContent = version ? `Version ${version}` : "";
}

function showInlineStatus(message, type = "info", timeoutMs = 0) {
  statusBar.textContent = message;
  statusBar.className = `status-bar show ${type}`;

  if (timeoutMs > 0) {
    clearTimeout(showInlineStatus._timer);
    showInlineStatus._timer = setTimeout(() => {
      statusBar.className = "status-bar hidden";
      statusBar.textContent = "";
    }, timeoutMs);
  }
}

function clearModal() {
  modalTitle.textContent = "";
  modalBody.innerHTML = "";
  modalActions.innerHTML = "";
}

function createModalButton(label, options = {}) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "modal-btn";

  if (options.primary) btn.classList.add("primary");
  if (options.danger) btn.classList.add("danger");
  if (options.className) btn.classList.add(options.className);

  btn.textContent = label;

  if (typeof options.onClick === "function") {
    btn.addEventListener("click", options.onClick);
  }

  return btn;
}

function showModal({ title, bodyNode, actions = [] }) {
  clearModal();

  modalTitle.textContent = title;

  if (bodyNode) {
    modalBody.appendChild(bodyNode);
  }

  actions.forEach((action) => {
    modalActions.appendChild(action);
  });

  modalOverlay.classList.add("show");
}

function closeModal() {
  modalOverlay.classList.remove("show");
  clearModal();
}

function showMessageModal(title, message) {
  const body = document.createElement("div");
  body.className = "modal-message";
  body.textContent = message;

  showModal({
    title,
    bodyNode: body,
    actions: [
      createModalButton("OK", {
        primary: true,
        onClick: closeModal
      })
    ]
  });
}

function showAboutModal(data) {
  const body = document.createElement("div");
  body.className = "about-content";

  const name = document.createElement("div");
  name.className = "about-app-name";
  name.textContent = data.title || "Star Wars Font Finder";

  const subtitle = document.createElement("div");
  subtitle.className = "about-subtitle";
  subtitle.textContent = data.subtitle || "";

  const description = document.createElement("div");
  description.className = "about-description";
  description.textContent = data.description || "";

  const version = document.createElement("div");
  version.className = "about-version";
  version.textContent = `Version ${data.version || ""}`;

  const supportWrap = document.createElement("div");
  supportWrap.className = "about-support";

  const supportText = document.createElement("div");
  supportText.className = "about-support-text";
  supportText.textContent =
    "Like the app? Support its development by buying me a coffee!";

  const { shell } = require("electron");

  const supportLink = document.createElement("a");
  supportLink.className = "about-support-link";
  supportLink.href = "#";

  supportLink.addEventListener("click", (e) => {
    e.preventDefault();
    shell.openExternal("https://ko-fi.com/hop9285");
  });

  const supportImg = document.createElement("img");
  supportImg.className = "about-support-image";
  supportImg.src = "./ko-fi.png";
  supportImg.alt = "Support on Ko-fi";

  supportLink.appendChild(supportImg);
  supportWrap.appendChild(supportText);
  supportWrap.appendChild(supportLink);

  body.appendChild(name);
  body.appendChild(subtitle);
  body.appendChild(description);
  body.appendChild(version);
  body.appendChild(supportWrap);

  showModal({
    title: "About",
    bodyNode: body,
    actions: [
      createModalButton("OK", {
        primary: true,
        onClick: closeModal
      })
    ]
  });
}

function showHowToModal(data) {
  const body = document.createElement("div");
  body.className = "howto-content";

  const sections = Array.isArray(data?.sections) ? data.sections : [];

  sections.forEach((section) => {
    const block = document.createElement("div");
    block.className = "howto-section";

    const heading = document.createElement("div");
    heading.className = "howto-heading";
    heading.textContent = section.heading || "";

    const text = document.createElement("div");
    text.className = "howto-text";
    text.textContent = section.body || "";

    block.appendChild(heading);
    block.appendChild(text);
    body.appendChild(block);
  });

  showModal({
    title: "How To",
    bodyNode: body,
    actions: [
      createModalButton("OK", {
        primary: true,
        onClick: closeModal
      })
    ]
  });
}

function showDescriptionModal(font) {
  const body = document.createElement("div");
  body.className = "description-editor";

  const label = document.createElement("div");
  label.className = "description-label";
  label.textContent = font.name;

  const help = document.createElement("div");
  help.className = "description-help";
  help.textContent =
    "Add a description for this font. Leave it blank and save to clear it.";

  const input = document.createElement("textarea");
  input.className = "description-input";
  input.value = font.description || "";
  input.placeholder = "Enter a description...";
  input.spellcheck = false;

  body.appendChild(label);
  body.appendChild(help);
  body.appendChild(input);

  const cancelBtn = createModalButton("Cancel", {
    onClick: closeModal
  });

  const saveBtn = createModalButton("Save", {
    primary: true,
    onClick: async () => {
      const ok = await saveDescription(font.file, input.value);
      if (!ok) return;

      closeModal();
      await loadFonts();
      showInlineStatus("Description saved.", "success", 1800);
    }
  });

  showModal({
    title: "Set Description",
    bodyNode: body,
    actions: [cancelBtn, saveBtn]
  });

  setTimeout(() => {
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }, 20);
}

function showUpdateAvailableModal(data) {
  const body = document.createElement("div");
  body.className = "update-content";

  const message = document.createElement("div");
  message.className = "modal-message";
  message.textContent = `Version ${data.version || "new"} is available. Would you like to download and install it?`;

  body.appendChild(message);

  if (data.releaseNotes) {
    const notesTitle = document.createElement("div");
    notesTitle.className = "update-notes-title";
    notesTitle.textContent = "Release Notes";

    const notes = document.createElement("pre");
    notes.className = "update-notes";
    notes.textContent = data.releaseNotes;

    body.appendChild(notesTitle);
    body.appendChild(notes);
  }

  showModal({
    title: "Update Available",
    bodyNode: body,
    actions: [
      createModalButton("Not Now", {
        onClick: () => {
          closeModal();
          footerStatusText.textContent = "";
        }
      }),
      createModalButton("Update Now", {
        primary: true,
        onClick: async () => {
          closeModal();
          footerStatusText.textContent = "Starting update download...";

          const result = await ipcRenderer.invoke("download-update");
          if (!result.ok) {
            footerStatusText.textContent = "";
            showMessageModal(
              "Update Failed",
              result.message || "Could not start downloading the update."
            );
          }
        }
      })
    ]
  });
}

function showRestartReadyModal(data) {
  const body = document.createElement("div");
  body.className = "update-content";

  const message = document.createElement("div");
  message.className = "modal-message";
  message.textContent = `Version ${data.version || "new"} has finished downloading. Restart now to install it.`;

  body.appendChild(message);

  showModal({
    title: "Update Ready",
    bodyNode: body,
    actions: [
      createModalButton("Later", {
        onClick: closeModal
      }),
      createModalButton("Restart Now", {
        primary: true,
        onClick: async () => {
          const result = await ipcRenderer.invoke("install-downloaded-update");
          if (!result.ok) {
            showMessageModal(
              "Update Install Failed",
              result.message || "Could not start update install."
            );
          }
        }
      })
    ]
  });
}