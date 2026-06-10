// ==UserScript==
// @name          Rozwiązywanie grupy baddonz
// @version       2.1.0
// @description   Rozwiązywanie grupy
// @author        besiak
// @match         https://*.margonem.pl/*
// @grant         none
// ==/UserScript==

(function() {
    'use strict';

    const ADDON_ID = "RG";

    // Wszystko zapisywane do konta (acc)
    const DEFAULT = {
        enabled:       true,
        windowVisible: true,
        windowOpacity: 2,
        leaveEnabled:  false,
        disbandKey:    "n"
    };

    let S = { ...DEFAULT };
    let uiWindowElement    = null;
    let keybindInputActive = false;
    let isKeyDownBound     = false;

    function loadSettings() {
        if (!window.BaddonzAPI) return;
        S = { ...DEFAULT, ...window.BaddonzAPI.getAccSettings(ADDON_ID) };
    }

    function saveSettings() {
        if (!window.BaddonzAPI) return;
        window.BaddonzAPI.saveAccSettings(ADDON_ID, S);
    }

    // ─── Logika ───────────────────────────────────────────────────────────────
    function isChatFocused() {
        const el = document.activeElement;
        return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
    }

    function isLeader() {
        if (!window.Engine?.party || !window.Engine?.hero) return false;
        const heroId = window.Engine.hero.d.id;
        let members = typeof window.Engine.party.getMembers === 'function'
            ? window.Engine.party.getMembers()
            : window.Engine.party.d;
        if (!members) return false;
        if (members instanceof Map) {
            for (const m of members.values()) { if (m.leader) return m.id === heroId; }
        } else {
            for (const id in members) { if (members[id].leader) return parseInt(id) === heroId; }
        }
        return false;
    }

    function disbandParty() {
        if (!window.Engine?.party) return;
        let members = typeof window.Engine.party.getMembers === 'function'
            ? window.Engine.party.getMembers()
            : window.Engine.party.d;
        if (!members) return;
        if (members instanceof Map && members.size === 0) return;
        if (!(members instanceof Map) && Object.keys(members).length === 0) return;
        if (isLeader()) window._g("party&a=disband");
        else if (S.leaveEnabled) window._g("party&a=rm&id=" + window.Engine.hero.d.id);
    }

    function handleKeyDown(e) {
        if (!S.enabled) return;
        const kbInput = uiWindowElement?.querySelector(".rg-keybind-input");

        if (keybindInputActive && kbInput) {
            e.preventDefault();
            const key = e.key.toLowerCase();
            if (['escape','enter','tab'].includes(key)) { kbInput.blur(); return; }
            if (!window.BaddonzAPI?.isValidHotkey(key)) return;
            if (key.length !== 1) return;
            S.disbandKey = key;
            kbInput.value = key.toUpperCase();
            saveSettings();
            keybindInputActive = false;
            kbInput.blur();
            kbInput.classList.remove('active-keybind-mode');
            return;
        }

        if (!isChatFocused() && e.key.toLowerCase() === S.disbandKey) {
            e.preventDefault();
            disbandParty();
        }
    }

    // ─── UI ───────────────────────────────────────────────────────────────────
    function buildUI() {
        const bodyHtml = `
            <div class="baddonz-setting-row" style="margin-bottom:4px!important;display:flex;align-items:center;">
                <div class="baddonz-checkbox rg-enabled ${S.enabled ? 'active' : ''}"></div>
                <span class="baddonz-text" style="padding:0;margin-left:5px;">Rozwiązywanie</span>
                <input type="text" class="baddonz-input keybind rg-keybind-input" value="${S.disbandKey.toUpperCase()}" readonly
                       style="width:50px;height:20px;line-height:18px;font-size:11px;padding:1px 0;margin-left:auto;">
            </div>
            <div class="baddonz-setting-row rg-leave-row" style="display:${S.enabled ? 'flex' : 'none'};">
                <div class="baddonz-checkbox rg-leave ${S.leaveEnabled ? 'active' : ''}"></div>
                <span class="baddonz-text" style="padding:0;">Opuszczaj grupę</span>
            </div>`;

        uiWindowElement = window.BaddonzAPI.createAddonWindow(ADDON_ID, "Rozwiązywanie", bodyHtml, {
            width: '180px', customId: 'baddonz-rg-wnd', hasSettings: false, hasCollapse: false
        });

        const elEnabled  = uiWindowElement.querySelector(".rg-enabled");
        const elLeave    = uiWindowElement.querySelector(".rg-leave");
        const elLeaveRow = uiWindowElement.querySelector(".rg-leave-row");
        const elKeybind  = uiWindowElement.querySelector(".rg-keybind-input");

        elEnabled.addEventListener('click', () => {
            S.enabled = elEnabled.classList.toggle('active');
            elLeaveRow.style.display = S.enabled ? 'flex' : 'none';
            saveSettings();
        });

        elLeave.addEventListener('click', () => {
            S.leaveEnabled = elLeave.classList.toggle('active');
            saveSettings();
        });

        elKeybind.addEventListener('click', () => {
            keybindInputActive = true;
            elKeybind.focus();
            elKeybind.classList.add('active-keybind-mode');
        });

        elKeybind.addEventListener('focusout', () => {
            if (keybindInputActive) {
                keybindInputActive = false;
                elKeybind.value = S.disbandKey.toUpperCase();
            }
            elKeybind.classList.remove('active-keybind-mode');
        });

        if (typeof $ === 'function' && typeof $.fn.tip === 'function') {
            $(elEnabled).tip('Rozwiąż grupę');
            $(elLeave).tip('Jeżeli nie jesteś liderem, opuść grupę');
        }
    }

    // ─── Lifecycle ────────────────────────────────────────────────────────────
    function addonInit() {
        loadSettings();
        if (!uiWindowElement) buildUI();
        if (uiWindowElement) uiWindowElement.style.display = S.windowVisible ? '' : 'none';
        if (!isKeyDownBound) { document.addEventListener('keydown', handleKeyDown); isKeyDownBound = true; }
    }

    function addonStop() {
        if (isKeyDownBound) { document.removeEventListener('keydown', handleKeyDown); isKeyDownBound = false; }
        if (uiWindowElement) { uiWindowElement.remove(); uiWindowElement = null; }
    }

    function onStateToggle(isEnabled) {
        S.enabled = isEnabled;
        if (uiWindowElement) {
            const elEnabled  = uiWindowElement.querySelector(".rg-enabled");
            const elLeaveRow = uiWindowElement.querySelector(".rg-leave-row");
            if (elEnabled)  elEnabled.classList.toggle('active', isEnabled);
            if (elLeaveRow) elLeaveRow.style.display = isEnabled ? 'flex' : 'none';
        }
    }

    const checkApi = () => {
        if (!window.BaddonzAPI?.registerAddon) { setTimeout(checkApi, 500); return; }
        window.BaddonzAPI.registerAddon(ADDON_ID, { init: addonInit, stop: addonStop, onStateToggle });
    };
    checkApi();
})();
