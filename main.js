const {
  app,
  BrowserWindow,
  Menu,
  ipcMain,
  shell
} = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { execFile } = require("child_process");
const { autoUpdater } = require("electron-updater");

app.disableHardwareAcceleration();
app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");

let mainWindow = null;
let keepOnTopMenuItem = null;

let updateState = {
  checking: false,
  available: false,
  downloading: false,
  downloaded: false
};

function getAppVersion() {
  return app.getVersion();
}

function getFontsDir() {
  let fontsDir;

  if (app.isPackaged) {
    const exeDir = path.dirname(process.execPath);
    fontsDir = path.join(exeDir, "fonts");
  } else {
    fontsDir = path.join(__dirname, "fonts");
  }

  fs.mkdirSync(fontsDir, { recursive: true });
  return fontsDir;
}

function getDefaultDescriptionsFilePath() {
  return path.join(__dirname, "descriptions.default.json");
}

function getUserDescriptionsFilePath() {
  const baseDir = app.isPackaged
    ? app.getPath("userData")
    : path.join(app.getPath("userData"), "dev");

  fs.mkdirSync(baseDir, { recursive: true });
  return path.join(baseDir, "descriptions.user.json");
}

function loadJsonObject(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return {};
    }

    const raw = fs.readFileSync(filePath, "utf8").trim();
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }

    return {};
  } catch (err) {
    console.error(`Failed to read JSON file: ${filePath}`, err);
    return {};
  }
}

