# Agnome Extension — Architecture

## Overview

Agnome is a GNOME Shell extension (UUID: `agnome@zam`) that lets users open
project folders in a terminal running `agy <path>`. It sits in the top panel
and tracks recently opened projects with the ability to close their terminals.

The extension also:
- Shows the active project folder name next to the panel icon when its
  terminal window is focused
- Auto-removes projects from the recent list when the terminal is closed
  by any means (window close button, Ctrl+C, force-kill)
- Allows configuring panel position (left/center/right + order index)
  and label position (left/right of icon) via preferences

Inspired by the Pixeldrain Uploader extension (`pixeldrain-uploader@zam`).

---

## File Structure

```
agnome/
├── extension.js                  # Main extension: PanelMenu.Button + logic
├── prefs.js                      # Preferences window (Adw + Gtk4)
├── metadata.json                 # UUID, shell-version range, schema ref
├── stylesheet.css                # Panel menu card & button styles
├── schemas/
│   ├── org.gnome.shell.extensions.agnome.gschema.xml  # GSettings schema
│   └── gschemas.compiled                               # Compiled schema binary
├── helpers/
│   └── pick-folder.js            # GJS helper — Gtk folder chooser dialog
├── icons/
│   └── agnome-symbolic.svg       # Panel icon
├── docs/
│   └── ARCHITECTURE.md           # This file
└── README.md                     # User-facing README
```

---

## Key Dependencies

| Dep | Path | Purpose |
|-----|------|---------|
| `kgx` | `/usr/bin/kgx` | GNOME Console terminal emulator — launches `agy` in a new window |
| `agy` | `/home/zam/.local/bin/agy` | The CLI tool that runs inside the terminal |
| `gjs` | `/usr/bin/gjs` | JavaScript runtime for the GJS helper subprocess |

---

## How It Works

### 1. Panel Button (`extension.js`)

- Class `AgnomeButton` extends `PanelMenu.Button`
- Displays an icon + optional active-label (folder name) in the top panel
- **Left-click:** closes menu (if open) and directly opens the folder picker
- **Right-click / middle-click:** opens the dropdown menu

### 2. Dropdown Menu

```
┌─────────────────────────────┐
│ 🔓 Open Project             │  ← PopupImageMenuItem
│─────────────────────────────│
│ ┌─────────────────────────┐ │
│ │ project-folder    [✕]  │ │  ← recent projects (max 10)
│ │ project-folder    [✕]  │ │
│ │ ...                    │ │
│ └─────────────────────────┘ │
│─────────────────────────────│
│ ⚙ Open settings             │  ← opens extension prefs
└─────────────────────────────┘
```

### 3. Folder Picker Flow

```
User clicks Open Project
        │
        ▼
extension.js: _openPicker()
        │
        ▼
_runJsonHelper('helpers/pick-folder.js', callback)
        │
        ▼
Gio.Subprocess: gjs -m helpers/pick-folder.js
        │
        ▼
pick-folder.js opens Gtk.FileChooserNative
(action: SELECT_FOLDER, modal: true)
        │
        ▼
User selects folder → stdout: JSON.stringify([path])
        │
        ▼
extension.js parses JSON → callback(paths)
        │
        ▼
_openProject(path)
```

### 4. Opening a Project

```js
_openProject(path) {
    const name = GLib.path_get_basename(path);
    const q = path.replace(/'/g, "'\\''");

    // Launch kgx terminal with agy
    const proc = Gio.Subprocess.new([
        '/usr/bin/kgx',
        '--working-directory', path,
        '--',
        'bash', '-c', `cd '${q}' && exec agy '${q}'`,
    ], Gio.SubprocessFlags.NONE);

    // Store proc reference for kill later
    this._activeTerminals[path] = proc;

    // Track PID → project mapping for active-window detection
    const pid = typeof proc.get_pid === 'function' ? proc.get_pid() : proc.pid;
    if (pid != null) {
        this._pidToProject[pid] = {name, path};
        this._pathToPid[path] = pid;
    }

    // Auto-cleanup when the terminal exits by any means
    proc.wait_async(null, () => {
        if (!this._activeTerminals[path]) return;
        this._cleanupPid(path);
        delete this._activeTerminals[path];
        this._projects = this._projects.filter(p => p.path !== path);
        this._settings.set_string('recent-projects', JSON.stringify(this._projects));
        this._renderProjects();
        this._updateActiveLabel();
    });

    // Add to recent list (deduped, max 10)
    this._projects = [{name, path, openedAt: new Date().toISOString()},
        ...this._projects.filter(p => p.path !== path)
    ].slice(0, 10);
    this._settings.set_string('recent-projects', JSON.stringify(this._projects));
}
```

