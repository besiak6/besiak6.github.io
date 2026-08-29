(function() {
    'use strict';

    const ADDON_ID = "TROPH";
    const CHAR_SPECIFIC_KEYS = ['difficulty', 'rebitki'];

    let currentSettings = {
        enabled: true,
        difficulty: 'master',
        rebitki: false,
        windowOpacity: 2,
        windowVisible: true,
        isExpanded: false
    };

    const DIFF_CODES = {
        'normal': '78.1',
        'hard': '78.2',
        'master': '78.3'
    };

    let uiMainWindow = null;
    let intervalId = null;
    let currencyIntervalId = null;
    let isProcessing = false;
    let lastInteractedId = null;
    let interactionCooldown = 0;

    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const _originalParse = JSON.parse;
    let latestAskToken = null;

    const hookedParse = function(text, reviver) {
        if (typeof text === 'string' && text.includes('answer')) {
            const match = text.match(/(answer[a-zA-Z0-9]+)/);
            if (match) {
                latestAskToken = match[1];
            }
        }
        return _originalParse.call(this, text, reviver);
    };
    hookedParse.toString = function() { return _originalParse.toString(); };
    JSON.parse = hookedParse;

    function getStoneCount() {
        let count = 0;
        if (!window.Engine || !window.Engine.items) return 0;
        const items = window.Engine.items.fetchLocationItems("g");
        for (const id in items) {
            const item = items[id];
            if (item && item.name === "Kamień runiczny walecznych") {
                let amt = 1;
                if (item._cachedStats && item._cachedStats.amount !== undefined) {
                    amt = parseInt(item._cachedStats.amount, 10);
                } else if (item.amount !== undefined) {
                    amt = parseInt(item.amount, 10);
                }
                if (!isNaN(amt)) count += amt;
            }
        }
        return count;
    }

    function updateCurrencyDisplay() {
        const countElem = document.getElementById('troph-currency-count');
        if (countElem) countElem.textContent = getStoneCount();
    }

    function closeAskAlertWindow() {
        try {
            if (!window.Engine || !window.Engine.windowManager) return;
            const list = window.Engine.windowManager.getList();
            for (const windowType in list) {
                const windowsGroup = list[windowType];
                for (const id in windowsGroup) {
                    const wnd = windowsGroup[id];
                    if (wnd && wnd.$ && wnd.$.hasClass('askAlert')) {
                        if (typeof wnd.close === 'function') {
                            wnd.close();
                            return;
                        }
                    }
                }
            }
        } catch (err) {}
    }

    async function tryEnterCrypt() {
        if (!currentSettings.enabled || isProcessing) return;
        if (Date.now() > interactionCooldown) lastInteractedId = null;
        if (!window.Engine || !window.Engine.allInit || !window.Engine.npcs || !window.Engine.hero) return;

        const npcs = window.Engine.npcs.check();
        if (!npcs) return;

        for (let npcId in npcs) {
            const npc = npcs[npcId];
            if (!npc || !npc.d || npc.d.nick !== "Wejście do krypty") continue;
            if (lastInteractedId === npcId) continue;

            const distanceX = Math.abs(window.Engine.hero.d.x - npc.d.x);
            const distanceY = Math.abs(window.Engine.hero.d.y - npc.d.y);

            if (distanceX <= 1 && distanceY <= 1) {
                isProcessing = true;
                lastInteractedId = npcId;
                interactionCooldown = Date.now() + 15000;

                try {
                    latestAskToken = null;

                    window._g(`talk&id=${npcId}`);
                    await delay(400);

                    window._g(`talk&id=${npcId}&c=20.1`);

                    let waited = 0;
                    while (!latestAskToken && waited < 3000) {
                        await delay(100);
                        waited += 100;
                    }

                    if (latestAskToken) {
                        window._g(`talk&${latestAskToken}=0`);
                        latestAskToken = null;
                        closeAskAlertWindow();
                        await delay(500); // czas na odrobienie zamknięcia
                    }

                    await delay(450); // bufer przed wyborem trudności

                    const diffCode = DIFF_CODES[currentSettings.difficulty] || DIFF_CODES['master'];
                    window._g(`talk&id=${npcId}&c=${diffCode}`);
                } catch (e) {
                    lastInteractedId = null;
                } finally {
                    isProcessing = false;
                }
                break;
            }
        }
    }

    function loadSettings() {
        if (!window.BaddonzAPI) return;
        const saved = window.BaddonzAPI.getAddonSettings(ADDON_ID);
        if (saved) currentSettings = { ...currentSettings, ...saved };
    }

    function saveSettings() {
        if (!window.BaddonzAPI) return;
        window.BaddonzAPI.saveAddonSettings(ADDON_ID, { ...currentSettings }, CHAR_SPECIFIC_KEYS);
    }

    function startScript() {
        if (intervalId) clearInterval(intervalId);
        intervalId = setInterval(tryEnterCrypt, 800);
    }

    function stopScript() {
        if (intervalId) { clearInterval(intervalId); intervalId = null; }
    }

    function buildUI() {
        const mainBodyHtml = `
            <div class="baddonz-setting-row" style="margin-bottom: 8px; justify-content: center; font-weight: bold; color: #f5da55; text-shadow: 1px 1px 2px #000;">
                Ilość waluty: <span id="troph-currency-count" style="margin-left: 5px;">0</span>
            </div>
            <div class="baddonz-setting-row" style="margin-bottom: 5px;">
                <div class="baddonz-checkbox troph-enabled-checkbox ${currentSettings.enabled ? 'active' : ''}"></div>
                <span class="baddonz-label baddonz-text">Włączony</span>
            </div>
            <div class="baddonz-setting-row" style="margin-bottom: 5px;">
                <span class="baddonz-label baddonz-text" style="padding:0; margin-right:5px;">Poziom:</span>
                <select class="baddonz-input baddonz-select troph-difficulty-select" style="flex-grow:1;">
                    <option value="normal" ${currentSettings.difficulty === 'normal' ? 'selected' : ''}>Łatwy</option>
                    <option value="hard" ${currentSettings.difficulty === 'hard' ? 'selected' : ''}>Trudny</option>
                    <option value="master" ${currentSettings.difficulty === 'master' ? 'selected' : ''}>Mistrz</option>
                </select>
            </div>
            <div class="baddonz-setting-row">
                <div class="baddonz-checkbox troph-rebitki-checkbox ${currentSettings.rebitki ? 'active' : ''}"></div>
                <span class="baddonz-label baddonz-text">Rebitki</span>
            </div>
        `;

        uiMainWindow = window.BaddonzAPI.createAddonWindow(ADDON_ID, "Wchodzenie", mainBodyHtml, {
            width: '140px',
            customId: 'baddonz-troph-wnd',
            hasSettings: false,
            hasCollapse: false,
            hasClose: true
        });

        updateCurrencyDisplay();

        const enabledCheckbox = uiMainWindow.querySelector('.troph-enabled-checkbox');
        const difficultySelect = uiMainWindow.querySelector('.troph-difficulty-select');
        const rebitkiCheckbox = uiMainWindow.querySelector('.troph-rebitki-checkbox');
        const closeBtn = uiMainWindow.querySelector('.baddonz-close');

        enabledCheckbox.addEventListener('click', () => {
            currentSettings.enabled = enabledCheckbox.classList.toggle('active');
            saveSettings();
            if (currentSettings.enabled) startScript(); else stopScript();
        });

        rebitkiCheckbox.addEventListener('click', () => {
            currentSettings.rebitki = rebitkiCheckbox.classList.toggle('active');
            saveSettings();
        });

        difficultySelect.addEventListener('change', (e) => {
            currentSettings.difficulty = e.target.value;
            saveSettings();
        });

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                currentSettings.windowVisible = false;
                saveSettings();
                if (uiMainWindow) uiMainWindow.style.display = 'none';
            });
        }
    }

    function addonInit() {
        loadSettings();
        if (!uiMainWindow) buildUI();
        if (uiMainWindow) {
            uiMainWindow.style.display = currentSettings.windowVisible ? '' : 'none';
        }
        if (currentSettings.enabled) startScript();
        if (currencyIntervalId) clearInterval(currencyIntervalId);
        currencyIntervalId = setInterval(updateCurrencyDisplay, 1000);
    }

    function addonStop() {
        stopScript();
        if (currencyIntervalId) { clearInterval(currencyIntervalId); currencyIntervalId = null; }
        if (uiMainWindow) { uiMainWindow.remove(); uiMainWindow = null; }
    }

    function onStateToggle(isEnabled) {
        currentSettings.enabled = isEnabled;
        saveSettings();
        if (isEnabled) startScript(); else stopScript();
        if (uiMainWindow) {
            const enabledCheckbox = uiMainWindow.querySelector('.troph-enabled-checkbox');
            if (enabledCheckbox) enabledCheckbox.classList.toggle('active', isEnabled);
            if (isEnabled && !currentSettings.windowVisible) {
                currentSettings.windowVisible = true;
                uiMainWindow.style.display = '';
                saveSettings();
            }
        }
    }

    const checkApi = () => {
        if (!window.BaddonzAPI?.registerAddon) { setTimeout(checkApi, 500); return; }
        window.BaddonzAPI.registerAddon(ADDON_ID, { init: addonInit, stop: addonStop, onStateToggle });
    };
    checkApi();
})();
