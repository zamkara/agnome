# 🛠️ Agnome GNOME Extension

[![GNOME Shell](https://img.shields.io/badge/GNOME-46%20--%2050-blue?logo=gnome&logoColor=white&style=flat-square)](https://extensions.gnome.org)
[![License: GPL v3](https://img.shields.io/badge/License-GPL_v3-red.svg?style=flat-square)](https://www.gnu.org/licenses/gpl-3.0)
[![Release](https://img.shields.io/github/v/release/zamkara/agnome?style=flat-square&color=emerald)](https://github.com/zamkara/agnome/releases)

<img width="867" height="394" alt="image" src="https://github.com/user-attachments/assets/4272f53c-97d3-486f-bcd8-670540a06e2c" />


A sleek, lightweight, and modern GNOME Shell extension that makes managing and launching your workspace directories exceptionally effortless. Directly launch project directories with **Antigravity CLI (`agy`)** in your terminal right from the top panel, with seamless active project tracking.

---

## ✨ Features

- **⚡ Instant Workspace Launcher**: Click the panel icon to select a folder via a native GTK folder picker, instantly opening a GNOME Console (`kgx`) window inside that folder running your `agy` (Antigravity CLI) command.
- **🔍 Active Project Labeling**: Displays the folder name of your currently active project in the top panel in real-time when its terminal window is focused.
- **🔄 Dynamic Customization (Preferences)**:
  - **Panel Area**: Seamlessly sit the indicator on the `Left`, `Center`, or `Right` side of your top panel with custom ordering.
  - **Label Alignment**: Choose to position the active folder name to the `Left` or `Right` of the symbolic panel icon.
- **🛡️ Secure & Lightweight**:
  - Native ESM syntax strictly compliant with GNOME 45+ standards.
  - Dynamic binary path discovery (`GLib.find_program_in_path`) avoiding dangerous hardcoded absolute paths.
  - Perfect resource lifecycle management—absolutely no memory leaks or dangling signal listeners.

---

## 📋 Prerequisites

To run this extension, ensure you have the following installed on your system:
1. **GNOME Shell**: Versions `46` through `50`.
2. **GNOME Console (`kgx`)**: The default modern terminal for GNOME.
3. **Antigravity CLI (`agy`)**: Ensure the `agy` executable is installed and available in your environment `PATH`.

---

## 🚀 Installation

### Option 1: Manual Installation (From Source)

1. Clone the repository directly to your GNOME Shell extensions directory:
   ```bash
   git clone https://github.com/zamkara/agnome.git ~/.local/share/gnome-shell/extensions/agnome@zam
   ```

2. Compile the settings schema:
   ```bash
   glib-compile-schemas ~/.local/share/gnome-shell/extensions/agnome@zam/schemas/
   ```

3. Enable the extension:
   - On **Wayland**: Log out and log back in to refresh GNOME Shell. Then enable via the Extensions app or command line:
     ```bash
     gnome-extensions enable agnome@zam
     ```
   - On **X11**: Press `Alt + F2`, type `r`, and press `Enter` to restart GNOME Shell. Then enable the extension.

### Option 2: Using the Packaged Release

1. Go to the [Releases](https://github.com/zamkara/agnome/releases) page and download the latest `.zip` file.
2. Install it via the command line:
   ```bash
   gnome-extensions install agnome-*.zip
   ```
3. Restart GNOME Shell (or log out/in on Wayland) and enable the extension.

---

## 🛠️ Development & Packaging

To package the extension yourself for publication or manual sharing:

1. Make the packaging script executable:
   ```bash
   chmod +x package.sh
   ```
2. Build the extension bundle:
   ```bash
   ./package.sh
   ```
   This will create a `build/` directory containing the distribution-ready `.zip` file.

---

## 📄 License

This extension is open-source software licensed under the **GNU GPL v3.0 or later** license. See the [LICENSE](LICENSE) file for more information.