### 5. Active Window Tracking

The extension monitors GNOME Shell's focus-window signal and matches the
focused window's PID against the tracked project PIDs:

```
global.display.connect('notify::focus-window', () => this._updateActiveLabel());
```

```js
_updateActiveLabel() {
    const focused = global.display.focus_window;
    if (!focused) { this._activeLabel.hide(); return; }

    const pid = focused.get_pid();
    const project = this._pidToProject[pid];

    if (project) {
        this._activeLabel.text = project.name;
        this._activeLabel.show();
    } else {
        this._activeLabel.hide();
    }
}
```

The label position (left or right of the icon) is controlled by the
`active-label-position` setting.

### 6. Closing a Project (X button)

```js
_closeProject(path) {
    this._cleanupPid(path);

    const proc = this._activeTerminals[path];
    if (proc) {
        try {
            proc.force_exit();      // kill kgx process → closes terminal
        } catch (_error) {
            // process may already be gone
        }
        delete this._activeTerminals[path];
    }
    // Remove from persistent list
    this._projects = this._projects.filter(p => p.path !== path);
    this._settings.set_string('recent-projects', JSON.stringify(this._projects));
    this._renderProjects();
    this._updateActiveLabel();
}
```

> The `wait_async` callback (set in `_openProject`) also fires after
> `force_exit()`, but the guard clause (`if (!this._activeTerminals[path])`)
> prevents double-removal since `_closeProject` already deleted the entry.

### 7. Panel Position

The extension can be positioned in any panel area at any order:

```js
_reposition() {
    const box = this._settings.get_string('panel-position') || 'right';
    const order = this._settings.get_int('panel-order') || 0;

    const parent = this.get_parent();
    if (parent) {
        parent.remove_child(this);
        parent.destroy();           // destroy empty PanelBox so it doesn't linger
    }

    delete Main.panel._statusArea['agnome'];

    Main.panel.addToStatusArea('agnome', this, order, box);
}
```

Called automatically when `panel-position` or `panel-order` settings change.

### 8. Preferences (`prefs.js`)

Three preference groups:

1. **Agnome** — info row + Clear recent projects button
2. **Active Window Label** — combo row for label position (left/right)
3. **Panel Position** — combo row for area (left/center/right) + spin button for order (-10 to 10)

### 9. GSettings Schema

- **Schema ID:** `org.gnome.shell.extensions.agnome`
- **Path:** `/org/gnome/shell/extensions/agnome/`

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `recent-projects` | `s` | `'[]'` | JSON array of `{ name, path, openedAt }` |
| `active-label-position` | `s` | `'right'` | Label relative to icon: `'left'` or `'right'` |
| `panel-position` | `s` | `'right'` | Panel area: `'left'`, `'center'`, or `'right'` |
| `panel-order` | `i` | `0` | Order index within panel area (-10 to 10) |

---

## Data Flow

```
User action
    │
    ▼
GNOME Shell event (button-press, menu activate, focus-window)
    │
    ▼
AgnomeButton methods (_openPicker, _openProject, _closeProject,
                      _updateActiveLabel, _reposition)
    │
    ├── Gio.Subprocess → kgx terminal (async, no pipe)
    ├── Gio.Subprocess → gjs helper (async, stdout pipe)
    ├── GSettings read/write (recent-projects, panel-*, active-label-*)
    ├── St UI updates (_renderProjects, _applyLabelPosition)
    └── global.display focus tracking (PID matching)
```

---

## In-Memory State

