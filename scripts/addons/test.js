// ==UserScript==
// @name          Auto Przywo
// @version       2.0
// @author        besiak
// @match         https://*.margonem.pl/*
// @grant         none
// ==/UserScript==

(function() {
    'use strict';

    const ADDON_ID = "AP";

    // Wszystko zapisywane do konta (acc) — brak ustawień per-postać
    const DEFAULT = {
        enabled:       true,
        windowVisible: true,
        windowOpacity: 2,
        blockedNicks:  []
    };

    let S = { ...DEFAULT };
    let uiWindowElement = null;
    let originalAlert   = null;

    function loadSettings() {
        if (!window.BaddonzAPI) return;
        S = { ...DEFAULT, ...window.BaddonzAPI.getAccSettings(ADDON_ID) };
    }

    function saveSettings() {
        if (!window.BaddonzAPI) return;
        window.BaddonzAPI.saveAccSettings(ADDON_ID, S);
    }

    // ─── Logika ───────────────────────────────────────────────────────────────
    function enableLogic() {
        if (typeof mAlert === 'undefined' || originalAlert) return;
        originalAlert = mAlert;
        mAlert = function() {
            if (S.enabled && typeof arguments[0] === 'string') {
                const msg = arguments[0];
                if (msg.includes("przyzywa do siebie swoją drużynę")) {
                    const m = msg.match(/Gracz (.+?) przyzywa/);
                    if (m && m[1]) {
                        const nick = m[1].trim();
                        const blocked = S.blockedNicks.some(bn => bn.toLowerCase() === nick.toLowerCase());
                        if (blocked) return originalAlert.apply(this, arguments);
                    }
                    _g("party&a=acceptsummon&answer=1");
                    if (typeof closeModal === "function") closeModal();
                    return;
                }
            }
            return originalAlert.apply(this, arguments);
        };
    }

    function disableLogic() {
        if (originalAlert) { mAlert = originalAlert; originalAlert = null; }
    }

    // ─── UI ───────────────────────────────────────────────────────────────────
    function buildUI() {
        const bodyHtml = `
            <div class="baddonz-label-wrapper" style="justify-content:flex-start;align-items:center;gap:5px;">
                <div class="baddonz-checkbox ${S.enabled ? 'active' : ''}" id="ap-enabled"></div>
                <div class="baddonz-text" style="padding:0;">Auto Przywo</div>
            </div>
            <div id="ap-blocked-section" class="baddonz-flex column" style="gap:5px;margin-top:5px;display:${S.enabled ? 'flex' : 'none'};box-sizing:border-box;max-width:100%;">
                <hr style="width:100%;border-color:#303030;margin:0;">
                <div class="baddonz-text" style="padding:0;">Nie akceptuj od:</div>
                <div class="baddonz-input-addbutton">
                    <input type="text" class="baddonz-input" id="ap-nick-input" placeholder="Wpisz nick" maxlength="20">
                    <button class="baddonz-button" id="ap-add-btn">+</button>
                </div>
                <div class="baddonz-scroll" id="ap-nicks-list" style="overflow-y:auto;max-height:120px;width:100%;box-sizing:border-box;"></div>
            </div>`;

        uiWindowElement = window.BaddonzAPI.createAddonWindow(ADDON_ID, "Auto Przywo", bodyHtml, { width: '195px' });

        const elEnabled  = uiWindowElement.querySelector("#ap-enabled");
        const elSection  = uiWindowElement.querySelector("#ap-blocked-section");
        const elInput    = uiWindowElement.querySelector("#ap-nick-input");
        const elAddBtn   = uiWindowElement.querySelector("#ap-add-btn");
        const elList     = uiWindowElement.querySelector("#ap-nicks-list");

        const renderList = () => {
            elList.innerHTML = '';
            S.blockedNicks.forEach((nick, idx) => {
                const el = document.createElement('div');
                el.className = 'baddonz-list-item';
                el.innerHTML = `
                    <input type="text" class="baddonz-input" value="${nick}" readonly data-index="${idx}" maxlength="20" style="flex-grow:1;height:24px;padding:2px 5px;font-size:13px;box-sizing:border-box;">
                    <div class="baddonz-icon baddonz-close-button baddonz-remove-x" data-index="${idx}" title="Usuń z listy"></div>`;
                elList.appendChild(el);
            });
        };

        elEnabled.addEventListener('click', () => {
            S.enabled = elEnabled.classList.toggle('active');
            elSection.style.display = S.enabled ? 'flex' : 'none';
            saveSettings();
        });

        elAddBtn.addEventListener('click', () => {
            const nick = elInput.value.trim();
            if (nick && !S.blockedNicks.some(n => n.toLowerCase() === nick.toLowerCase())) {
                S.blockedNicks.push(nick);
                elInput.value = '';
                saveSettings();
                renderList();
                elList.scrollTop = elList.scrollHeight;
            }
        });

        // Usuwanie (klik w X)
        elList.addEventListener('click', (e) => {
            if (e.target.classList.contains('baddonz-remove-x') || e.target.classList.contains('baddonz-close-button')) {
                S.blockedNicks.splice(parseInt(e.target.dataset.index), 1);
                saveSettings();
                renderList();
            }
        });

        // Edycja (klik w input)
        elList.addEventListener('click', (e) => {
            if (e.target.tagName === 'INPUT' && e.target.classList.contains('baddonz-input')) {
                const idx     = parseInt(e.target.dataset.index);
                const origNick= S.blockedNicks[idx];
                e.target.readOnly = false;
                e.target.focus();
                e.target.setSelectionRange(e.target.value.length, e.target.value.length);
                const onBlur = () => {
                    e.target.readOnly = true;
                    const newNick = e.target.value.trim();
                    if (newNick && newNick.toLowerCase() !== origNick.toLowerCase()) {
                        const dup = S.blockedNicks.some((n, i) => i !== idx && n.toLowerCase() === newNick.toLowerCase());
                        if (!dup) S.blockedNicks[idx] = newNick;
                        else e.target.value = origNick;
                    } else if (!newNick) {
                        S.blockedNicks.splice(idx, 1);
                    } else {
                        e.target.value = origNick;
                    }
                    saveSettings();
                    renderList();
                    e.target.removeEventListener('blur', onBlur);
                    e.target.removeEventListener('keydown', onKey);
                };
                const onKey = (ev) => { if (ev.key === 'Enter') e.target.blur(); };
                e.target.addEventListener('blur', onBlur);
                e.target.addEventListener('keydown', onKey);
            }
        });

        if (typeof $ === 'function' && typeof $.fn.tip === 'function') {
            $(elEnabled).tip('Automatyczna akceptacja przywołania');
            $(elAddBtn).tip('Dodaj nick do czarnej listy');
        }

        renderList();
    }

    // ─── Lifecycle ────────────────────────────────────────────────────────────
    function addonInit() {
        loadSettings();
        enableLogic();
        if (!uiWindowElement) buildUI();
        if (uiWindowElement) uiWindowElement.style.display = S.windowVisible ? '' : 'none';
    }

    function addonStop() {
        disableLogic();
        if (uiWindowElement) { uiWindowElement.remove(); uiWindowElement = null; }
    }

    function onStateToggle(isEnabled) {
        S.enabled = isEnabled;
        if (uiWindowElement) {
            const cb  = uiWindowElement.querySelector("#ap-enabled");
            const sec = uiWindowElement.querySelector("#ap-blocked-section");
            if (cb)  cb.classList.toggle('active', isEnabled);
            if (sec) sec.style.display = isEnabled ? 'flex' : 'none';
        }
    }

    const checkApi = () => {
        if (!window.BaddonzAPI?.registerAddon) { setTimeout(checkApi, 500); return; }
        window.BaddonzAPI.registerAddon(ADDON_ID, { init: addonInit, stop: addonStop, onStateToggle });
    };
    checkApi();
})();
