// ==UserScript==
// @name          ulepszator baddonz (API & Style Refactor)
// @version       1.0.0
// @author        besiak & Gemini
// @match         https://*.margonem.pl/
// @grant         none
// ==/UserScript==

(function () {
    'use strict';

    const MICC_BASE_URL = 'https://micc.garmory-cdn.cloud/obrazki/itemy/';

    const SETTINGS_KEY_ACCOUNT = "baddonz-settings-upgrader-account";
    const SETTINGS_KEY_CHARACTER = "baddonz-settings-upgrader-character";
    const DAILY_COUNT_KEY = "baddonz-daily-upgrade-count";
    const PROGRESS_STORAGE_KEY = "baddonz-enhancement-progress-char";
    const VISIBILITY_CHECK_INTERVAL = 100;

    const DEFAULT_ACCOUNT_SETTINGS = {
        wnd_pos: { left: '300px', top: '200px' },
        wnd_opacity: 2,
        wnd_vsb: true,
        wnd_clp: false,
        wnd_settings_pos: { left: '400px', top: '250px' },
        wnd_settings_vsb: false,
        wnd_settings_opacity: 2,
        hotkeyKey: "j",
    };

    const DEFAULT_CHARACTER_SETTINGS = {
        enabled: true,
        hotkeyEnabled: true,
        autoMode: false,
        maxUpgradesPerRun: 10,
        stopOnCompleted: true,
        reagentTier: 1,
        selectedItems: [],
        dailyLimit: 0,
    };

    let accountSettings = { ...DEFAULT_ACCOUNT_SETTINGS };
    let characterSettings = { ...DEFAULT_CHARACTER_SETTINGS };
    let dailyUpgradeCount = 0;
    let cachedProgress = {};

    let isRunning = false;
    let shouldStop = false;
    let currentItemIndex = 0;
    let upgradesInCurrentRun = 0;

    let $mainWindow = null;
    let $settingsWindow = null;

    // --- INTEGRACJA Z BADDONZ API ---
    const initBaddonzAPI = () => {
        if (!window.BaddonzAPI) window.BaddonzAPI = {};
        if (!window.BaddonzAPI.addons) window.BaddonzAPI.addons = {};

        window.BaddonzAPI.addons.upgrader = {
            name: "Ulepszator",
            version: "1.0.0",
            status: () => isRunning ? "running" : "idle",
            toggle: () => toggleUpgrader(),
            getSettings: () => ({ account: accountSettings, character: characterSettings }),
            stop: () => { shouldStop = true; isRunning = false; updateUI(); }
        };
    };

    // --- ŁADOWANIE I ZAPIS USTAWIEŃ ---
    const loadSettings = () => {
        try {
            const acc = localStorage.getItem(SETTINGS_KEY_ACCOUNT);
            if (acc) accountSettings = { ...DEFAULT_ACCOUNT_SETTINGS, ...JSON.parse(acc) };

            const charKey = `${SETTINGS_KEY_CHARACTER}_${getCharId()}`;
            const char = localStorage.getItem(charKey);
            if (char) characterSettings = { ...DEFAULT_CHARACTER_SETTINGS, ...JSON.parse(char) };

            const progressKey = `${PROGRESS_STORAGE_KEY}_${getCharId()}`;
            const prog = localStorage.getItem(progressKey);
            if (prog) cachedProgress = JSON.parse(prog);

            const dailyKey = `${DAILY_COUNT_KEY}_${getCharId()}_${getTodayDateString()}`;
            const daily = localStorage.getItem(dailyKey);
            if (daily) dailyUpgradeCount = parseInt(daily, 10) || 0;
        } catch (e) {
            console.error("[Ulepszator Baddonz] Błąd ładowania ustawień:", e);
        }
    };

    const saveAccountSettings = () => {
        localStorage.setItem(SETTINGS_KEY_ACCOUNT, JSON.stringify(accountSettings));
    };

    const saveCharacterSettings = () => {
        const charKey = `${SETTINGS_KEY_CHARACTER}_${getCharId()}`;
        localStorage.setItem(charKey, JSON.stringify(characterSettings));
    };

    const saveDailyCount = () => {
        const dailyKey = `${DAILY_COUNT_KEY}_${getCharId()}_${getTodayDateString()}`;
        localStorage.setItem(dailyKey, dailyUpgradeCount.toString());
    };

    const saveProgress = (itemId, progressText) => {
        cachedProgress[itemId] = { text: progressText, ts: Date.now() };
        const progressKey = `${PROGRESS_STORAGE_KEY}_${getCharId()}`;
        localStorage.setItem(progressKey, JSON.stringify(cachedProgress));
    };

    // --- FUNKCJE POMOCNICZE ---
    const getCharId = () => (window.Engine && window.Engine.hero && window.Engine.hero.d && window.Engine.hero.d.id) || "default";
    const getTodayDateString = () => new Date().toISOString().split('T')[0];

    const getHeroItems = () => {
        if (!window.Engine || !window.Engine.heroEquipment || !window.Engine.heroEquipment.getInvItems) return [];
        const itemsObj = window.Engine.heroEquipment.getInvItems();
        return Object.values(itemsObj);
    };

    const getReagentsFromBag = (tier) => {
        const items = getHeroItems();
        return items.filter(item => {
            if (!item || !item.name) return false;
            const isReagent = item.name.includes("Amulet ulepszenia") || item.name.includes("Talizman ulepszenia");
            if (!isReagent) return false;
            if (tier === 1) return item.name.includes("I");
            if (tier === 2) return item.name.includes("II");
            if (tier === 3) return item.name.includes("III");
            if (tier === 4) return item.name.includes("IV");
            return false;
        }).sort((a, b) => b.id - a.id);
    };

    const logToWidget = (msg) => {
        if ($mainWindow) {
            $mainWindow.find(".upgrader-status-text").text(msg);
        }
    };

    // --- INTERFEJS UŻYTKOWNIKA (ZGODNY ZE STYLAMI BADDONZ) ---
    const createUI = () => {
        if ($mainWindow) $mainWindow.remove();

        const html = `
            <div id="baddonz-upgrader-window" class="baddonz-window" data-opacity-lvl="${accountSettings.wnd_opacity}" style="position: absolute; left: ${accountSettings.wnd_pos.left}; top: ${accountSettings.wnd_pos.top}; z-index: 25000; width: 260px; display: ${accountSettings.wnd_vsb ? 'block' : 'none'};">
                <div class="baddonz-window-header baddonz-flex centered between">
                    <div class="baddonz-window-title">Ulepszator Baddonz</div>
                    <div class="baddonz-flex centered" style="gap: 6px;">
                        <div class="baddonz-icon upgrader-btn-settings" title="Ustawienia" style="font-size: 14px;">⚙️</div>
                        <div class="baddonz-icon upgrader-btn-opacity" title="Zmień przezroczystość" style="font-size: 14px;">👁️</div>
                        <div class="baddonz-icon upgrader-btn-close" title="Zamknij" style="font-size: 14px;">❌</div>
                    </div>
                </div>
                <div class="baddonz-window-body baddonz-scroll" style="padding: 8px; max-height: 400px;">
                    <div class="baddonz-setting-row baddonz-flex between centered" style="margin-bottom: 8px;">
                        <span style="font-weight: bold; color: #dfdfdf;">Status:</span>
                        <span class="upgrader-status-text" style="color: #66ff66;">Oczekiwanie</span>
                    </div>
                    <div class="baddonz-setting-row baddonz-flex between centered" style="margin-bottom: 8px;">
                        <span>Dziś ulepszono:</span>
                        <span class="upgrader-daily-count" style="font-weight: bold;">${dailyUpgradeCount}</span>
                    </div>
                    <div class="baddonz-flex centered" style="gap: 8px; margin-bottom: 10px;">
                        <button class="baddonz-button upgrader-btn-toggle" style="flex: 1; padding: 5px 0;">START</button>
                        <button class="baddonz-button upgrader-btn-refresh" style="padding: 5px 10px;" title="Odśwież ekwipunek">🔄</button>
                    </div>
                    <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 6px;">
                        <div style="font-size: 11px; color: #aaa; margin-bottom: 4px; text-align: center;">Kolejka przedmiotów (Zaznacz aby ulepszać):</div>
                        <div class="upgrader-items-list baddonz-scroll" style="max-height: 180px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px;"></div>
                    </div>
                </div>
            </div>
        `;

        $mainWindow = $(html).appendTo("body");
        bindWindowEvents();
        updateItemsList();
        updateUI();
    };

    const createSettingsUI = () => {
        if ($settingsWindow) $settingsWindow.remove();

        const html = `
            <div id="baddonz-upgrader-settings-window" class="baddonz-window" data-opacity-lvl="${accountSettings.wnd_settings_opacity}" style="position: absolute; left: ${accountSettings.wnd_settings_pos.left}; top: ${accountSettings.wnd_settings_pos.top}; z-index: 25001; width: 280px; display: ${accountSettings.wnd_settings_vsb ? 'block' : 'none'};">
                <div class="baddonz-window-header baddonz-flex centered between">
                    <div class="baddonz-window-title">Ustawienia Ulepszatora</div>
                    <div class="baddonz-icon upgrader-settings-close" title="Zamknij">❌</div>
                </div>
                <div class="baddonz-window-body baddonz-scroll" style="padding: 10px; font-size: 12px; max-height: 450px;">
                    <div class="baddonz-setting-row baddonz-flex between centered">
                        <label for="upgrader-opt-enabled">Włączony dodatek:</label>
                        <input type="checkbox" id="upgrader-opt-enabled" class="baddonz-checkbox" ${characterSettings.enabled ? 'checked' : ''}>
                    </div>
                    <div class="baddonz-setting-row baddonz-flex between centered">
                        <label for="upgrader-opt-hotkey">Skrót klawiszowy aktywacji:</label>
                        <input type="checkbox" id="upgrader-opt-hotkey" class="baddonz-checkbox" ${characterSettings.hotkeyEnabled ? 'checked' : ''}>
                    </div>
                    <div class="baddonz-setting-row baddonz-flex between centered">
                        <label for="upgrader-opt-key">Klawisz skrótu:</label>
                        <input type="text" id="upgrader-opt-key" class="baddonz-input keybind" value="${accountSettings.hotkeyKey}" style="width: 40px; text-align: center;">
                    </div>
                    <div class="baddonz-setting-row baddonz-flex between centered">
                        <label for="upgrader-opt-auto">Tryb automatyczny pętli:</label>
                        <input type="checkbox" id="upgrader-opt-auto" class="baddonz-checkbox" ${characterSettings.autoMode ? 'checked' : ''}>
                    </div>
                    <div class="baddonz-setting-row baddonz-flex between centered">
                        <label for="upgrader-opt-stop-comp">Zatrzymaj gdy 100%:</label>
                        <input type="checkbox" id="upgrader-opt-stop-comp" class="baddonz-checkbox" ${characterSettings.stopOnCompleted ? 'checked' : ''}>
                    </div>
                    <div class="baddonz-setting-row baddonz-flex between centered">
                        <label for="upgrader-opt-tier">Tier używanych reagentów:</label>
                        <select id="upgrader-opt-tier" class="baddonz-input" style="width: 80px; height: 22px; padding: 0 4px;">
                            <option value="1" ${characterSettings.reagentTier === 1 ? 'selected' : ''}>Tier I</option>
                            <option value="2" ${characterSettings.reagentTier === 2 ? 'selected' : ''}>Tier II</option>
                            <option value="3" ${characterSettings.reagentTier === 3 ? 'selected' : ''}>Tier III</option>
                            <option value="4" ${characterSettings.reagentTier === 4 ? 'selected' : ''}>Tier IV</option>
                        </select>
                    </div>
                    <div class="baddonz-setting-row baddonz-flex between centered">
                        <label for="upgrader-opt-max">Max ulepszeń na kliknięcie:</label>
                        <input type="number" id="upgrader-opt-max" class="baddonz-input" value="${characterSettings.maxUpgradesPerRun}" min="1" max="100" style="width: 50px; text-align: center;">
                    </div>
                    <div class="baddonz-setting-row baddonz-flex between centered">
                        <label for="upgrader-opt-daily">Dzienny limit ulepszeń (0=brak):</label>
                        <input type="number" id="upgrader-opt-daily" class="baddonz-input" value="${characterSettings.dailyLimit}" min="0" max="1000" style="width: 50px; text-align: center;">
                    </div>
                    <div style="margin-top: 12px; text-align: center;">
                        <button class="baddonz-button upgrader-settings-save" style="width: 100%; padding: 6px 0; font-weight: bold;">ZAPISZ USTAWIENIA</button>
                    </div>
                </div>
            </div>
        `;

        $settingsWindow = $(html).appendTo("body");
        bindSettingsEvents();
    };

    const updateItemsList = () => {
        if (!$mainWindow) return;
        const $list = $mainWindow.find(".upgrader-items-list");
        $list.empty();

        const items = getHeroItems();
        const upgradeable = items.filter(item => item && item.cl && (item.cl >= 1 && item.cl <= 14 || item.cl === 21 || item.cl === 22));

        if (upgradeable.length === 0) {
            $list.append('<div style="text-align:center; padding: 10px; color:#777; font-size:11px;">Brak przedmiotów w torbie</div>');
            return;
        }

        upgradeable.forEach(item => {
            const isChecked = characterSettings.selectedItems.includes(item.id);
            const cached = cachedProgress[item.id];
            const progressDisplay = cached ? cached.text : "Brak danych";

            const rowHtml = `
                <div class="baddonz-setting-row baddonz-flex between centered" style="padding: 4px; background: rgba(255,255,255,0.03); border-radius: 3px; margin: 0;">
                    <div class="baddonz-flex centered" style="gap: 6px; flex: 1; overflow: hidden;">
                        <input type="checkbox" class="baddonz-checkbox item-queue-checkbox" data-id="${item.id}" ${isChecked ? 'checked' : ''}>
                        <img src="${MICC_BASE_URL}${item.icon}" style="width: 24px; height: 24px; background: rgba(0,0,0,0.4); border-radius: 2px; border: 1px solid rgba(255,255,255,0.1);" err="0">
                        <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 11px; color: #ccc;" title="${item.name}">${item.name}</span>
                    </div>
                    <span style="font-size: 10px; color: #aaa; background: rgba(0,0,0,0.3); padding: 2px 4px; border-radius: 3px; min-width: 40px; text-align: center;" class="item-progress-badge" data-id="${item.id}">${progressDisplay}</span>
                </div>
            `;
            const $row = $(rowHtml).appendTo($list);

            $row.find(".item-queue-checkbox").on("change", function () {
                const id = parseInt($(this).attr("data-id"), 10);
                if (this.checked) {
                    if (!characterSettings.selectedItems.includes(id)) characterSettings.selectedItems.push(id);
                } else {
                    characterSettings.selectedItems = characterSettings.selectedItems.filter(x => x !== id);
                }
                saveCharacterSettings();
            });
        });
    };

    const updateUI = () => {
        if (!$mainWindow) return;
        $mainWindow.find(".upgrader-daily-count").text(dailyUpgradeCount);

        const $btn = $mainWindow.find(".upgrader-btn-toggle");
        if (isRunning) {
            $btn.text("STOP").css("background", "radial-gradient(ellipse at center, #ff3333, #101010)").addClass("baddonz-state-button--active");
            logToWidget(`Ulepszanie... (${upgradesInCurrentRun}/${characterSettings.maxUpgradesPerRun})`);
        } else {
            $btn.text("START").css("background", "").removeClass("baddonz-state-button--active");
            logToWidget(shouldStop ? "Zatrzymano przez użytkownika" : "Oczekiwanie");
        }
    };

    // --- OBSŁUGA DRAG & DROP OKIEN BADDONZ ---
    const makeDraggable = ($el, handleSelector) => {
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        $el.find(handleSelector).css("cursor", "move").on("mousedown", function (e) {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            initialLeft = parseInt($el.css("left"), 10) || 0;
            initialTop = parseInt($el.css("top"), 10) || 0;
            e.preventDefault();
        });

        $(document).on("mousemove", function (e) {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            $el.css({
                left: (initialLeft + dx) + "px",
                top: (initialTop + dy) + "px"
            });
        }).on("mouseup", function () {
            if (!isDragging) return;
            isDragging = false;
            if ($el.attr("id") === "baddonz-upgrader-window") {
                accountSettings.wnd_pos = { left: $el.css("left"), top: $el.css("top") };
                saveAccountSettings();
            } else if ($el.attr("id") === "baddonz-upgrader-settings-window") {
                accountSettings.wnd_settings_pos = { left: $el.css("left"), top: $el.css("top") };
                saveAccountSettings();
            }
        });
    };

    const bindWindowEvents = () => {
        makeDraggable($mainWindow, ".baddonz-window-header");

        $mainWindow.find(".upgrader-btn-settings").on("click", () => {
            accountSettings.wnd_settings_vsb = !accountSettings.wnd_settings_vsb;
            saveAccountSettings();
            if ($settingsWindow) $settingsWindow.toggle(accountSettings.wnd_settings_vsb);
        });

        $mainWindow.find(".upgrader-btn-opacity").on("click", () => {
            accountSettings.wnd_opacity = (accountSettings.wnd_opacity + 1) % 5;
            saveAccountSettings();
            $mainWindow.attr("data-opacity-lvl", accountSettings.wnd_opacity);
        });

        $mainWindow.find(".upgrader-btn-close").on("click", () => {
            accountSettings.wnd_vsb = false;
            saveAccountSettings();
            $mainWindow.hide();
        });

        $mainWindow.find(".upgrader-btn-toggle").on("click", () => {
            toggleUpgrader();
        });

        $mainWindow.find(".upgrader-btn-refresh").on("click", () => {
            updateItemsList();
            messageHandler("Zaktualizowano listę przedmiotów z torby.");
        });
    };

    const bindSettingsEvents = () => {
        makeDraggable($settingsWindow, ".baddonz-window-header");

        $settingsWindow.find(".upgrader-settings-close").on("click", () => {
            accountSettings.wnd_settings_vsb = false;
            saveAccountSettings();
            $settingsWindow.hide();
        });

        $settingsWindow.find(".upgrader-settings-save").on("click", () => {
            characterSettings.enabled = $settingsWindow.find("#upgrader-opt-enabled").is(":checked");
            characterSettings.hotkeyEnabled = $settingsWindow.find("#upgrader-opt-hotkey").is(":checked");
            characterSettings.autoMode = $settingsWindow.find("#upgrader-opt-auto").is(":checked");
            characterSettings.stopOnCompleted = $settingsWindow.find("#upgrader-opt-stop-comp").is(":checked");
            characterSettings.reagentTier = parseInt($settingsWindow.find("#upgrader-opt-tier").val(), 10);
            characterSettings.maxUpgradesPerRun = parseInt($settingsWindow.find("#upgrader-opt-max").val(), 10) || 10;
            characterSettings.dailyLimit = parseInt($settingsWindow.find("#upgrader-opt-daily").val(), 10) || 0;

            const newKey = $settingsWindow.find("#upgrader-opt-key").val().trim().toLowerCase();
            if (newKey) accountSettings.hotkeyKey = newKey;

            saveAccountSettings();
            saveCharacterSettings();
            messageHandler("Ustawienia zostały pomyślnie zapisane.");
            $settingsWindow.hide();
            accountSettings.wnd_settings_vsb = false;
            saveAccountSettings();
        });
    };

    const messageHandler = (msg) => {
        if (window.BaddonzAPI && window.BaddonzAPI.showNotification) {
            window.BaddonzAPI.showNotification(msg);
        } else if (window.message) {
            window.message(msg);
        } else {
            console.log("[Ulepszator Baddonz]", msg);
        }
    };

    // --- LOGIKA AUTOMATYZACJI ULEPSZANIA (SILNIK PROMISÓW) ---
    const getEnhancementProgressText = () => {
        const $view = $(".enhancement-window-view");
        if ($view.length === 0) return "Brak danych";
        const text = $view.find(".progress-preview-value-container").text().trim();
        return text || "Brak danych";
    };

    const previewUpgrade = (itemId) => {
        return new Promise((resolve) => {
            _g(`enhancement&action=progress_preview&item=${itemId}`, (data) => {
                let isCompleted = false;
                let max = 0, current = 0;

                if (data && data.enhancement && data.enhancement.itemProgress) {
                    const progress = data.enhancement.itemProgress[itemId];
                    if (progress) {
                        current = progress.currentPoints || 0;
                        max = progress.maxPoints || 0;
                        if (max > 0 && current >= max) isCompleted = true;
                    }
                }

                setTimeout(() => {
                    const progressText = getEnhancementProgressText();
                    if (progressText !== "Brak danych") {
                        saveProgress(itemId, progressText);
                    } else if (isCompleted) {
                        saveProgress(itemId, `${max}/${max}`);
                    }
                    updateItemsList();
                    resolve({ current, max, isCompleted });
                }, 300);
            });
        });
    };

    const setReagents = (itemId, reagentIds) => {
        const reagents = reagentIds.join(",");
        return new Promise((resolve) => {
            _g(`enhancement&action=progress_preview&item=${itemId}&ingredients=${reagents}`, (data) => resolve(data));
        });
    };

    const enhanceItem = (itemId, reagentIds) => {
        if (!itemId || !reagentIds) return;
        const reagents = reagentIds.join(",");
        return new Promise((resolve) => {
            _g(`enhancement&action=progress&item=${itemId}&ingredients=${reagents}`, (data) => resolve(data));
        });
    };

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const toggleUpgrader = () => {
        if (!characterSettings.enabled) {
            messageHandler("Dodatek jest wyłączony w ustawieniach postaci!");
            return;
        }

        if (isRunning) {
            shouldStop = true;
            isRunning = false;
            updateUI();
        } else {
            if (characterSettings.selectedItems.length === 0) {
                messageHandler("Nie zaznaczono żadnych przedmiotów do ulepszania!");
                return;
            }
            isRunning = true;
            shouldStop = false;
            upgradesInCurrentRun = 0;
            currentItemIndex = 0;
            updateUI();
            runUpgradeLoop();
        }
    };

    const runUpgradeLoop = async () => {
        while (isRunning && !shouldStop) {
            if (characterSettings.dailyLimit > 0 && dailyUpgradeCount >= characterSettings.dailyLimit) {
                messageHandler("Osiągnięto dzienny limit ulepszeń!");
                isRunning = false;
                break;
            }

            if (upgradesInCurrentRun >= characterSettings.maxUpgradesPerRun) {
                messageHandler(`Wykonano zaplanowaną serię ${characterSettings.maxUpgradesPerRun} ulepszeń.`);
                isRunning = false;
                break;
            }

            if (currentItemIndex >= characterSettings.selectedItems.length) {
                if (characterSettings.autoMode) {
                    currentItemIndex = 0;
                    logToWidget("Rozpoczynanie kolejnej pętli...");
                    await sleep(1000);
                    continue;
                } else {
                    messageHandler("Koniec kolejki ulepszania.");
                    isRunning = false;
                    break;
                }
            }

            const currentItemId = characterSettings.selectedItems[currentItemIndex];
            const currentItemsInBag = getHeroItems();
            const itemStillExists = currentItemsInBag.some(x => x.id === currentItemId);

            if (!itemStillExists) {
                logToWidget(`Przedmiot ID ${currentItemId} nie istnieje. Pomijam.`);
                currentItemIndex++;
                await sleep(500);
                continue;
            }

            logToWidget(`Sprawdzanie stanu przedmiotu...`);
            const status = await previewUpgrade(currentItemId);

            if (status.isCompleted && characterSettings.stopOnCompleted) {
                logToWidget(`Przedmiot ulepszony w 100%. Pomijam.`);
                currentItemIndex++;
                await sleep(500);
                continue;
            }

            const reagents = getReagentsFromBag(characterSettings.reagentTier);
            if (reagents.length === 0) {
                messageHandler(`Brak odpowiednich reagentów (Tier ${characterSettings.reagentTier}) w torbie!`);
                isRunning = false;
                break;
            }

            const reagentToUse = reagents[0];
            logToWidget(`Przygotowanie składników...`);
            await setReagents(currentItemId, [reagentToUse.id]);
            await sleep(400);

            logToWidget(`Ulepszanie przedmiotu...`);
            await enhanceItem(currentItemId, [reagentToUse.id]);
            
            dailyUpgradeCount++;
            upgradesInCurrentRun++;
            saveDailyCount();
            
            await sleep(600);
            await previewUpgrade(currentItemId);
            updateUI();
            await sleep(800);
        }

        isRunning = false;
        updateUI();
    };

    // --- OBSŁUGA SKRÓTÓW I START DODATKU ---
    const initHotkeys = () => {
        $(document).on("keydown", (e) => {
            if (!characterSettings.enabled || !characterSettings.hotkeyEnabled) return;
            if ($(e.target).is("input, textarea, select")) return;

            if (e.key.toLowerCase() === accountSettings.hotkeyKey.toLowerCase()) {
                e.preventDefault();
                toggleUpgrader();
            }
        });
    };

    const initVisibilityChecker = () => {
        setInterval(() => {
            if (window.Engine && window.Engine.hero && window.Engine.hero.d) {
                if ($mainWindow && $mainWindow.css("display") === "none" && accountSettings.wnd_vsb) {
                    $mainWindow.show();
                }
            }
        }, VISIBILITY_CHECK_INTERVAL);
    };

    const startAddon = () => {
        loadSettings();
        initBaddonzAPI();
        createUI();
        createSettingsUI();
        initHotkeys();
        initVisibilityChecker();
        console.log("%c[Ulepszator Baddonz] Pomyślnie zintegrowano środowisko interfejsu.", "color: #00ff00; font-weight: bold;");
    };

    // Oczekiwanie na pełne załadowanie silnika Margonem
    const checkEngineReady = setInterval(() => {
        if (window.Engine && window.Engine.hero && window.Engine.hero.d && window.Engine.heroEquipment) {
            clearInterval(checkEngineReady);
            startAddon();
        }
    }, 500);

})();
