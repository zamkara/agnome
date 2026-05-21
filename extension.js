import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

const KGX_PATH = GLib.find_program_in_path('kgx') ||
                 GLib.find_program_in_path('gnome-console') ||
                 '/usr/bin/kgx';
const PICKER_SCRIPT = 'helpers/pick-folder.js';

const KGX_WM_CLASSES = [
    'org.gnome.console',
    'gnome-console',
    'console',
    'kgx',
];

function isKgxWindow(win) {
    const wmClass = (win.get_wm_class() || '').toLowerCase();
    const gtkAppId = win.get_gtk_application_id() ? win.get_gtk_application_id().toLowerCase() : '';
    const title = (win.get_title() || '').toLowerCase();
    return KGX_WM_CLASSES.includes(wmClass) || 
           KGX_WM_CLASSES.includes(gtkAppId) || 
           wmClass.includes('console') || 
           wmClass.includes('kgx') ||
           gtkAppId.includes('console') ||
           gtkAppId.includes('kgx') ||
           title.includes('console') ||
           title.includes('kgx');
}

const AgnomeButton = GObject.registerClass(
class AgnomeButton extends PanelMenu.Button {
    _init(extension) {
        super._init(0.0, 'Agnome', true);

        this._extension = extension;
        this._settings = extension.getSettings();
        this._windowToProject = new Map();
        this._trackedWindows = new Set();

        this._buttonContent = new St.BoxLayout();

        this._icon = new St.Icon({
            gicon: Gio.icon_new_for_string(`${this._extension.path}/icons/agnome-symbolic.svg`),
            style_class: 'system-status-icon',
        });

        this._activeLabel = new St.Label({
            text: '',
            y_align: Clutter.ActorAlign.CENTER,
            visible: false,
        });

        this._buttonContent.add_child(this._icon);
        this._buttonContent.add_child(this._activeLabel);
        this.add_child(this._buttonContent);

        this._applyLabelPosition();

        this._settings.connectObject(
            'changed::active-label-position', () => this._applyLabelPosition(),
            this
        );

        this._focusSignalId = global.display.connect('notify::focus-window',
            () => this._updateActiveLabel());
        this._windowCreatedId = global.display.connect('window-created',
            (d, w) => this._onWindowCreated(w));

        this._restoreTracking();
        this._updateActiveLabel();
    }

    vfunc_event(event) {
        if (event.type() === Clutter.EventType.BUTTON_PRESS) {
            const button = event.get_button();
            if (button === 1 || button === 3)
                return Clutter.EVENT_STOP;
        } else if (event.type() === Clutter.EventType.BUTTON_RELEASE) {
            const button = event.get_button();
            if (button === 1) {
                this._openPicker();
                return Clutter.EVENT_STOP;
            } else if (button === 3) {
                this._extension.openPreferences();
                return Clutter.EVENT_STOP;
            }
        }
        return super.vfunc_event(event);
    }

    _openProject(path) {
        const name = GLib.path_get_basename(path);
        const q = path.replace(/'/g, "'\\''");

        Gio.Subprocess.new(
            [
                KGX_PATH,
                '--working-directory', path,
                '--',
                'bash', '-c',
                `echo -ne "\\033]0;agnome-project:${q}\\007" && exec agy '${q}'`,
            ],
            Gio.SubprocessFlags.NONE
        );
    }

    _onWindowCreated(win) {
        if (!isKgxWindow(win)) return;

        if (!this._trackedWindows.has(win)) {
            this._trackedWindows.add(win);
            win.connectObject(
                'notify::title', () => this._checkAndTrackWindow(win),
                'unmanaged', () => {
                    this._trackedWindows.delete(win);
                    this._onWindowDestroyed(win);
                },
                this
            );
        }

        this._checkAndTrackWindow(win);
    }

    _checkAndTrackWindow(win) {
        const title = win.get_title() || '';
        if (title.includes('agnome-project:')) {
            const path = title.split('agnome-project:')[1].trim();
            const name = GLib.path_get_basename(path);

            if (!this._windowToProject.has(win)) {
                this._windowToProject.set(win, {name, path});
                this._updateActiveLabel();
            }
        }
    }

    _onWindowDestroyed(win) {
        const project = this._windowToProject.get(win);
        if (!project) return;

        this._windowToProject.delete(win);
        this._updateActiveLabel();
    }

    _restoreTracking() {
        try {
            const actors = global.get_window_actors();
            for (const actor of actors) {
                const win = actor.get_meta_window();
                if (!win) continue;
                if (!isKgxWindow(win)) continue;

                this._onWindowCreated(win);
            }
        } catch {
            // Silently fail if global.get_window_actors is unavailable
        }
    }

    _updateActiveLabel() {
        let focused;
        try {
            focused = global.display.focus_window;
            if (!focused) {
                this._activeLabel.hide();
                return;
            }
        } catch {
            this._activeLabel.hide();
            return;
        }

        const project = this._windowToProject.get(focused);
        if (project) {
            this._activeLabel.text = project.name;
            this._activeLabel.show();
            return;
        }

        const title = focused.get_title() || '';
        if (title.includes('agnome-project:')) {
            const path = title.split('agnome-project:')[1].trim();
            const name = GLib.path_get_basename(path);
            this._activeLabel.text = name;
            this._activeLabel.show();
            return;
        }

        this._activeLabel.hide();
    }

    _applyLabelPosition() {
        const position = this._settings.get_string('active-label-position') || 'right';

        this._buttonContent.remove_all_children();

        if (position === 'left') {
            this._buttonContent.add_child(this._activeLabel);
            this._buttonContent.add_child(this._icon);
        } else {
            this._buttonContent.add_child(this._icon);
            this._buttonContent.add_child(this._activeLabel);
        }
    }

    _runJsonHelper(helperName, callback) {
        const gjsPath = GLib.find_program_in_path('gjs') || '/usr/bin/gjs';
        const helperPath = `${this._extension.path}/${helperName}`;
        const proc = Gio.Subprocess.new(
            [gjsPath, '-m', helperPath],
            Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
        );

        proc.communicate_utf8_async(null, null, (_proc, result) => {
            try {
                const [, stdout, stderr] = proc.communicate_utf8_finish(result);
                if (!proc.get_successful()) {
                    Main.notify('Agnome', (stderr || 'Helper process failed').trim());
                    return;
                }

                const paths = JSON.parse((stdout || '[]').trim() || '[]');
                if (Array.isArray(paths) && paths.length > 0)
                    callback(paths);
            } catch (error) {
                Main.notify('Agnome', `Failed to read helper output: ${error.message}`);
            }
        });
    }

    _openPicker() {
        this._runJsonHelper(PICKER_SCRIPT, paths => {
            const path = paths[0];
            if (path && typeof path === 'string' && path.length > 0)
                this._openProject(path);
        });
    }

    destroy() {
        if (this._focusSignalId) {
            global.display.disconnect(this._focusSignalId);
            this._focusSignalId = null;
        }
        if (this._windowCreatedId) {
            global.display.disconnect(this._windowCreatedId);
            this._windowCreatedId = null;
        }

        if (this._trackedWindows) {
            for (const win of this._trackedWindows) {
                try {
                    win.disconnectObject(this);
                } catch {}
            }
            this._trackedWindows.clear();
        }

        if (this._windowToProject) {
            this._windowToProject.clear();
        }
        this._settings.disconnectObject(this);
        super.destroy();
    }
});

export default class AgnomeExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._button = null;

        this._settings.connectObject(
            'changed::panel-position', () => this._recreateButton(),
            'changed::panel-order', () => this._recreateButton(),
            this
        );

        this._recreateButton();
    }

    disable() {
        this._settings.disconnectObject(this);
        this._button?.destroy();
        this._button = null;
    }

    _recreateButton() {
        if (this._button) {
            this._button.destroy();
            this._button = null;
        }

        const box = this._settings.get_string('panel-position') || 'right';
        const order = this._settings.get_int('panel-order') || 0;

        this._button = new AgnomeButton(this);
        Main.panel.addToStatusArea('agnome', this._button, order, box);
    }
}
