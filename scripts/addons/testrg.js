// ==UserScript==
// @name          Rozwiązywanie grupy baddonz
// @version       1.0
// @description   Rozwiązywanie grupy
// @author        besiak
// @match         https://*.margonem.pl/*
// @grant         none
// ==/UserScript==

(function() {
    'use strict';

    const ADDON_ID = "RG";

    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.id = "rg-custom-styles";
    styleSheet.innerText = `
        #baddonz-rg-wnd { width:180px; min-width:180px; }
        #baddonz-rg-wnd .baddonz-window-body { padding: 4px 6px 6px 6px !important; gap: 3px !important; }
        #baddonz-rg-wnd .baddonz-setting-row { margin-bottom: 2px !important; }
        #baddonz-rg-wnd .baddonz-text { font-size: 11px; }
    `;
    if (!document.getElementById("rg-custom-styles")) document.head.appendChild(styleSheet);

    let currentSettings = {
        enabled: true,
        windowOpacity: 2,
        windowVisible: true,
        leaveEnabled: false,
        disbandKey: "n"
    };

    let uiWindowElement = null;
    let keybindInputActive = false;
    let isKeyDownBound = false;

    function loadSettings() {
        if (!window.BaddonzAPI) return;
        const accId = window.BaddonzAPI.accountId;
        let accSettings = {};
        try {
            accSettings = JSON.parse(localStorage.getItem('Baddonz_RG_Acc_' + accId)) || {};
        } catch (e) {}
        
        let charSettings = window.BaddonzAPI.getAddonSettings(ADDON_ID) || {};
        currentSettings = { ...currentSettings, ...accSettings, ...charSettings };
    }

    function saveSettings() {
        if (!window.BaddonzAPI) return;
        const accId = window.BaddonzAPI.accountId;
        
        const accKeys = ['enabled', 'windowOpacity', 'windowVisible', 'leaveEnabled', 'disbandKey'];
        let accSettings = {};
        accKeys.forEach(k => accSettings[k] = currentSettings[k]);
        
        localStorage.setItem('Baddonz_RG_Acc_' + accId, JSON.stringify(accSettings));
        window.BaddonzAPI.saveAddonSettings(ADDON_ID, {});
    }

    function isChatFocused() {
        const el = document.activeElement;
        return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
    }

    function isLeader() {
        if (!window.Engine || !window.Engine.party || !window.Engine.hero) return false;
        const heroId = window.Engine.hero.d.id;
        
        if (typeof window.Engine.party.getMembers === 'function') {
            const members = window.Engine.party.getMembers();
            if (members instanceof Map) {
                for (const member of members.values()) {
                    if (member.leader) return member.id === heroId;
                }
            } else if (members) {
                for (const id in members) {
                    if (members[id].leader) return parseInt(id) === heroId;
                }
            }
        } else if (window.Engine.party.d) {
            const members = window.Engine.party.d;
            for (const id in members) {
                if (members[id].leader) return parseInt(id) === heroId;
            }
        }
        return false;
    }

    function disbandParty() {
        if (!window.Engine || !window.Engine.party) return;
        let members = null;
        if (typeof window.Engine.party.getMembers === 'function') members = window.Engine.party.getMembers();
        else if (window.Engine.party.d) members = window.Engine.party.d;

        if (!members) return;
        if (members instanceof Map && members.size === 0) return;
        if (!(members instanceof Map) && Object.keys(members).length === 0) return;

        if (isLeader()) {
            window._g("party&a=disband");
        } else if (currentSettings.leaveEnabled) {
            window._g("party&a=rm&id=" + window.Engine.hero.d.id);
        }
    }

    function handleKeyDown(e) {
        if (!currentSettings.enabled) return;
        const rgKeybindInput = uiWindowElement ? uiWindowElement.querySelector("#rg-keybind-input") : null;

        if (keybindInputActive && rgKeybindInput) {
            e.preventDefault();
            const pressedKey = e.key.toLowerCase();
            if (['escape', 'enter', 'tab', 'shift', 'control', 'alt', 'meta', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'capslock', 'numlock', 'scrolllock'].includes(pressedKey)) {
                if (['escape', 'enter', 'tab'].includes(pressedKey)) rgKeybindInput.blur();
                return;
            }

            if (pressedKey === ' ') {
                currentSettings.disbandKey = "space";
                rgKeybindInput.value = "[SPACJA]";
            } else if (pressedKey.length === 1) {
                currentSettings.disbandKey = pressedKey;
                rgKeybindInput.value = pressedKey.toUpperCase();
            } else {
                return;
            }

            saveSettings();
            keybindInputActive = false;
            rgKeybindInput.blur();
            rgKeybindInput.classList.remove('active-keybind-mode');
            
            if (typeof $ === 'function' && typeof $.fn.tip === 'function') {
                const rgCheckbox = uiWindowElement.querySelector("#rg-checkbox");
                const rgLeaveCheckbox = uiWindowElement.querySelector("#rg-leave-checkbox");
                let displayKey = currentSettings.disbandKey === "space" ? "[SPACJA]" : currentSettings.disbandKey.toUpperCase();
                if (rgCheckbox) $(rgCheckbox).tip(`Rozwiąż grupę (${displayKey})`);
                if (rgLeaveCheckbox) $(rgLeaveCheckbox).tip(`Jeżeli nie jesteś liderem, opuść grupę (${displayKey})`);
            }
            
            return;
        }

        if (!isChatFocused() && e.key.toLowerCase() === currentSettings.disbandKey) {
            e.preventDefault();
            disbandParty();
        }
    }

    function buildUI() {
        const bodyHtml = `
            <div class="baddonz-setting-row" style="margin-bottom: 4px !important; display: flex; align-items: center;">
                <div class="baddonz-checkbox ${currentSettings.enabled ? 'active' : ''}" id="rg-checkbox"></div>
                <span class="baddonz-text" style="padding: 0; margin-left: 5px;">Rozwiązywanie</span>
                <input type="text" class="baddonz-input keybind" id="rg-keybind-input" value="${currentSettings.disbandKey === "space" ? "[SPACJA]" : currentSettings.disbandKey.toUpperCase()}" readonly style="width: 50px; height: 20px; line-height: 18px; font-size: 11px; padding: 1px 0; margin-left: auto;">
            </div>
            <div id="rg-leave-group-option" class="baddonz-setting-row" style="display: ${currentSettings.enabled ? 'flex' : 'none'};">
                <div class="baddonz-checkbox ${currentSettings.leaveEnabled ? 'active' : ''}" id="rg-leave-checkbox"></div>
                <span class="baddonz-text" style="padding:0;">Opuszczaj grupę</span>
            </div>
        `;

        uiWindowElement = window.BaddonzAPI.createAddonWindow(ADDON_ID, "Rozwiązywanie", bodyHtml, {
            width: '180px',
            customId: 'baddonz-rg-wnd',
            hasSettings: false,
            hasCollapse: false
        });

        const rgCheckbox = uiWindowElement.querySelector("#rg-checkbox");
        const rgLeaveCheckbox = uiWindowElement.querySelector("#rg-leave-checkbox");
        const rgKeybindInput = uiWindowElement.querySelector("#rg-keybind-input");
        const leaveGroupOption = uiWindowElement.querySelector("#rg-leave-group-option");

        rgCheckbox.addEventListener('click', () => {
            currentSettings.enabled = rgCheckbox.classList.toggle('active');
            leaveGroupOption.style.display = currentSettings.enabled ? 'flex' : 'none';
            saveSettings();
        });

        rgLeaveCheckbox.addEventListener('click', () => {
            currentSettings.leaveEnabled = rgLeaveCheckbox.classList.toggle('active');
            saveSettings();
        });

        rgKeybindInput.addEventListener('click', () => {
            keybindInputActive = true;
            rgKeybindInput.focus();
            rgKeybindInput.classList.add('active-keybind-mode');
        });

        rgKeybindInput.addEventListener('focusout', () => {
            if (keybindInputActive) {
                keybindInputActive = false;
                rgKeybindInput.value = currentSettings.disbandKey === "space" ? "[SPACJA]" : currentSettings.disbandKey.toUpperCase();
            }
            rgKeybindInput.classList.remove('active-keybind-mode');
        });

        if (typeof $ === 'function' && typeof $.fn.tip === 'function') {
            let displayKey = currentSettings.disbandKey === "space" ? "[SPACJA]" : currentSettings.disbandKey.toUpperCase();
            $(rgCheckbox).tip(`Rozwiąż grupę (${displayKey})`);
            $(rgLeaveCheckbox).tip(`Jeżeli nie jesteś liderem, opuść grupę (${displayKey})`);
        }
    }

    function addonInit() {
        loadSettings();
        if (!uiWindowElement) buildUI();

        if (!isKeyDownBound) {
            document.addEventListener('keydown', handleKeyDown);
            isKeyDownBound = true;
        }
    }

    function addonStop() {
        if (isKeyDownBound) {
            document.removeEventListener('keydown', handleKeyDown);
            isKeyDownBound = false;
        }
        if (uiWindowElement) {
            uiWindowElement.remove();
            uiWindowElement = null;
        }
    }

    function onStateToggle(isEnabled) {
        currentSettings.enabled = isEnabled;
        if (uiWindowElement) {
            const rgCheckbox = uiWindowElement.querySelector("#rg-checkbox");
            const leaveGroupOption = uiWindowElement.querySelector("#rg-leave-group-option");
            if (rgCheckbox) {
                if (isEnabled) rgCheckbox.classList.add('active');
                else rgCheckbox.classList.remove('active');
            }
            if (leaveGroupOption) {
                leaveGroupOption.style.display = isEnabled ? 'flex' : 'none';
            }
        }
    }

    const checkApi = () => {
        if (!window.BaddonzAPI || !window.BaddonzAPI.registerAddon) {
            setTimeout(checkApi, 500);
            return;
        }
        window.BaddonzAPI.registerAddon(ADDON_ID, { init: addonInit, stop: addonStop, onStateToggle: onStateToggle });
    };

    checkApi();

})();
