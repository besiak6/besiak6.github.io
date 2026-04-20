(function() {
    'use strict';

    const ADDON_ID = "AP";
    const pfx = ADDON_ID.toLowerCase(); // Wygodny prefiks do ID w HTML (daje np. "ap")
    
    const DEFAULT_SETTINGS = { enabled: true, windowOpacity: 2, windowVisible: true, blockedNicks: [] };
    let currentSettings = { ...DEFAULT_SETTINGS };
    
    let uiWindowElement = null;
    let originalAlert = null;

    function loadSettings() {
        if (window.BaddonzAPI) currentSettings = { ...DEFAULT_SETTINGS, ...window.BaddonzAPI.getAddonSettings(ADDON_ID) };
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
                <div class="baddonz-checkbox ${currentSettings.enabled ? 'active' : ''}" id="${pfx}-checkbox"></div>
                <div class="baddonz-text" style="padding: 0;">Auto Przywo</div>
            </div>

            <div id="${pfx}-blocked-nicks-section" class="baddonz-flex column" style="gap: 5px; margin-top: 5px; display: ${currentSettings.enabled ? 'flex' : 'none'};">
                <hr style="width: 100%; border-color: #303030; margin: 0;">
                <div class="baddonz-text" style="padding: 0;">Nie akceptuj od:</div>
                <div class="baddonz-input-plus">
                    <input type="text" class="baddonz-input" id="${pfx}-blocked-nick-input" placeholder="Wpisz nick" maxlength="20">
                    <button class="baddonz-button" id="${pfx}-add-nick-btn">+</button>
                </div>
                <div class="baddonz-scroll" id="${pfx}-blocked-nicks-list" style="overflow-y: auto; max-height: 120px;"></div>
            </div>
        `;

        uiWindowElement = window.BaddonzAPI.createAddonWindow(ADDON_ID, "Auto Przywo", bodyHtml, { width: '210px' });

        const apCheckbox = uiWindowElement.querySelector(`#${pfx}-checkbox`);
        const apBlockedNickInput = uiWindowElement.querySelector(`#${pfx}-blocked-nick-input`);
        const apAddNickBtn = uiWindowElement.querySelector(`#${pfx}-add-nick-btn`);
        const apBlockedNicksList = uiWindowElement.querySelector(`#${pfx}-blocked-nicks-list`);
        const section = uiWindowElement.querySelector(`#${pfx}-blocked-nicks-section`);

        const renderBlockedNicks = () => {
            apBlockedNicksList.innerHTML = '';
            currentSettings.blockedNicks.forEach((nick, index) => {
                const el = document.createElement('div');
                el.style.cssText = `position: relative; width: 100%; display: flex; align-items: center; margin-bottom: 3px; padding-top: 2px;`;
                el.innerHTML = `<input type="text" class="baddonz-input ${pfx}-nick-display" value="${nick}" readonly data-index="${index}" maxlength="20"><span class="${pfx}-remove-nick-x" data-index="${index}" style="cursor:pointer; color:red; margin-left:5px;">&times;</span>`;
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
            if (e.target.classList.contains(`${pfx}-remove-nick-x`)) {
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

    // --- Odbieranie sygnałów od Docka (PPM) ---
    window.addEventListener(`baddonz-updated-${ADDON_ID}`, (e) => {
        currentSettings = e.detail;
        if(uiWindowElement) {
            const chk = uiWindowElement.querySelector(`#${pfx}-checkbox`);
            const sec = uiWindowElement.querySelector(`#${pfx}-blocked-nicks-section`);
            if(chk) {
                if (currentSettings.enabled) chk.classList.add('active');
                else chk.classList.remove('active');
            }
            if(sec) {
                sec.style.display = currentSettings.enabled ? 'flex' : 'none';
            }
        }
    });

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

    const checkApi = () => {
        if (!window.BaddonzAPI || !window.BaddonzAPI.registerAddon) {
            setTimeout(checkApi, 500); return;
        }
        window.BaddonzAPI.registerAddon(ADDON_ID, { init: addonInit, stop: addonStop });
    };
    checkApi();

})();
