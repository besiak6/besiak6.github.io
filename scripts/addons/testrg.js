// ==UserScript==
// @name          Rozwiązywanie grupy baddonz
// @version       28.05.2026
// @description   Rozwiązywanie grupy
// @author        besiak
// @match         https://*.margonem.pl/*
// @grant         none
// ==/UserScript==

(function() {
    'use strict';

    const ADDON_ID = "RG";

    let currentSettings = {
        enabled: true,
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
            const data = JSON.parse(localStorage.getItem('BaddonzData')) || {};
            if (data[accId] && data[accId].accountAddons) {
                accSettings = data[accId].accountAddons[ADDON_ID] || {};
            }
        } catch (e) {}
        
        let charSettings = window.BaddonzAPI.getAddonSettings(ADDON_ID) || {};
        currentSettings = { ...currentSettings, ...accSettings, ...charSettings };
    }

    function saveSettings() {
        if (!window.BaddonzAPI) return;
        const accId = window.BaddonzAPI.accountId;
        
        const accKeys = ['enabled', 'leaveEnabled', 'disbandKey'];
        let accSettings = {};
        accKeys.forEach(k => accSettings[k] = currentSettings[k]);
        
        window.BaddonzAPI.saveAddonSettings(ADDON_ID, {});
        
        try {
            let data = JSON.parse(localStorage.getItem('BaddonzData')) || {};
            if (!data[accId]) data[accId] = {};
            if (!data[accId].accountAddons) data[accId].accountAddons = {};
            data[accId].accountAddons[ADDON_ID] = accSettings;
            localStorage.setItem('BaddonzData', JSON.stringify(data));
        } catch (e) {}
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
        const rgKeybindInput = uiWindowElement ? uiWindowElement.querySelector(".rg-keybind-input") : null;

        if (keybindInputActive && rgKeybindInput) {
            e.preventDefault();
            const pressedKey = e.key.toLowerCase();
            
            if (['escape', 'enter', 'tab'].includes(pressedKey)) {
                rgKeybindInput.blur();
                return;
            }

            if (window.BaddonzAPI && !window.BaddonzAPI.isValidHotkey(pressedKey)) return;
            if (pressedKey.length !== 1) return;

            currentSettings.disbandKey = pressedKey;
            rgKeybindInput.value = pressedKey.toUpperCase();
            saveSettings();

            keybindInputActive = false;
            rgKeybindInput.blur();
            rgKeybindInput.classList.remove('active-keybind-mode');
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
                <div class="baddonz-checkbox rg-checkbox ${currentSettings.enabled ? 'active' : ''}"></div>
                <span class="baddonz-text" style="padding: 0; margin-left: 5px;">Rozwiązywanie</span>
                <input type="text" class="baddonz-input keybind rg-keybind-input" value="${currentSettings.disbandKey.toUpperCase()}" readonly style="width: 50px; height: 20px; line-height: 18px; font-size: 11px; padding: 1px 0; margin-left: auto;">
            </div>
            <div class="baddonz-setting-row rg-leave-group-option" style="display: ${currentSettings.enabled ? 'flex' : 'none'};">
                <div class="baddonz-checkbox rg-leave-checkbox ${currentSettings.leaveEnabled ? 'active' : ''}"></div>
                <span class="baddonz-text" style="padding:0;">Opuszczaj grupę</span>
            </div>
        `;
        uiWindowElement = window.BaddonzAPI.createAddonWindow(ADDON_ID, "Rozwiązywanie", bodyHtml, {
            width: '180px',
            customId: 'baddonz-rg-wnd',
            hasSettings: false,
            hasCollapse: false
        });
        const rgCheckbox = uiWindowElement.querySelector(".rg-checkbox");
        const rgLeaveCheckbox = uiWindowElement.querySelector(".rg-leave-checkbox");
        const rgKeybindInput = uiWindowElement.querySelector(".rg-keybind-input");
        const leaveGroupOption = uiWindowElement.querySelector(".rg-leave-group-option");
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
                rgKeybindInput.value = currentSettings.disbandKey.toUpperCase();
            }
            rgKeybindInput.classList.remove('active-keybind-mode');
        });
        if (typeof $ === 'function' && typeof $.fn.tip === 'function') {
            $(rgCheckbox).tip(`Rozwiąż grupę`);
            $(rgLeaveCheckbox).tip(`Jeżeli nie jesteś liderem, opuść grupę`);
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
            const rgCheckbox = uiWindowElement.querySelector(".rg-checkbox");
            const leaveGroupOption = uiWindowElement.querySelector(".rg-leave-group-option");
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
