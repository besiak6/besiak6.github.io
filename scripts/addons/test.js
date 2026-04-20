(function() {
    'use strict';

    const ADDON_ID = "AP";
    const PREF = ADDON_ID.toLowerCase(); // Prefix do ID html, np. "ap"
    
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
        // Wszystkie ID korzystają ze zmiennej ${PREF}, czyli np. id="ap-checkbox"
        const bodyHtml = `
            <div class="baddonz-label-wrapper" style="justify-content: flex-start; align-items: center; gap: 5px;">
                <div class="baddonz-checkbox ${currentSettings.enabled ? 'active' : ''}" id="${PREF}-checkbox"></div>
                <div class="baddonz-text" style="padding: 0;">Auto Przywo</div>
            </div>

            <div id="${PREF}-blocked-nicks-section" class="baddonz-flex column" style="gap: 5px; margin-top: 5px; display: ${currentSettings.enabled ? 'flex' : 'none'};">
                <hr style="width: 100%; border-color: #303030; margin: 0;">
                <div class="baddonz-text" style="padding: 0;">Nie akceptuj od:</div>
                <div class="baddonz-input-plus">
                    <input type="text" class="baddonz-input" id="${PREF}-blocked-nick-input" placeholder="Wpisz nick" maxlength="20">
                    <button class="baddonz-button" id="${PREF}-add-nick-btn">+</button>
                </div>
                <div class="baddonz-scroll" id="${PREF}-blocked-nicks-list" style="overflow-y: auto; max-height: 120px;"></div>
            </div>
        `;

        uiWindowElement = window.BaddonzAPI.createAddonWindow(ADDON_ID, "Auto Przywo", bodyHtml, { width: '210px' });

        const checkboxEl = uiWindowElement.querySelector(`#${PREF}-checkbox`);
        const blockedNickInput = uiWindowElement.querySelector(`#${PREF}-blocked-nick-input`);
        const addNickBtn = uiWindowElement.querySelector(`#${PREF}-add-nick-btn`);
        const blockedNicksList = uiWindowElement.querySelector(`#${PREF}-blocked-nicks-list`);
        const sectionEl = uiWindowElement.querySelector(`#${PREF}-blocked-nicks-section`);

        const renderBlockedNicks = () => {
            blockedNicksList.innerHTML = '';
            currentSettings.blockedNicks.forEach((nick, index) => {
                const el = document.createElement('div');
                el.style.cssText = `position: relative; width: 100%; display: flex; align-items: center; margin-bottom: 3px; padding-top: 2px;`;
                el.innerHTML = `<input type="text" class="baddonz-input ap-nick-display" value="${nick}" readonly data-index="${index}" maxlength="20"><span class="ap-remove-nick-x" data-index="${index}">&times;</span>`;
                blockedNicksList.appendChild(el);
            });
            blockedNicksList.style.paddingRight = (blockedNicksList.scrollHeight > blockedNicksList.clientHeight) ? '6px' : '0';
        };

        checkboxEl.addEventListener('click', () => {
            checkboxEl.classList.toggle('active');
            currentSettings.enabled = checkboxEl.classList.contains('active');
            sectionEl.style.display = currentSettings.enabled ? 'flex' : 'none';
            saveSettings();
        });

        addNickBtn.addEventListener('click', () => {
            const nick = blockedNickInput.value.trim();
            if (nick && !currentSettings.blockedNicks.some(n => n.toLowerCase() === nick.toLowerCase())) {
                currentSettings.blockedNicks.push(nick);
                blockedNickInput.value = '';
                saveSettings(); renderBlockedNicks();
                blockedNicksList.scrollTop = blockedNicksList.scrollHeight;
            }
        });

        blockedNicksList.addEventListener('click', (e) => {
            if (e.target.classList.contains('ap-remove-nick-x')) {
                currentSettings.blockedNicks.splice(parseInt(e.target.dataset.index), 1);
                saveSettings(); renderBlockedNicks();
            }
        });

        if (typeof $ === 'function' && typeof $.fn.tip === 'function') {
            $(checkboxEl).tip('Automatyczna akceptacja przywołania');
            $(addNickBtn).tip('Dodaj nick do czarnej listy');
        }

        renderBlockedNicks();
    }

    // --- CYKL ŻYCIA I WSPÓŁPRACA Z BADDONZ ---
    
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

    // Funkcja wywoływana, gdy ktoś kliknie Lewym Przyciskiem (LPM) na ikonkę w docku
    function addonToggle(isEnabled) {
        currentSettings.enabled = isEnabled;
        if (uiWindowElement) {
            const cb = uiWindowElement.querySelector(`#${PREF}-checkbox`);
            const sec = uiWindowElement.querySelector(`#${PREF}-blocked-nicks-section`);
            if (cb) cb.classList.toggle('active', isEnabled);
            if (sec) sec.style.display = isEnabled ? 'flex' : 'none';
        }
    }

    const checkApi = () => {
        if (!window.BaddonzAPI || !window.BaddonzAPI.registerAddon) {
            setTimeout(checkApi, 500); return;
        }
        window.BaddonzAPI.registerAddon(ADDON_ID, { 
            init: addonInit, 
            stop: addonStop,
            onToggle: addonToggle // Rejestrujemy funkcję do obsługi kliknięcia w docku
        });
    };
    checkApi();

})();
