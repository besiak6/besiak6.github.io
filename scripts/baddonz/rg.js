(function () {
    'use strict';
    const SETTINGS_KEY = "baddonz-settings-rg";
    const DEFAULT_SETTINGS = {
        enabled: true,
        leaveEnabled: false,
        disbandKey: "n",
        windowPosition: { left: '0', top: '0' },
        windowOpacity: 2,
        windowVisible: true
    };
    let currentSettings = {};
    let keybindInputActive = false;

    function loadSettings() {
        try {
            const storedSettings = JSON.parse(localStorage.getItem(SETTINGS_KEY));
            return { ...DEFAULT_SETTINGS, ...storedSettings };
        } catch (e) {
            return DEFAULT_SETTINGS;
        }
    }

    function saveSettings() {
        try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(currentSettings));
        } catch (e) {
        }
    }

    function isChatFocused() {
        const el = document.activeElement;
        return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
    }

    function isLeader() {
        return Engine?.party?.getLeaderId?.() === Engine?.hero?.d?.id;
    }

    function disbandParty() {
        if (!Engine.party || Object.keys(Engine.party.getMembers()).length === 0) {
            message("Nie jesteś w żadnej grupie!");
            return;
        }
        if (isLeader()) {
            _g("party&a=disband");
            message("Grupa została rozwiązana!");
        } else if (currentSettings.leaveEnabled) {
            _g("party&a=rm&id=" + Engine.hero.d.id);
            message("Opuszczono grupę!");
        } else {
            message("Nie jesteś liderem grupy i opuszczanie grupy nie jest włączone!");
        }
    }

    function handleKeyDown(e) {
        if (keybindInputActive) {
            e.preventDefault();
            const pressedKey = e.key.toLowerCase();
            const rgKeybindInput = document.getElementById("rg-keybind-input");
            if (['escape', 'enter', 'tab', 'shift', 'control', 'alt', 'meta', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12'].includes(pressedKey)) {
                return;
            }
            if (pressedKey === ' ') {
                currentSettings.disbandKey = "space";
                rgKeybindInput.value = "[SPACJA]";
            } else {
                currentSettings.disbandKey = pressedKey;
                rgKeybindInput.value = pressedKey.toUpperCase();
            }
            saveSettings();
            keybindInputActive = false;
            rgKeybindInput.blur();
            updateTooltips();
            return;
        }
        if (currentSettings.enabled && !isChatFocused() && e.key.toLowerCase() === currentSettings.disbandKey) {
            disbandParty();
        }
    }

    function updateTooltips() {
        const rgCheckbox = document.getElementById("rg-checkbox");
        const rgLeaveCheckbox = document.getElementById("rg-leave-checkbox");
        if (typeof $ === 'function' && typeof $.fn.tip === 'function') {
            let disbandKeyDisplay = currentSettings.disbandKey.toUpperCase();
            if (currentSettings.disbandKey === "space") {
                disbandKeyDisplay = "[SPACJA]";
            }
            if (rgCheckbox) {
                $(rgCheckbox).tip(`Rozwiązuj grupę pod (${disbandKeyDisplay})`);
            }
            if (rgLeaveCheckbox) {
                $(rgLeaveCheckbox).tip(`Jeżeli nie jesteś liderem, opuszczaj grupę pod (${disbandKeyDisplay})`);
            }
        }
    }

    function updateConditionalVisibility() {
        const keybindInputGroup = document.getElementById("rg-keybind-input-group");
        const leaveGroupOption = document.getElementById("rg-leave-group-option");
        if (keybindInputGroup) {
            keybindInputGroup.style.display = currentSettings.enabled ? 'flex' : 'none';
        }
        if (leaveGroupOption) {
            leaveGroupOption.style.display = currentSettings.enabled ? 'flex' : 'none';
        }
    }

    function createUI() {
        const windowHtml = `
            <div class="baddonz-window" id="rg-wnd" style="position: absolute; z-index: 500;">
                <div class="baddonz-window-header">
                    <div class="baddonz-window-controls left">
                        <div class="baddonz-icon baddonz-opacity-button" id="rg-opacity-btn"></div>
                    </div>
                    <div class="baddonz-window-title">Disband Group</div>
                    <div class="baddonz-window-controls right">
                        <div class="baddonz-icon baddonz-close-button" id="rg-close-button"></div>
                    </div>
                </div>
                <div class="baddonz-window-body baddonz-flex column">
                    <div class="baddonz-label-wrapper" style="justify-content: flex-start; align-items: center; gap: 5px;">
                        <div class="baddonz-checkbox" id="rg-checkbox"></div>
                        <div class="baddonz-text" style="padding: 0;">Rozwiązywanie</div>
                    </div>
                    <div class="baddonz-label-wrapper" id="rg-leave-group-option" style="justify-content: flex-start; align-items: center; gap: 5px; display: none;">
                        <div class="baddonz-checkbox" id="rg-leave-checkbox"></div>
                        <div class="baddonz-text" style="padding: 0;">Opuszczaj grupę</div>
                    </div>
                    <div class="baddonz-input-plus" id="rg-keybind-input-group" style="display: none;">
                        <input type="text" class="baddonz-input" id="rg-keybind-input" value="${currentSettings.disbandKey === "space" ? "[SPACJA]" : currentSettings.disbandKey.toUpperCase()}" readonly>
                    </div>
                </div>
            </div>
            <div class="baddon_set_button RG" style="display: none;"></div>
        `;
        document.body.insertAdjacentHTML('beforeend', windowHtml);

        const rgWindow = document.getElementById("rg-wnd");
        const rgCloseButton = document.getElementById("rg-close-button");
        const rgOpacityButton = document.getElementById("rg-opacity-btn");
        const rgTitleBar = rgWindow.querySelector(".baddonz-window-title");
        const rgCheckbox = document.getElementById("rg-checkbox");
        const rgLeaveCheckbox = document.getElementById("rg-leave-checkbox");
        const rgKeybindInput = document.getElementById("rg-keybind-input");
        const rgToggleButton = document.querySelector(".baddon_set_button.RG");

        rgWindow.style.left = currentSettings.windowPosition.left;
        rgWindow.style.top = currentSettings.windowPosition.top;
        const opacityClasses = ['opacity-0', 'opacity-1', 'opacity-2', 'opacity-3', 'opacity-4'];
        rgWindow.classList.add(opacityClasses[currentSettings.windowOpacity]);
        rgWindow.style.display = currentSettings.windowVisible ? 'flex' : 'none';

        if (currentSettings.enabled) {
            rgCheckbox.classList.add('active');
        }
        if (currentSettings.leaveEnabled) {
            rgLeaveCheckbox.classList.add('active');
        }

        updateConditionalVisibility();
        if (currentSettings.disbandKey === "space") {
             rgKeybindInput.value = "[SPACJA]";
        } else {
             rgKeybindInput.value = currentSettings.disbandKey.toUpperCase();
        }

        let isDragging = false;
        let offsetX, offsetY;

        rgTitleBar.addEventListener('mousedown', (e) => {
            isDragging = true;
            offsetX = e.clientX - rgWindow.getBoundingClientRect().left;
            offsetY = e.clientY - rgWindow.getBoundingClientRect().top;
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            let newX = e.clientX - offsetX;
            let newY = e.clientY - offsetY;
            const maxX = window.innerWidth - rgWindow.offsetWidth;
            const maxY = window.innerHeight - rgWindow.offsetHeight;
            newX = Math.max(0, Math.min(newX, maxX));
            newY = Math.max(0, Math.min(newY, maxY));
            rgWindow.style.left = `${newX}px`;
            rgWindow.style.top = `${newY}px`;
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                currentSettings.windowPosition.left = rgWindow.style.left;
                currentSettings.windowPosition.top = rgWindow.style.top;
                saveSettings();
            }
        });

        rgCloseButton.addEventListener('click', () => {
            rgWindow.style.display = 'none';
            currentSettings.windowVisible = false;
            saveSettings();
        });

        rgOpacityButton.addEventListener('click', () => {
            rgWindow.classList.remove(...opacityClasses);
            currentSettings.windowOpacity = (currentSettings.windowOpacity + 1) % opacityClasses.length;
            rgWindow.classList.add(opacityClasses[currentSettings.windowOpacity]);
            saveSettings();
        });

        rgCheckbox.addEventListener('click', () => {
            rgCheckbox.classList.toggle('active');
            currentSettings.enabled = rgCheckbox.classList.contains('active');
            saveSettings();
            updateTooltips();
            updateConditionalVisibility();
        });

        rgLeaveCheckbox.addEventListener('click', () => {
            rgLeaveCheckbox.classList.toggle('active');
            currentSettings.leaveEnabled = rgLeaveCheckbox.classList.contains('active');
            saveSettings();
            updateTooltips();
        });

        rgKeybindInput.addEventListener('click', () => {
            if (currentSettings.enabled) {
                keybindInputActive = true;
                rgKeybindInput.classList.add('active-keybind-mode');
                rgKeybindInput.focus();
            }
        });

        rgKeybindInput.addEventListener('blur', () => {
            if (keybindInputActive) {
                keybindInputActive = false;
                let displayKey = currentSettings.disbandKey.toUpperCase();
                if (currentSettings.disbandKey === "space") {
                    displayKey = "[SPACJA]";
                }
                rgKeybindInput.value = displayKey;
            }
            rgKeybindInput.classList.remove('active-keybind-mode');
        });

        rgToggleButton.addEventListener('click', () => {
            if (rgWindow.style.display === 'none') {
                rgWindow.style.display = 'flex';
            } else {
                rgWindow.style.display = 'none';
            }
            currentSettings.windowVisible = rgWindow.style.display !== 'none';
            saveSettings();
        });

        if (typeof $ === 'function' && typeof $.fn.tip === 'function') {
            $(rgCloseButton).tip('Zamknij');
            $(rgOpacityButton).tip('Zmień przezroczystość okienka');
            updateTooltips();
        }
    }

    const init = () => {
        try {
            if (!window.Engine || !window.Engine.allInit || (typeof window.__build !== "object" && typeof window.__bootNI === "undefined")) {
                setTimeout(init, 500);
                return;
            }
            currentSettings = loadSettings();
            document.addEventListener('keydown', handleKeyDown);
            createUI();
        } catch (error) {
            setTimeout(init, 500);
        }
    };
    init();
})();
