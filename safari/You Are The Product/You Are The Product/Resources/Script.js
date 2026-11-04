function show(enabled, useSettingsInsteadOfPreferences) {
    if (!useSettingsInsteadOfPreferences) {
        // macOS 12 still calls them Safari Preferences.
        for (const el of document.querySelectorAll('.status p')) {
            el.innerText = el.innerText.replace('Safari Settings', 'Safari Preferences');
        }
        document.querySelector('button.open-preferences').innerText = "Quit and Open Safari Extensions Preferences…";
    }

    if (typeof enabled === "boolean") {
        document.body.classList.toggle(`state-on`, enabled);
        document.body.classList.toggle(`state-off`, !enabled);
    } else {
        document.body.classList.remove(`state-on`);
        document.body.classList.remove(`state-off`);
    }
}

function openPreferences() {
    webkit.messageHandlers.controller.postMessage("open-preferences");
}

document.querySelector("button.open-preferences").addEventListener("click", openPreferences);
