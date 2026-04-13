

# Star Wars Font Finder

<p align="center">
  <img src="https://github.com/user-attachments/assets/81860f6f-0f78-4193-9ae9-0b7f857b38cd" width="500" />
</p>



Are you like me and hate having to scour the internet for a Star Wars font when you need it for a project? Have no fear, this app comes packed with nearly 100 different Star Wars fonts for your needs!

**Star Wars Font Finder (SWFF)** is a desktop Electron app for browsing, previewing, and installing Star Wars themed fonts from a local external `fonts` folder.

It was built to make it easy to test phrases across a full font collection in real time without manually installing every font first. Whether you are making props, decals, posters, UI mockups, labels, or Star Wars inspired projects, the app gives you a fast way to see how a phrase looks across many fonts at once.

---

## What the App Does

Star Wars Font Finder scans a local `fonts` folder (included with the install) and displays every supported font it finds in a clean preview list.

For each font, the app can show:

- the font's display name
- a saved description
- a live preview of your current phrase
- whether the font is already installed
- an install button for supported Windows font types

The app also supports built-in descriptions that ship with the app, while still allowing users to edit or add their own descriptions without losing them during future updates.

<p align="center">
  <img src="https://github.com/user-attachments/assets/20317924-ae8c-43bb-972f-3fc93e21e412" width="800" />
</p>

---

## Main Features

- Scans a local external `fonts` folder (Installed with the app - not your Windows fonts folder)
- Live preview of all fonts using a custom phrase
- Font descriptions
- User descriptions are preserved across updates
- Per-font install button on Windows
- GitHub Releases auto-update support

---

## Supported Font Types

The app can preview:

- `.ttf`
- `.otf`
- `.woff`
- `.woff2`

The app can install to Windows:

- `.ttf`
- `.otf`

`WOFF` and `WOFF2` are preview-only and cannot be installed as system fonts through the app. Best to stick with .ttf/.otf formats.

---

## How It Works

When the app starts, it scans the included `fonts` folder and reads all supported font files.

It then displays them in a list using:

- Font name
- Any saved description
- Your current preview phrase

Descriptions come from two sources:

1. **Default descriptions** bundled with the app
2. **User descriptions** stored separately so they survive updates
User-defined descriptions are useful if you need to add a note, e.g. "Use this for bot 3D Print".

This means future app releases can add built-in descriptions for new fonts without wiping out user changes to existing ones.

---

## Downloading/Installing the App

Download the latest Windows installer from the GitHub **Releases** page.

---
## Using the App

### Previewing fonts

Type any phrase into the phrase box at the top of the app. Every font preview updates immediately.

Use the size slider to change the preview size for all fonts at once.

*Note: Some fonts only include letters, and won't properly display numericals, and vice-versa*

### Editing descriptions

Right-click any font entry to add or edit its description.

Descriptions are saved automatically when you click **Save**.

### Installing fonts

For `.ttf` and `.otf` fonts on Windows, click **Install** to install that font for the current user.

If a font is already installed, the button will show **Installed**.

### Reloading fonts

If you add more files to the `fonts` folder while the app is running, click **Reload Fonts**.

### Adding your own fonts
If you come across a star wars font you like and want to add it to the app
- Click **File** > **Open Fonts Folder**
You can drop your .ttf/.otf files in here. Be sure to click the **Reload Fonts** button to refresh the fonts list.

If there is a font you'd like to have added to the app itself so that all users receive it in future updates, submit an **[Issue](https://github.com/RHopper85/SWFF/issues)**. Please mark it with the label **"Request to Add A Font"**.


---


## Development


### Source Code

This repository is open source for transparency.  
Most users should download the prebuilt releases.  
Build instructions are not officially supported, but for anyone brave enough to tinker with the app, here is what you need to run and build it yourself.


#### What you need

- **Node.js**
- **npm**
- **Windows** is recommended for full testing since font install and packaged updater behavior are Windows-focused

_Notes for development:_

- descriptions.default.json contains the built-in default descriptions that ship with the app

- User-created descriptions are stored separately so they survive updates
- The app reads fonts from its included external fonts folder
- Auto-update behavior should be tested with the installed build, not just npm start

## Bug Reporting
### How to report a bug
If you notice a bug or repeatable weird glitch in the app, please post an Issue on the **[Issues](https://github.com/RHopper85/SWFF/issues)** page so that I can get to the bottom of it. 
---
## Credit where credit is due
Most of the fonts and descriptions were found on <a href="https://aurekfonts.github.io/">AurekFonts</a>. <br>I will add more as I discover them. I won't add any fonts that require a license because, well, that's illegal :)
---
<p align="center">
  <b>If you like the app and want to help me keep doing what I love,</b><br><br>
  <a href="https://ko-fi.com/hop9285">
    <img src="https://github.com/RHopper85/SWFF/blob/main/ko-fi.png" width="400" />
  </a>
<br><b>May the Font be with you</b>
</p>

