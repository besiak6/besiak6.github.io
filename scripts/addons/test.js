// ==UserScript==
// @name          Auto Przywo
// @version       05.08.2025
// @author        besiak
// @match         https://*.margonem.pl/*
// @grant         none
// ==/UserScript==

(function() {
    'use strict';

    const ADDON_ID = "AP";
    let currentSettings = { enabled: true, windowOpacity: 2, windowVisible: true, blockedNicks: [] };
    
    let uiWindowElement = null;
    let originalAlert = null;

    function loadSettings() {
        if (window.BaddonzAPI) currentSettings = { ...currentSettings, ...window.BaddonzAPI.getAddonSettings(ADDON_ID) };
    }
    
    function saveSettings() {
        if (window.BaddonzAPI) window.BaddonzAPI.saveAddonSettings(ADDON_ID, currentSettings);
    }

    function enableLogic() {
        if (typeof mAlert !== 'undefined' && !originalAlert) {
            originalAlert = mAlert;
            mAlert = function () {
                if (currentSettings.enabled && arguments[0] !== undefined && typeof arguments[0] === 'string') {
                    const message = arguments[0];
                    if (message.includes("przyzywa do siebie swoją drużynę")) {
                        const nickMatch = message.match(/Gracz (.+?) przyzywa/);
                        if (nickMatch && nickMatch[1]) {
                            const summonedNick = nickMatch[1].trim();
                            const isBlocked = currentSettings.blockedNicks.some(bn => bn.toLowerCase() === summonedNick.toLowerCase());
                            if (isBlocked) return originalAlert.apply(this, arguments);
                        }

                        _g("party&a=acceptsummon&answer=1");
                        if (typeof closeModal === "function") closeModal();
                        return;
                    }
                }
                return originalAlert.apply(this, arguments);
            };
        }
    }

    function disableLogic() {
        if (originalAlert) {
            mAlert = originalAlert;
            originalAlert = null;
        }
    }

    function buildUI() {
        const bodyHtml = `
            <div class="baddonz-label-wrapper" style="justify-content: flex-start; align-items: center; gap: 5px;">
                <div class="baddonz-checkbox ${currentSettings.enabled ? 'active' : ''}" id="ap-checkbox"></div>
                <div class="baddonz-text" style="padding: 0;">Auto Przywo</div>
            </div>

            <div id="ap-blocked-nicks-section" class="baddonz-flex column" style="gap: 5px; margin-top: 5px; display: ${currentSettings.enabled ? 'flex' : 'none'};">
                <hr style="width: 100%; border-color: #303030; margin: 0;">
                <div class="baddonz-text" style="padding: 0;">Nie akceptuj od:</div>
                <div class="baddonz-input-plus">
                    <input type="text" class="baddonz-input" id="ap-blocked-nick-input" placeholder="Wpisz nick" maxlength="20">
                    <button class="baddonz-button" id="ap-add-nick-btn">+</button>
                </div>
                <div class="baddonz-scroll" id="ap-blocked-nicks-list" style="overflow-y: auto; max-height: 120px;"></div>
            </div>
        `;

        uiWindowElement = window.BaddonzAPI.createAddonWindow(ADDON_ID, "Auto Przywo", bodyHtml, { width: '210px' });

        const apCheckbox = uiWindowElement.querySelector("#ap-checkbox");
        const apBlockedNickInput = uiWindowElement.querySelector("#ap-blocked-nick-input");
        const apAddNickBtn = uiWindowElement.querySelector("#ap-add-nick-btn");
        const apBlockedNicksList = uiWindowElement.querySelector("#ap-blocked-nicks-list");
        const section = uiWindowElement.querySelector("#ap-blocked-nicks-section");

        const renderBlockedNicks = () => {
            apBlockedNicksList.innerHTML = '';
            currentSettings.blockedNicks.forEach((nick, index) => {
                const el = document.createElement('div');
                el.style.cssText = `position: relative; width: 100%; display: flex; align-items: center; margin-bottom: 3px; padding-top: 2px;`;
                el.innerHTML = `<input type="text" class="baddonz-input ap-nick-display" value="${nick}" readonly data-index="${index}" maxlength="20"><span class="ap-remove-nick-x" data-index="${index}">&times;</span>`;
                apBlockedNicksList.appendChild(el);
            });
            apBlockedNicksList.style.paddingRight = (apBlockedNicksList.scrollHeight > apBlockedNicksList.clientHeight) ? '6px' : '0';
        };

        apCheckbox.addEventListener('click', () => {
            apCheckbox.classList.toggle('active');
            currentSettings.enabled = apCheckbox.classList.contains('active');
            section.style.display = currentSettings.enabled ? 'flex' : 'none';
            saveSettings();
        });

        apAddNickBtn.addEventListener('click', () => {
            const nick = apBlockedNickInput.value.trim();
            if (nick && !currentSettings.blockedNicks.some(n => n.toLowerCase() === nick.toLowerCase())) {
                currentSettings.blockedNicks.push(nick);
                apBlockedNickInput.value = '';
                saveSettings(); renderBlockedNicks();
                apBlockedNicksList.scrollTop = apBlockedNicksList.scrollHeight;
            }
        });

        apBlockedNicksList.addEventListener('click', (e) => {
            if (e.target.classList.contains('ap-remove-nick-x')) {
                currentSettings.blockedNicks.splice(parseInt(e.target.dataset.index), 1);
                saveSettings(); renderBlockedNicks();
            }
        });

        if (typeof $ === 'function' && typeof $.fn.tip === 'function') {
            $(apCheckbox).tip('Automatyczna akceptacja przywołania');
            $(apAddNickBtn).tip('Dodaj nick do czarnej listy');
        }

        renderBlockedNicks();
    }

    // --- CYKL ŻYCIA I ZDARZENIA (API 2.0) ---
    function addonInit() {
        loadSettings();
        enableLogic();
        if (!uiWindowElement) buildUI();
    }

    function addonStop() {
        disableLogic(); 
        if (uiWindowElement) {
            uiWindowElement.remove(); 
            uiWindowElement = null;
        }
    }

    // Ta funkcja jest odpalana gdy ktoś kliknie Prawym Przyciskiem myszy na ikonkę w docku
    function onStateToggle(isEnabled) {
        currentSettings.enabled = isEnabled;
        
        // Jeśli okienko jest otwarte, od razu odświeżamy checkboxa
        if (uiWindowElement) {
            const apCheckbox = uiWindowElement.querySelector("#ap-checkbox");
            const section = uiWindowElement.querySelector("#ap-blocked-nicks-section");
            
            if (apCheckbox) {
                if (isEnabled) apCheckbox.classList.add('active');
                else apCheckbox.classList.remove('active');
            }
            if (section) {
                section.style.display = isEnabled ? 'flex' : 'none';
            }
        }
    }

    const checkApi = () => {
        if (!window.BaddonzAPI || !window.BaddonzAPI.registerAddon) {
            setTimeout(checkApi, 500); return;
        }
        window.BaddonzAPI.registerAddon(ADDON_ID, { 
            init: addonInit, 
            stop: addonStop,
            onStateToggle: onStateToggle // <--- Reaguje na kliknięcia z Docka
        });
    };
    
    checkApi();

})();