| Field | Type | Purpose |
|-------|------|---------|
| `_activeTerminals` | `{ [path: string]: Gio.Subprocess }` | Tracks running kgx processes; not persisted |
| `_pidToProject` | `{ [pid: number]: { name, path } }` | PID → project mapping for focus tracking |
| `_pathToPid` | `{ [path: string]: number }` | Reverse lookup for cleanup |
| `_projects` | `Array<{ name, path, openedAt }>` | Persisted in GSettings, synced via `changed::recent-projects` |
| `_focusSignalId` | number | Signal connection ID for `notify::focus-window` |

On extension `disable()`/`destroy()`:
- All tracked terminals are killed (`force_exit`)
- The focus-signal is disconnected
- GSettings signal connections are cleaned up

---

## Styling

All custom CSS classes are prefixed with `agnome-`:

| Class | Purpose |
|-------|---------|
| `.agnome-projects-card` | Card container for project list |
| `.agnome-project-row` | Each project row (folder + X) |
| `.agnome-folder-name` | Folder name label (system font, no custom size) |
| `.agnome-close-button` | X close button (circular hover background) |
| `.agnome-empty-state` | "No projects yet" placeholder |

The close button icon uses `window-close-symbolic` from the default icon theme
at 18px (~2px larger than default popup-menu-icon).

---

## Build & Install

### First time
```bash
# Compile GSettings schema
glib-compile-schemas schemas/

# Copy to GNOME extensions directory
cp -r /home/zam/Projects/agnome ~/.local/share/gnome-shell/extensions/agnome@zam

# Logout & login (Wayland), or Alt+F2 → r (X11)

# Enable extension
gnome-extensions enable agnome@zam
```

### Development loop
```bash
# After code changes:
cp -r /home/zam/Projects/agnome ~/.local/share/gnome-shell/extensions/agnome@zam

# Reload extension (if already enabled):
gnome-extensions reset agnome@zam   # disables & enables
# Or:
gdbus call --session \
  --dest org.gnome.Shell \
  --object-path /org/gnome/Shell \
  --method org.gnome.Shell.Extensions.ReloadExtension \
  'agnome@zam'
```

---

## Known Limitations

1. **Terminal detection after restart:** After shell restart, previously opened
   terminals are no longer tracked (PID-to-window mappings are lost). Their
   entries remain in recent-projects but the X button will only remove the
   list entry (no process to kill).

2. **Only kgx:** Terminal emulator is hardcoded to `/usr/bin/kgx`
   (GNOME Console). No fallback or config option yet.

3. **Single-quote paths:** While special characters in paths are handled,
   paths containing single quotes (`'`) use basic escaping.

4. **No drag-and-drop:** Unlike Pixeldrain, this extension only supports the
   folder picker dialog — no drag-and-drop onto the panel icon.

5. **Wayland PID matching:** On Wayland, window PID detection depends on the
   compositor assigning the correct PID to each surface. This should work for
   kgx but may not work for all terminal emulators.

### Fixed Bugs

1. **PID retrieval crash:** Some GJS/GIO versions expose `proc.pid` as a
   property instead of `proc.get_pid()` as a method. Calling `proc.get_pid()`
   threw `TypeError: proc.get_pid is not a function`, halting the entire
   `_openProject` method after the terminal already launched. The project was
   never added to the recent list nor persisted to settings.

   **Fix (extension.js:222):** Use `typeof proc.get_pid === 'function'` to
   detect the available API, falling back to `proc.pid`. Surround PID tracking
   with a null guard so the rest of the method always executes.

2. **Reposition orphaned PanelBox:** Changing `panel-position` or `panel-order`
   in preferences called `_reposition()`, which removed the button from its
   parent `PanelBox` but left the empty `PanelBox` container in the panel
   layout. The new `PanelBox` created by `addToStatusArea()` conflicted,
   causing the icon to disappear until the extension was disabled/re-enabled.

   **Fix (extension.js:286):** Destroy the old `PanelBox` with
   `parent.destroy()` after removing the button child.

---

## Future Ideas

- Configurable terminal emulator (kgx, gnome-terminal, ptyxis, etc.)
- Drag-and-drop folder onto panel icon
- Remember window positions of opened terminals
- Per-project settings
