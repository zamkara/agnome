#!/usr/bin/gjs -m

import Gtk from 'gi://Gtk?version=4.0';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

Gtk.init();
const loop = GLib.MainLoop.new(null, false);

const chooser = new Gtk.FileChooserNative({
    title: 'Select a project folder',
    action: Gtk.FileChooserAction.SELECT_FOLDER,
    modal: true,
});

chooser.connect('response', (dialog, response) => {
    let path = null;
    if (response === Gtk.ResponseType.ACCEPT) {
        const file = dialog.get_file();
        if (file instanceof Gio.File)
            path = file.get_path();
    }
    dialog.destroy();
    print(JSON.stringify(path ? [path] : []));
    loop.quit();
});

chooser.show();
loop.run();