function saveJsonObject(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function getMergedDescriptions() {
  const defaults = loadJsonObject(getDefaultDescriptionsFilePath());
  const user = loadJsonObject(getUserDescriptionsFilePath());

  const merged = { ...defaults };

  for (const [key, value] of Object.entries(user)) {
    if (value === null || String(value).trim() === "") {
      delete merged[key];
    } else {
      merged[key] = String(value);
    }
  }

  return merged;
}

function sendToRenderer(channel, payload = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send(channel, payload);
}

function stripHtml(input) {
  return String(input || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<li>/gi, "• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .trim();
}

function normalizeReleaseNotes(releaseNotes) {
  if (!releaseNotes) return "";

  if (Array.isArray(releaseNotes)) {
    return releaseNotes
      .map((item) => {
        if (typeof item === "string") return stripHtml(item);
        if (item && typeof item.note === "string") return stripHtml(item.note);
        return "";
      })
      .filter(Boolean)
      .join("\n\n");
  }

  if (typeof releaseNotes === "object") {
    return stripHtml(releaseNotes.note || "");
  }

  return stripHtml(releaseNotes);
}

function showAboutDialog() {
  sendToRenderer("show-about-dialog", {
    title: "Star Wars Font Finder",
    subtitle: "by Rob Hopper",
    description:
      "Preview and compare Star Wars fonts in real time. Type any phrase and instantly see it across all loaded fonts.",
    version: getAppVersion()
  });
}

function showHowToDialog() {
  sendToRenderer("show-howto-dialog", {
    title: "How To Use Star Wars Font Finder",
    sections: [
      {
        heading: "Viewing Fonts",
        body:
          "Type a phrase in the top text box and every font in the list updates live. Use the size slider to resize all previews at once."
      },
      {
        heading: "Adding Fonts",
        body:
          "Use File > Open Fonts Folder, then drop supported font files into that folder. Click Reload Fonts to refresh the list."
      },
      {
        heading: "Descriptions",
        body:
          "Right-click a font row to add, change, or clear a description. Descriptions are saved locally and persist across updates."
      },
      {
        heading: "Installing Fonts",
        body:
          "For TTF and OTF fonts, click Install to install that font into Windows for the current user. WOFF and WOFF2 files are preview-only and cannot be installed as system fonts."
      }
    ]
  });
}

function createMenu() {
  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "Open Fonts Folder",
          click: () => {
            shell.openPath(getFontsDir());
          }
        },
        {
          label: "Keep On Top",
          type: "checkbox",
          checked: false,
          click: (menuItem) => {
            if (mainWindow) {
              mainWindow.setAlwaysOnTop(menuItem.checked);
            }
          }
        },
        { type: "separator" },
        {
          label: "Check for Updates",
          click: () => {
            checkForAppUpdates(true);
          }
        },
        { type: "separator" },
        {
          label: "Reload",
          accelerator: "CmdOrCtrl+R",
          click: () => {
            if (mainWindow) {
              mainWindow.reload();
            }
          }
        },
        { type: "separator" },
        {
          label: "Exit",
          role: "quit"
        }
      ]
    },
    {
      label: "Help",
      submenu: [
        {
          label: "How To",
          click: () => {
            showHowToDialog();
          }
        },
        {
          label: "About",
          click: () => {
            showAboutDialog();
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);

  const fileMenu = menu.items.find((item) => item.label === "File");
  if (fileMenu && fileMenu.submenu) {
    keepOnTopMenuItem = fileMenu.submenu.items.find(
      (item) => item.label === "Keep On Top"
    );
  }

  Menu.setApplicationMenu(menu);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 650,
    title: "Star Wars Font Finder",
    icon: path.join(__dirname, "SWFF_Icon.ico"),
    backgroundColor: "#0b1020",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));
  createMenu();

  mainWindow.webContents.once("did-finish-load", () => {
    sendToRenderer("app-version", { version: getAppVersion() });
    setTimeout(() => {
      checkForAppUpdates(false);
    }, 1500);
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function hasDevUpdaterConfig() {
  const devConfigPath = path.join(__dirname, "dev-app-update.yml");
  return fs.existsSync(devConfigPath);
}

function canRunAutoUpdater() {
  return app.isPackaged || hasDevUpdaterConfig();
}

function initAutoUpdater() {
  if (!canRunAutoUpdater()) {
    return;
  }

  if (!app.isPackaged) {
    autoUpdater.forceDevUpdateConfig = true;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;

  autoUpdater.on("checking-for-update", () => {
    updateState.checking = true;
    sendToRenderer("update-status", {
      state: "checking"
    });
  });

  autoUpdater.on("update-available", (info) => {
    updateState.checking = false;
    updateState.available = true;
    updateState.downloading = true;
    updateState.downloaded = false;

    sendToRenderer("update-available", {
      version: info?.version || "",
      releaseName: info?.releaseName || "",
      releaseNotes: normalizeReleaseNotes(info?.releaseNotes)
    });
  });

  autoUpdater.on("update-not-available", () => {
    updateState.checking = false;
    updateState.available = false;
    updateState.downloading = false;
    updateState.downloaded = false;

    sendToRenderer("update-status", {
      state: "not-available"
    });
  });

  autoUpdater.on("download-progress", (progressObj) => {
    updateState.downloading = true;

    sendToRenderer("update-download-progress", {
      percent: progressObj?.percent || 0,
      bytesPerSecond: progressObj?.bytesPerSecond || 0
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    updateState.downloading = false;
    updateState.downloaded = true;

    sendToRenderer("update-downloaded", {
      version: info?.version || ""
    });
  });

  autoUpdater.on("error", (err) => {
    updateState.checking = false;
    updateState.downloading = false;

    console.error("Auto updater error:", err);
    sendToRenderer("update-error", {
      message: err?.message || "Unknown updater error."
    });
  });
}

async function checkForAppUpdates(userInitiated = false) {
  if (!canRunAutoUpdater()) {
    if (userInitiated) {
      sendToRenderer("manual-update-check-result", {
        ok: false,
        message:
          "Updater is disabled in development unless dev-app-update.yml is present."
      });
    }
    return;
  }

  try {
    await autoUpdater.checkForUpdates();

    if (userInitiated) {
      sendToRenderer("manual-update-check-started", {
        ok: true
      });
    }
  } catch (err) {
    console.error("Update check failed:", err);

    if (userInitiated) {
      sendToRenderer("manual-update-check-result", {
        ok: false,
        message: err?.message || "Failed to check for updates."
      });
    }
  }
}

app.whenReady().then(() => {
  getFontsDir();
  initAutoUpdater();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("browser-window-focus", () => {
  if (mainWindow && keepOnTopMenuItem) {
    keepOnTopMenuItem.checked = mainWindow.isAlwaysOnTop();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.handle("get-fonts-dir", async () => {
  try {
    return {
      ok: true,
      fontsDir: getFontsDir()
    };
  } catch (err) {
    return {
      ok: false,
      message: err.message || "Failed to get fonts folder."
    };
  }
});

ipcMain.handle("download-update", async () => {
  try {
    await autoUpdater.downloadUpdate();
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      message: err.message || "Failed to download update."
    };
  }
});

ipcMain.handle("get-font-descriptions", async () => {
  try {
    return {
      ok: true,
      descriptions: getMergedDescriptions()
    };
  } catch (err) {
    return {
      ok: false,
      descriptions: {},
      message: err.message || "Failed to load descriptions."
    };
  }
});

ipcMain.handle("set-font-description", async (_event, payload) => {
  try {
    const { fontFile, description } = payload || {};

    if (!fontFile) {
      return {
        ok: false,
        message: "Missing font file."
      };
    }

    const userFile = getUserDescriptionsFilePath();
    const userDescriptions = loadJsonObject(userFile);
    const cleanDescription = String(description || "").trim();

    if (cleanDescription) {
      userDescriptions[fontFile] = cleanDescription;
    } else {
      userDescriptions[fontFile] = null;
    }

    saveJsonObject(userFile, userDescriptions);

    return {
      ok: true,
      descriptions: getMergedDescriptions()
    };
  } catch (err) {
    return {
      ok: false,
      message: err.message || "Failed to save description."
    };
  }
});

ipcMain.handle("install-downloaded-update", async () => {
  try {
    if (!canRunAutoUpdater()) {
      return {
        ok: false,
        message: "Updater is not active in this build."
      };
    }

    setImmediate(() => {
      autoUpdater.quitAndInstall(false, true);
    });

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      message: err.message || "Failed to install update."
    };
  }
});

ipcMain.handle("check-for-updates-now", async () => {
  try {
    await checkForAppUpdates(true);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      message: err.message || "Failed to start update check."
    };
  }
});

ipcMain.handle("is-font-installed", async (_event, payload) => {
  try {
    if (process.platform !== "win32") {
      return { ok: true, installed: false };
    }

    const { fontPath, displayName } = payload || {};

    if (!fontPath) {
      return { ok: false, installed: false, message: "Missing font path." };
    }

    const fileName = path.basename(fontPath);

    const userFontsDir = path.join(
      process.env.LOCALAPPDATA || "",
      "Microsoft",
      "Windows",
      "Fonts"
    );

    const systemFontsDir = path.join(
      process.env.WINDIR || "C:\\Windows",
      "Fonts"
    );

    const userFontPath = path.join(userFontsDir, fileName);
    const systemFontPath = path.join(systemFontsDir, fileName);

    if (fs.existsSync(userFontPath) || fs.existsSync(systemFontPath)) {
      return { ok: true, installed: true };
    }

    const registryInstalled = await checkFontInstalledInRegistry(
      displayName,
      fileName
    );

    return { ok: true, installed: registryInstalled };
  } catch (err) {
    return {
      ok: false,
      installed: false,
      message: err.message || "Failed to check install status."
    };
  }
});

ipcMain.handle("install-font", async (_event, payload) => {
  try {
    if (process.platform !== "win32") {
      return {
        ok: false,
        message: "Font install is currently implemented for Windows only."
      };
    }

    const { fontPath, displayName } = payload || {};

    if (!fontPath || !displayName) {
      return {
        ok: false,
        message: "Missing font path or display name."
      };
    }

    const ext = path.extname(fontPath).toLowerCase();
    if (![".ttf", ".otf"].includes(ext)) {
      return {
        ok: false,
        message: "Only TTF and OTF fonts can be installed to Windows."
      };
    }

    const alreadyInstalled = await ipcMainCheckInstalled(fontPath, displayName);
    if (alreadyInstalled) {
      return {
        ok: true,
        alreadyInstalled: true,
        message: `"${displayName}" is already installed.`
      };
    }

    const psScript = `
param(
  [Parameter(Mandatory = $true)]
  [string]$FontPath,

  [Parameter(Mandatory = $true)]
  [string]$DisplayName
)

$ErrorActionPreference = 'Stop'

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class FontUtil {
  [DllImport("gdi32.dll", CharSet = CharSet.Unicode)]
  public static extern int AddFontResourceW(string lpFileName);

  [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
  public static extern IntPtr SendMessageTimeout(
    IntPtr hWnd,
    uint Msg,
    UIntPtr wParam,
    string lParam,
    uint fuFlags,
    uint uTimeout,
    out UIntPtr lpdwResult
  );
}
"@

$ext = [System.IO.Path]::GetExtension($FontPath).ToLowerInvariant()
if ($ext -ne '.ttf' -and $ext -ne '.otf') {
  throw 'Only TTF and OTF fonts can be installed.'
}

if (-not (Test-Path -LiteralPath $FontPath)) {
  throw 'Font file not found.'
}

$fontsDir = Join-Path $env:LOCALAPPDATA 'Microsoft\\Windows\\Fonts'
New-Item -ItemType Directory -Path $fontsDir -Force | Out-Null

$fileName = [System.IO.Path]::GetFileName($FontPath)
$destPath = Join-Path $fontsDir $fileName

Copy-Item -LiteralPath $FontPath -Destination $destPath -Force

$typeLabel = if ($ext -eq '.otf') { ' (OpenType)' } else { ' (TrueType)' }

$regPath = 'HKCU:\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Fonts'
New-Item -Path $regPath -Force | Out-Null
New-ItemProperty -Path $regPath -Name ($DisplayName + $typeLabel) -Value $fileName -PropertyType String -Force | Out-Null

[void][FontUtil]::AddFontResourceW($destPath)

$HWND_BROADCAST = [IntPtr]0xffff
$WM_FONTCHANGE = 0x001D
$SMTO_ABORTIFHUNG = 0x0002
$result = [UIntPtr]::Zero
[void][FontUtil]::SendMessageTimeout($HWND_BROADCAST, $WM_FONTCHANGE, [UIntPtr]::Zero, $null, $SMTO_ABORTIFHUNG, 1000, [ref]$result)

Write-Output 'OK'
`;

    const result = await runPowerShellFile(psScript, [
      "-FontPath",
      fontPath,
      "-DisplayName",
      displayName
    ]);

    if (!result.ok) {
      return result;
    }

    return {
      ok: true,
      message: `"${displayName}" installed for the current Windows user.`
    };
  } catch (err) {
    return {
      ok: false,
      message: err.message || "Failed to install font."
    };
  }
});

async function ipcMainCheckInstalled(fontPath, displayName) {
  const fileName = path.basename(fontPath);

  const userFontsDir = path.join(
    process.env.LOCALAPPDATA || "",
    "Microsoft",
    "Windows",
    "Fonts"
  );

  const systemFontsDir = path.join(
    process.env.WINDIR || "C:\\Windows",
    "Fonts"
  );

  const userFontPath = path.join(userFontsDir, fileName);
  const systemFontPath = path.join(systemFontsDir, fileName);

  if (fs.existsSync(userFontPath) || fs.existsSync(systemFontPath)) {
    return true;
  }

  return await checkFontInstalledInRegistry(displayName, fileName);
}

function checkFontInstalledInRegistry(displayName, fileName) {
  return new Promise((resolve) => {
    const psScript = `
param(
  [string]$DisplayName,
  [string]$FileName
)

$paths = @(
  'HKCU:\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Fonts',
  'HKLM:\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Fonts'
)

foreach ($regPath in $paths) {
  if (Test-Path $regPath) {
    $props = Get-ItemProperty -Path $regPath
    foreach ($p in $props.PSObject.Properties) {
      $name = [string]$p.Name
      $value = [string]$p.Value

      if ($value -and $value.ToLowerInvariant() -eq $FileName.ToLowerInvariant()) {
        Write-Output 'TRUE'
        exit 0
      }

      if ($DisplayName -and $name -like "$DisplayName*") {
        Write-Output 'TRUE'
        exit 0
      }
    }
  }
}

Write-Output 'FALSE'
`;

    runPowerShellFile(psScript, [
      "-DisplayName",
      displayName || "",
      "-FileName",
      fileName || ""
    ]).then((result) => {
      if (!result.ok) {
        resolve(false);
        return;
      }

      resolve(result.message.trim().toUpperCase() === "TRUE");
    });
  });
}

function runPowerShellFile(scriptContents, args = []) {
  return new Promise((resolve) => {
    const tempFile = path.join(
      os.tmpdir(),
      `sw-font-finder-${Date.now()}-${Math.random().toString(16).slice(2)}.ps1`
    );

    fs.writeFile(tempFile, scriptContents, "utf8", (writeErr) => {
      if (writeErr) {
        resolve({
          ok: false,
          message:
            writeErr.message || "Could not create temporary PowerShell file."
        });
        return;
      }

      const psArgs = [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        tempFile,
        ...args
      ];

      execFile(
        "powershell.exe",
        psArgs,
        { windowsHide: true },
        (error, stdout, stderr) => {
          fs.unlink(tempFile, () => {});

          if (error) {
            resolve({
              ok: false,
              message: (
                stderr ||
                stdout ||
                error.message ||
                "PowerShell operation failed."
              ).trim()
            });
            return;
          }

          resolve({
            ok: true,
            message: (stdout || "OK").trim()
          });
        }
      );
    });
  });
}