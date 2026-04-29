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
        // Wszystkie wymiary i layout są teraz definiowane "w locie" w stylach (style="...")
        const bodyHtml = `
            <div class="baddonz-label-wrapper" style="justify-content: flex-start;">
                <div class="baddonz-checkbox ${currentSettings.enabled ? 'active' : ''}" id="ap-checkbox"></div>
                <div class="baddonz-text" style="padding: 0;">Auto Przywo</div>
            </div>

            <div id="ap-blocked-nicks-section" class="baddonz-flex column" style="gap: 5px; margin-top: 5px; display: ${currentSettings.enabled ? 'flex' : 'none'};">
                <hr style="width: 100%; border-color: #303030; margin: 0;">
                <div class="baddonz-text" style="padding: 0;">Nie akceptuj od:</div>
                
                <div class="baddonz-input-addbutton" style="display: flex; align-items: center; width: 100%;">
                    <input type="text" class="baddonz-input" id="ap-blocked-nick-input" placeholder="Wpisz nick" maxlength="20" style="flex-grow: 1; width: auto; height: 24px; border-top-right-radius: 0; border-bottom-right-radius: 0;">
                    <button class="baddonz-button" id="ap-add-nick-btn" style="flex-shrink: 0; width: 24px; height: 24px; padding: 0; margin: 0; border-top-left-radius: 0; border-bottom-left-radius: 0; display: flex; justify-content: center; align-items: center;">+</button>
                </div>
                
                <div class="baddonz-scroll" id="ap-blocked-nicks-list" style="overflow-y: auto; max-height: 120px; width: 100%; box-sizing: border-box; margin-top: 2px;"></div>
            </div>
        `;

        // Zgrabna szerokość okienka (195px)
        uiWindowElement = window.BaddonzAPI.createAddonWindow(ADDON_ID, "Auto Przywo", bodyHtml, { width: '195px' });

        const apCheckbox = uiWindowElement.querySelector("#ap-checkbox");
        const apBlockedNickInput = uiWindowElement.querySelector("#ap-blocked-nick-input");
        const apAddNickBtn = uiWindowElement.querySelector("#ap-add-nick-btn");
        const apBlockedNicksList = uiWindowElement.querySelector("#ap-blocked-nicks-list");
        const section = uiWindowElement.querySelector("#ap-blocked-nicks-section");

        const renderBlockedNicks = () => {
            apBlockedNicksList.innerHTML = '';
            currentSettings.blockedNicks.forEach((nick, index) => {
                const el = document.createElement('div');
                // Definicja ułożenia elementów na liście (rodzic relative, żeby X był na position absolute)
                el.style.cssText = `position: relative; width: 100%; display: flex; align-items: center; margin-bottom: 3px;`; 
                
                // padding-right: 22px jest kluczowe - odpycha tekst, żeby nie schował się pod guzikiem 'X'
                el.innerHTML = `
                    <input type="text" class="baddonz-input" value="${nick}" readonly data-index="${index}" maxlength="20" style="flex-grow: 1; height: 24px; padding: 2px 22px 2px 5px; width: 100%; box-sizing: border-box;">
                    <div class="baddonz-icon baddonz-close-button" data-index="${index}" title="Usuń z listy" style="position: absolute; right: 4px; top: 50%; transform: translateY(-50%); margin: 0; width: 12px; height: 12px; z-index: 2;"></div>
                `;
                apBlockedNicksList.appendChild(el);
            });
            // Dodajemy margines dla scrollbara, jeśli lista jest za długa
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
            if (e.target.classList.contains('baddonz-close-button')) {
                currentSettings.blockedNicks.splice(parseInt(e.target.dataset.index), 1);
                saveSettings(); renderBlockedNicks();
            }
        });

        apBlockedNicksList.addEventListener('click', (e) => {
            if (e.target.tagName === 'INPUT' && e.target.classList.contains('baddonz-input')) {
                const indexToEdit = parseInt(e.target.dataset.index);
                const originalNick = currentSettings.blockedNicks[indexToEdit];
                
                e.target.readOnly = false;
                e.target.focus();
                e.target.setSelectionRange(e.target.value.length, e.target.value.length);

                const handleBlur = () => {
                    e.target.readOnly = true;
                    const newNick = e.target.value.trim();
                    if (newNick && newNick.toLowerCase() !== originalNick.toLowerCase()) {
                        const isDuplicate = currentSettings.blockedNicks.some((n, i) => i !== indexToEdit && n.toLowerCase() === newNick.toLowerCase());
                        if (!isDuplicate) currentSettings.blockedNicks[indexToEdit] = newNick;
                        else e.target.value = originalNick;
                    } else if (!newNick) {
                        currentSettings.blockedNicks.splice(indexToEdit, 1);
                    } else {
                        e.target.value = originalNick;
                    }
                    saveSettings(); renderBlockedNicks();
                    e.target.removeEventListener('blur', handleBlur);
                    e.target.removeEventListener('keydown', handleKeyDown);
                };

                const handleKeyDown = (ev) => { if (ev.key === 'Enter') e.target.blur(); };
                e.target.addEventListener('blur', handleBlur);
                e.target.addEventListener('keydown', handleKeyDown);
            }
        });

        if (typeof $ === 'function' && typeof $.fn.tip === 'function') {
            $(apCheckbox).tip('Automatyczna akceptacja przywołania');
            $(apAddNickBtn).tip('Dodaj nick do czarnej listy');
        }

        renderBlockedNicks();
    }

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

    function onStateToggle(isEnabled) {
        currentSettings.enabled = isEnabled;
        if (uiWindowElement) {
            const apCheckbox = uiWindowElement.querySelector("#ap-checkbox");
            const section = uiWindowElement.querySelector("#ap-blocked-nicks-section");
            if (apCheckbox) {
                if (isEnabled) apCheckbox.classList.add('active');
                else apCheckbox.classList.remove('active');
            }
            if (section) section.style.display = isEnabled ? 'flex' : 'none';
        }
    }

    const checkApi = () => {
        if (!window.BaddonzAPI || !window.BaddonzAPI.registerAddon) {
            setTimeout(checkApi, 500); return;
        }
        window.BaddonzAPI.registerAddon(ADDON_ID, { 
            init: addonInit, 
            stop: addonStop,
            onStateToggle: onStateToggle
        });
    };
    
    checkApi();

})();
