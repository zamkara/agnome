import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk?version=4.0';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class AgnomePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage();

        const labelGroup = new Adw.PreferencesGroup({
            title: 'Active Window Label',
            description: 'Show the active project folder name next to the panel icon.',
        });

        const posModel = Gtk.StringList.new(['Right', 'Left']);
        const posRow = new Adw.ComboRow({
            title: 'Label position',
            subtitle: 'Show the folder name to the right or left of the icon.',
            model: posModel,
            selected: settings.get_string('active-label-position') === 'left' ? 1 : 0,
        });
        posRow.connect('notify::selected', () => {
            settings.set_string('active-label-position', posRow.get_selected() === 0 ? 'right' : 'left');
        });
        labelGroup.add(posRow);
        page.add(labelGroup);

        const panelGroup = new Adw.PreferencesGroup({
            title: 'Panel Position',
            description: 'Where the extension icon sits in the top panel.',
        });

        const areaModel = Gtk.StringList.new(['Right', 'Center', 'Left']);
        const areaRow = new Adw.ComboRow({
            title: 'Panel area',
            subtitle: 'Which section of the panel the icon appears in.',
            model: areaModel,
            selected: (() => {
                const v = settings.get_string('panel-position');
                if (v === 'center') return 1;
                if (v === 'left') return 2;
                return 0;
            })(),
        });
        areaRow.connect('notify::selected', () => {
            const idx = areaRow.get_selected();
            settings.set_string('panel-position', idx === 0 ? 'right' : idx === 1 ? 'center' : 'left');
        });
        panelGroup.add(areaRow);

        const orderRow = new Adw.ActionRow({
            title: 'Order',
            subtitle: 'Position within the panel area. Negative = left, 0 = default, positive = right.',
        });
        const orderSpin = Gtk.SpinButton.new_with_range(-10, 10, 1);
        orderSpin.set_valign(Gtk.Align.CENTER);
        orderSpin.set_value(settings.get_int('panel-order'));
        orderSpin.connect('value-changed', () => {
            settings.set_int('panel-order', orderSpin.get_value_as_int());
        });
        orderRow.add_suffix(orderSpin);
        orderRow.activatable_widget = orderSpin;
        panelGroup.add(orderRow);

        page.add(panelGroup);
        window.add(page);
    }
}
