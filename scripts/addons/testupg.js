// ==UserScript==
// @name          Ulepszator baddonz 2.0
// @version       2.0.0
// @author        besiak
// @match         https://*.margonem.pl/*
// @grant         none
// ==/UserScript==

(function () {
    'use strict';

    const ADDON_ID = "UPG";
    const MICC_BASE_URL = 'https://micc.garmory-cdn.cloud/obrazki/itemy/';

    // Style specyficzne dla ulepszarki (większość daje główny baddonz)
    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.className = "upg-custom-styles";
    styleSheet.innerText = `
        .wnd-ulepszara { width: 180px; min-width: 180px; }
        .wnd-ulepszara-settings { width: 250px; min-width: 250px; }
        .wnd-ulepszara .baddonz-window-body { padding: 4px 6px 6px 6px !important; gap: 3px !important; align-items: center; }
        .wnd-ulepszara-settings .baddonz-window-body { padding: 4px 6px 6px 6px !important; gap: 3px !important; }
        
        .upg-slot-container { width: 32px; height: 32px; position: relative; margin: 5px auto; background: rgba(0,0,0,0.5); border: 1px solid #444; border-radius: 3px; box-shadow: inset 0 0 5px #000; }
        .upg-item-cursor { cursor: url("https://gordion.margonem.pl/img/gui/cursor/1n.png") 4 0, pointer !important; }
        .upg-item-name { font-size: 11px; font-weight: bold; color: #ffcc00; text-shadow: 1px 1px #000; text-align: center; }
        .upg-item-progress { font-size: 10px; color: #aaa; text-shadow: 1px 1px #000; text-align: center; }
        
        .upg-grid-types { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px 5px; width: 100%; box-sizing: border-box; }
        .upg-type-wrapper { display: flex; align-items: center; gap: 3px; cursor: url("https://gordion.margonem.pl/img/gui/cursor/5n.png") 4 0, pointer; padding: 2px; border-radius: 3px; background: rgba(0,0,0,0.2); }
        .upg-type-wrapper:hover { background: rgba(255,255,255,0.1); }
        
        .upgrader-crafting-window { display: none !important; }
    `;
    if (!document.querySelector(".upg-custom-styles")) document.head.appendChild(styleSheet);

    const EVENT_KEYWORDS = [
        "Wakacje", "Urodziny Margonem", "Wielkanoc", "Noc Kupały",
        "Szabat Czarownic", "Halloween", "Gwiazdka", "Licytacja",
        "Licytacja eventowa"
    ];

    const CL = {
        ONE_HAND_WEAPON: 1, TWO_HAND_WEAPON: 2, ONE_AND_HALF_HAND_WEAPON: 3, DISTANCE_WEAPON: 4,
        HELP_WEAPON: 5, WAND_WEAPON: 6, ORB_WEAPON: 7, ARMOR: 8, HELMET: 9, BOOTS: 10,
        GLOVES: 11, RING: 12, NECKLACE: 13, SHIELD: 14, QUIVER: 29
    };

    const ITEM_TYPE_SETTINGS_MAP = {
        [CL.ONE_HAND_WEAPON]: 'cl1', [CL.TWO_HAND_WEAPON]: 'cl2', [CL.ONE_AND_HALF_HAND_WEAPON]: 'cl3',
        [CL.DISTANCE_WEAPON]: 'cl4', [CL.HELP_WEAPON]: 'cl5', [CL.WAND_WEAPON]: 'cl6',
        [CL.ORB_WEAPON]: 'cl7', [CL.ARMOR]: 'cl8', [CL.HELMET]: 'cl9', [CL.BOOTS]: 'cl10',
        [CL.GLOVES]: 'cl11', [CL.RING]: 'cl12', [CL.NECKLACE]: 'cl13', [CL.SHIELD]: 'cl14',
        [CL.QUIVER]: 'cl29',
    };

    const ITEM_CL_NAMES = {
        1: 'Jednoręczne', 2: 'Dwuręczne', 3: 'Półtoraręczne', 4: 'Łuki',
        5: 'Pomocnicze', 6: 'Różdżki', 7: 'Orby', 8: 'Zbroje', 9: 'Heły',
        10: 'Buty', 11: 'Rękawice', 12: 'Pierki', 13: 'Naszyjniki',
        14: 'Tarcze', 29: 'Strzały',
    };

    // --- STAN APLIKACJI ---
    let currentSettings = {
        enabled: true,
        windowVisible: true,
        settingsWindowVisible: false,
        
        // Zmienne przypisane do konta (dziedziczone w parserze)
        hotkeyKey: "j",
        hotkeyEnabled: true,
        use_common: false,
        use_unique: false,
        allow_bound_items: false,
        upgrade_endbattle: false,
        count_endbattle: 10,
        bags_upgrade: false,
        count_bags_upgrade: 3,
        cl1: true, cl2: true, cl3: true, cl4: true, cl5: true,
        cl6: true, cl7: true, cl8: true, cl9: true, cl10: true,
        cl11: true, cl12: true, cl13: true, cl14: true, cl29: true,

        // Zmienne przypisane do postaci
        upgradedItemId: "",
        progressCache: {}
    };

    let uiMainWindow = null;
    let uiSettingsWindow = null;
    let dailyUpgradeCount = 0;
    let dailyUpgradeLimit = 2000;
    let isUpgrading = false;
    let windowCraftingEnabled = false;
    let BAG_CHECK_INTERVAL_ID = null;

    const MAX_REAGENTS = 25;
    const BAG_CHECK_INTERVAL = 5000;

    // --- SYSTEM ZAPISU (Hybryda Konto + Postać) ---
    function loadSettings() {
        if (!window.BaddonzAPI) return;
        const accId = window.BaddonzAPI.accountId;

        // Domyślne ustawienia postaci z Baddonza
        let charSettings = window.BaddonzAPI.getAddonSettings(ADDON_ID) || {};

        // Ustawienia konta (własny parser)
        let accSettings = {};
        try {
            const data = JSON.parse(localStorage.getItem('BaddonzData')) || {};
            if (data[accId] && data[accId].accountAddons) {
                accSettings = data[accId].accountAddons[ADDON_ID] || {};
            }
        } catch (e) {}

        currentSettings = { ...currentSettings, ...accSettings, ...charSettings };

        // Odczytanie dziennego limitu
        const count = parseInt(localStorage.getItem("baddonz-daily-upgrade-count"));
        dailyUpgradeCount = !isNaN(count) ? count : 0;
    }

    function saveSettings() {
        if (!window.BaddonzAPI) return;
        const accId = window.BaddonzAPI.accountId;

        const accKeys = ['hotkeyKey', 'hotkeyEnabled', 'use_common', 'use_unique', 'allow_bound_items', 'upgrade_endbattle', 'count_endbattle', 'bags_upgrade', 'count_bags_upgrade', 'cl1', 'cl2', 'cl3', 'cl4', 'cl5', 'cl6', 'cl7', 'cl8', 'cl9', 'cl10', 'cl11', 'cl12', 'cl13', 'cl14', 'cl29'];
        const charKeys = ['upgradedItemId', 'progressCache', 'enabled', 'windowVisible', 'settingsWindowVisible']; 

        let accSettings = {};
        let charSettings = {};

        accKeys.forEach(k => accSettings[k] = currentSettings[k]);
        charKeys.forEach(k => charSettings[k] = currentSettings[k]);

        // Zapis dla postaci przez Baddonz API
        window.BaddonzAPI.saveAddonSettings(ADDON_ID, charSettings);

        // Zapis dla konta do BaddonzData
        try {
            let data = JSON.parse(localStorage.getItem('BaddonzData')) || {};
            if (!data[accId]) data[accId] = {};
            if (!data[accId].accountAddons) data[accId].accountAddons = {};
            data[accId].accountAddons[ADDON_ID] = accSettings;
            localStorage.setItem('BaddonzData', JSON.stringify(data));
        } catch (e) {}
    }

    // --- FUNKCJE POMOCNICZE UI ---
    function saveDailyUpgradeCount(count) {
        localStorage.setItem("baddonz-daily-upgrade-count", count);
    }

    function checkDailyLimit() {
        return dailyUpgradeCount < dailyUpgradeLimit;
    }

    function generateItemTypeFiltersHtml() {
        const ITEM_CL_MAP = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 29];
        let html = '';
        ITEM_CL_MAP.forEach(cl => {
            const key = `cl${cl}`;
            html += `
                <div class="upg-type-wrapper prof-row-${cl}">
                    <div class="baddonz-checkbox cl-checkbox" data-key="${key}" id="upg-cl-${cl}" ${currentSettings[key] ? 'class="active"' : ''}></div>
                    <div class="baddonz-type-icon cl-${cl}"></div>
                </div>
            `;
        });
        return html;
    }

    function updateItemDisplay() {
        if (!uiMainWindow) return;
        const slotWrapper = uiMainWindow.querySelector('#upg-item-slot-wrapper');
        const nameEl = uiMainWindow.querySelector('#upg-item-name');
        const progressEl = uiMainWindow.querySelector('#upg-item-progress');
        const limitEl = uiMainWindow.querySelector('#upg-daily-limit');

        slotWrapper.innerHTML = '';
        nameEl.textContent = "Brak przedmiotu";
        progressEl.textContent = "";
        limitEl.textContent = `${dailyUpgradeCount}/${dailyUpgradeLimit}`;

        const itemId = currentSettings.upgradedItemId;
        if (!itemId || typeof window.Engine === 'undefined' || !window.Engine.items) return;

        const item = window.Engine.items.getItemById(itemId);
        if (!item) return;

        nameEl.textContent = item.name;
        
        if (currentSettings.progressCache[itemId]) {
            progressEl.textContent = `Progres: ${currentSettings.progressCache[itemId]}`;
        }

        // Klonowanie ikony z gry
        const $clonedItem = item.$.clone();
        $clonedItem.addClass('upg-item-cursor');
        $clonedItem.on('click', () => {
            currentSettings.upgradedItemId = "";
            saveSettings();
            if (window.message) window.message(`Anulowano ulepszanie przedmiotu ${item.name}`);
            updateItemDisplay();
        });

        $clonedItem.css({ 'position': 'relative', 'width': '32px', 'height': '32px', 'top': '0', 'left': '0' });
        $clonedItem.find('canvas.icon, canvas.canvas-notice').remove();

        const iconSource = item.icon || (`${item.id}.png`);
        const gifName = iconSource.replace(/\.[^/.]+$/, '.gif');
        const $img = $('<img>').attr('src', MICC_BASE_URL + gifName).css({ width: '32px', height: '32px', position: 'absolute', top: '0', left: '0', zIndex: '0' });
        $clonedItem.append($img);

        const slotContainer = document.createElement('div');
        slotContainer.className = "upg-slot-container";
        slotContainer.appendChild($clonedItem[0]);
        slotWrapper.appendChild(slotContainer);
    }

    function buildUI() {
        // --- GŁÓWNE OKNO ---
        const mainBodyHtml = `
            <div id="upg-item-details" class="baddonz-flex column" style="align-items: center; border-bottom: 1px solid #303030; padding-bottom: 5px; margin-bottom: 2px; width: 100%;">
                <div id="upg-item-slot-wrapper" class="baddonz-flex" style="min-height: 42px; justify-content: center; width: 100%;"></div>
                <div class="upg-item-name" id="upg-item-name">Brak przedmiotu</div>
                <div class="upg-item-progress" id="upg-item-progress"></div>
            </div>
            <div class="baddonz-text" style="text-align: center; padding: 0;">Dzienny Limit: <span id="upg-daily-limit" style="font-weight: bold;">0/2000</span></div>
        `;

        uiMainWindow = window.BaddonzAPI.createAddonWindow(ADDON_ID, "Ulepszara", mainBodyHtml, { 
            width: '180px', 
            customId: 'wnd-ulepszara',
            hasSettings: true,
            hasCollapse: true,
            hasClose: false // Zamknięcie regulowane checkboxem w managerze
        });

        // --- OKNO USTAWIEŃ ---
        const settingsBodyHtml = `
            <div class="baddonz-setting-row"><div class="baddonz-checkbox upg-use-common ${currentSettings.use_common ? 'active' : ''}"></div><span class="baddonz-text">Ulepszaj Zwyklakami</span></div>
            <div class="baddonz-setting-row"><div class="baddonz-checkbox upg-use-unique ${currentSettings.use_unique ? 'active' : ''}"></div><span class="baddonz-text">Ulepszaj Unikatami</span></div>
            <div class="baddonz-setting-row"><div class="baddonz-checkbox upg-allow-bound ${currentSettings.allow_bound_items ? 'active' : ''}"></div><span class="baddonz-text">Ulepszaj Związanymi</span></div>
            
            <hr style="width: 100%; border-color: #303030; margin: 3px 0;">
            <div class="baddonz-text" style="text-align: center; margin-bottom: 2px;">Typy Itemów:</div>
            <div class="upg-grid-types" id="upg-type-filters">
                ${generateItemTypeFiltersHtml()}
            </div>
            
            <hr style="width: 100%; border-color: #303030; margin: 3px 0;">
            <div class="baddonz-setting-row"><div class="baddonz-checkbox upg-hotkey-check ${currentSettings.hotkeyEnabled ? 'active' : ''}"></div><span class="baddonz-text">Ulepszanie Klawiszem</span></div>
            <div class="baddonz-flex column upg-hotkey-options" style="display: ${currentSettings.hotkeyEnabled ? 'flex' : 'none'}; padding-left: 20px;">
                <input type="text" class="baddonz-input keybind upg-hotkey-input" value="${currentSettings.hotkeyKey.toUpperCase()}" readonly style="width: 60px; height: 20px; line-height: 18px; font-size: 11px; text-align: center;">
            </div>

            <div class="baddonz-setting-row"><div class="baddonz-checkbox upg-endbattle-check ${currentSettings.upgrade_endbattle ? 'active' : ''}"></div><span class="baddonz-text">Ulepszaj po walce</span></div>
            <div class="baddonz-flex column upg-endbattle-options" style="display: ${currentSettings.upgrade_endbattle ? 'flex' : 'none'}; padding-left: 20px; align-items: flex-start;">
                <span class="baddonz-text" style="font-size: 10px;">Min. Reagentów:</span>
                <input type="number" class="baddonz-input upg-endbattle-input" value="${currentSettings.count_endbattle}" min="1" max="50" style="width: 60px; height: 20px; text-align: center;">
            </div>

            <div class="baddonz-setting-row"><div class="baddonz-checkbox upg-bags-check ${currentSettings.bags_upgrade ? 'active' : ''}"></div><span class="baddonz-text">Ulepszanie (Sloty w torbie)</span></div>
            <div class="baddonz-flex column upg-bags-options" style="display: ${currentSettings.bags_upgrade ? 'flex' : 'none'}; padding-left: 20px; align-items: flex-start;">
                <span class="baddonz-text" style="font-size: 10px;">Max Wolnych Slotów:</span>
                <input type="number" class="baddonz-input upg-bags-input" value="${currentSettings.count_bags_upgrade}" min="1" max="100" style="width: 60px; height: 20px; text-align: center;">
            </div>
        `;

        uiSettingsWindow = window.BaddonzAPI.createAddonWindow(ADDON_ID, "Ulepszara Ustawienia", settingsBodyHtml, { 
            width: '250px', 
            customId: 'wnd-ulepszara-settings' 
        });
        uiSettingsWindow.classList.add('settings-window');
        uiSettingsWindow.removeAttribute('data-addon-id');
        uiSettingsWindow.style.display = currentSettings.settingsWindowVisible ? 'flex' : 'none';

        // --- BINDOWANIE AKCJI ---
        const bindToggle = (className, key, callback = null) => {
            const cb = uiSettingsWindow.querySelector(`.${className}`);
            if(cb) cb.addEventListener('click', () => {
                currentSettings[key] = cb.classList.toggle('active');
                saveSettings();
                if (callback) callback();
            });
        };

        bindToggle('upg-use-common', 'use_common');
        bindToggle('upg-use-unique', 'use_unique');
        bindToggle('upg-allow-bound', 'allow_bound_items');
        
        bindToggle('upg-hotkey-check', 'hotkeyEnabled', () => {
            uiSettingsWindow.querySelector('.upg-hotkey-options').style.display = currentSettings.hotkeyEnabled ? 'flex' : 'none';
        });
        bindToggle('upg-endbattle-check', 'upgrade_endbattle', () => {
            uiSettingsWindow.querySelector('.upg-endbattle-options').style.display = currentSettings.upgrade_endbattle ? 'flex' : 'none';
        });
        bindToggle('upg-bags-check', 'bags_upgrade', () => {
            uiSettingsWindow.querySelector('.upg-bags-options').style.display = currentSettings.bags_upgrade ? 'flex' : 'none';
            handleBagLoopToggle();
        });

        // Eventy dla liczników
        const endBattleInput = uiSettingsWindow.querySelector('.upg-endbattle-input');
        endBattleInput.addEventListener('change', (e) => {
            currentSettings.count_endbattle = Math.max(1, parseInt(e.target.value) || 1);
            e.target.value = currentSettings.count_endbattle;
            saveSettings();
        });

        const bagsInput = uiSettingsWindow.querySelector('.upg-bags-input');
        bagsInput.addEventListener('change', (e) => {
            currentSettings.count_bags_upgrade = Math.max(1, parseInt(e.target.value) || 1);
            e.target.value = currentSettings.count_bags_upgrade;
            saveSettings();
        });

        // Eventy dla siatki profesji/typów
        uiSettingsWindow.querySelectorAll('.cl-checkbox').forEach(cb => {
            const key = cb.getAttribute('data-key');
            if (currentSettings[key]) cb.classList.add('active');
            
            cb.parentElement.addEventListener('click', () => {
                currentSettings[key] = cb.classList.toggle('active');
                saveSettings();
            });
        });

        // Skrót klawiszowy
        const hotkeyInput = uiSettingsWindow.querySelector('.upg-hotkey-input');
        let keybindInputActive = false;

        hotkeyInput.addEventListener('click', () => {
            keybindInputActive = true;
            hotkeyInput.focus();
            hotkeyInput.classList.add('active-keybind-mode');
        });

        hotkeyInput.addEventListener('focusout', () => {
            keybindInputActive = false;
            hotkeyInput.value = currentSettings.hotkeyKey.toUpperCase();
            hotkeyInput.classList.remove('active-keybind-mode');
        });

        hotkeyInput.addEventListener('keydown', (e) => {
            if (keybindInputActive) {
                e.preventDefault();
                const pressedKey = e.key.toLowerCase();
                if (['escape', 'enter', 'tab', 'shift', 'control', 'alt'].includes(pressedKey)) {
                    hotkeyInput.blur();
                    return;
                }
                if (pressedKey.length === 1) {
                    currentSettings.hotkeyKey = pressedKey;
                    hotkeyInput.value = pressedKey.toUpperCase();
                    saveSettings();
                    hotkeyInput.blur();
                }
            }
        });

        // Obsługa otwierania/zamykania okna ustawień z rdzenia Baddonza
        const settingsBtn = uiMainWindow.querySelector('.baddonz-settings-button');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                const isVisible = uiSettingsWindow.style.display !== 'none';
                uiSettingsWindow.style.display = isVisible ? 'none' : 'flex';
                currentSettings.settingsWindowVisible = !isVisible;
                saveSettings();
            });
        }
        
        uiSettingsWindow.querySelector('.baddonz-close-button').addEventListener('click', () => {
            uiSettingsWindow.style.display = 'none';
            currentSettings.settingsWindowVisible = false;
            saveSettings();
        });

        // Tooltipy 
        if (typeof $ === 'function' && typeof $.fn.tip === 'function') {
            uiSettingsWindow.querySelectorAll('.upg-type-wrapper').forEach(wrapper => {
                const clId = wrapper.className.match(/prof-row-(\d+)/);
                if (clId && ITEM_CL_NAMES[clId[1]]) $(wrapper).tip(ITEM_CL_NAMES[clId[1]]);
            });
            $(uiSettingsWindow.querySelector('.upg-allow-bound')).tip("Używasz na własną odpowiedzialność! Uwaga na itemy z kolosów");
        }

        updateItemDisplay();
    }


    // --- LOGIKA GRY I ULEPSZANIA ---

    const isEventItem = (item) => {
        if (!item || !item.getTipContent) return false;
        const tip = item.getTipContent();
        if (!tip) return false;
        const plainText = tip.replace(/<[^>]+>/g, '');
        return EVENT_KEYWORDS.some(keyword => plainText.includes(keyword));
    };

    const getFreeSlots = () => {
        let totalFreeSlots = 0;
        if (typeof Engine !== 'undefined' && Engine.bags && Array.isArray(Engine.bags)) {
            const bagsToCount = Engine.bags.length > 0 ? Engine.bags.slice(0, Engine.bags.length - 1) : Engine.bags;
            bagsToCount.forEach(bag => {
                if (Array.isArray(bag) && bag.length >= 2) {
                    totalFreeSlots += Math.max(0, bag[0] - bag[1]);
                }
            });
        }
        return totalFreeSlots;
    };

    const getReagents = () => {
        return Engine.items.fetchLocationItems("g").reduce((acc, item) => {
            if (!item) return acc;

            const cached = item._cachedStats || {};
            const rarity = cached.rarity || item.rarity;
            const enhancement_upgrade_lvl = cached.enhancement_upgrade_lvl !== undefined ? cached.enhancement_upgrade_lvl : (item.enhancement_upgrade_lvl ?? undefined);

            const isWorthless = ((cached && Object.prototype.hasOwnProperty.call(cached, 'artisan_worthless')) || Object.prototype.hasOwnProperty.call(item, 'artisan_worthless'));
            const cursed_flag = (cached.cursed !== undefined ? cached.cursed : (item.cursed !== undefined ? item.cursed : false));
            const itemLevel = (item.lvl ?? item.level ?? cached.lvl ?? 0);
            const itemClass = item.cl;

            const isAllowedRarity = (currentSettings.use_common && rarity === 'common') || (currentSettings.use_unique && rarity === 'unique');
            const itemSettingKey = ITEM_TYPE_SETTINGS_MAP[itemClass];
            const isAllowedType = itemSettingKey ? currentSettings[itemSettingKey] : false;
            
            const isUpgraded = enhancement_upgrade_lvl !== undefined && enhancement_upgrade_lvl !== null;
            const isBound = (item.checkSoulbound && item.checkSoulbound()) || (item.checkPermbound && item.checkPermbound());

            let isPartOfBuild = false;
            try {
                if (typeof item.getBuildsWithThisItem === 'function') {
                    const builds = item.getBuildsWithThisItem();
                    if (builds && builds.length > 0) isPartOfBuild = true;
                }
            } catch (e) { isPartOfBuild = false; }

            if (itemLevel < 20) return acc;
            if (cursed_flag) return acc;
            if (isWorthless) return acc;

            if (isAllowedType && isAllowedRarity && !isEventItem(item) && !isUpgraded && !isWorthless && (currentSettings.allow_bound_items || !isBound) && !isPartOfBuild) {
                let isPartOfBuildExtra = false;
                if (typeof Engine.buildsManager !== 'undefined' && item.getBuildsWithThisItem) {
                    try {
                        const builds = item.getBuildsWithThisItem();
                        if (builds && builds.length > 0) isPartOfBuildExtra = true;
                    } catch (e) { isPartOfBuildExtra = false; }
                }
                if (!isPartOfBuildExtra) acc.push(item.id);
            }
            return acc;
        }, []);
    };

    const chunkReagents = (reagents) => {
        const chunks = [];
        for (let i = 0; i < reagents.length; i += MAX_REAGENTS) chunks.push(reagents.slice(i, i + MAX_REAGENTS));
        return chunks;
    };

    const toggleEnhancementWindow = () => {
        if (windowCraftingEnabled) {
            Engine.crafting.window.wnd.$.removeClass("upgrader-crafting-window");
            Engine.interface.clickCrafting();
            windowCraftingEnabled = false;
            return;
        }
        Engine.crafting.window.wnd.$.addClass("upgrader-crafting-window");
        Engine.interface.clickCrafting();
        windowCraftingEnabled = true;
    };

    function getEnhancementProgressText() {
        try {
            const currentProgressTextEl = Engine.crafting.window.wnd.$[0].querySelector('.enhance__progress-text--current');
            if (currentProgressTextEl) return currentProgressTextEl.textContent.trim();
        } catch (e) {}
        return "Brak danych";
    }

    const setEnhancedItem = (itemId) => {
        return new Promise((resolve) => {
            _g(`enhancement&action=status&item=${itemId}`, (data) => {
                let current = 0, max = 0, isCompleted = false;

                if (data?.enhancement?.progress) {
                    const progress = data.enhancement.progress;
                    current = progress.current;
                    max = progress.max;
                    if (current > 0 && current === max) isCompleted = true;
                }

                setTimeout(() => {
                    const progressText = getEnhancementProgressText();
                    if (progressText !== "Brak danych") {
                        currentSettings.progressCache[itemId] = progressText;
                    } else if (isCompleted) {
                        currentSettings.progressCache[itemId] = `${max}/${max}`;
                    }
                    saveSettings();
                    updateItemDisplay();
                    resolve({ current, max, isCompleted });
                }, 300);
            });
        });
    };

    const setReagents = (itemId, reagentIds) => new Promise((resolve) => _g(`enhancement&action=progress_preview&item=${itemId}&ingredients=${reagentIds.join(",")}`, resolve));
    const enhanceItem = (itemId, reagentIds) => new Promise((resolve) => _g(`enhancement&action=progress&item=${itemId}&ingredients=${reagentIds.join(",")}`, resolve));
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const processChunks = async (upgradedItemId, chunks) => {
        for (const chunk of chunks) {
            if (!checkDailyLimit()) {
                if(window.message) window.message(`Przerwano ulepszanie. Limit ${dailyUpgradeLimit} osiągnięty.`);
                return true;
            }

            await setReagents(upgradedItemId, chunk);
            await enhanceItem(upgradedItemId, chunk);
            await sleep(200);

            const progressInfo = await setEnhancedItem(upgradedItemId);
            await sleep(100);

            const progressText = getEnhancementProgressText();
            if (progressInfo.isCompleted) {
                if(window.message) window.message(`Ulepszono! Progres: ${progressText}. (MAX)`);
                return true;
            }
            if(window.message) window.message(`Ulepszono! Progres: ${progressText}`);
            await sleep(300);
        }
        return false;
    };

    const executeUpgradeCycle = async (sourceTrigger) => {
        if (!currentSettings.enabled || !checkDailyLimit() || isUpgrading) return;
        
        const upgradedItemId = currentSettings.upgradedItemId;
        if (!upgradedItemId) return;
        const upgradedItem = Engine.items.getItemById(upgradedItemId);
        if (!upgradedItem) return;

        const reagents = getReagents();
        if (reagents.length === 0) return;

        if (sourceTrigger === 'battle' && reagents.length < currentSettings.count_endbattle) return;
        if (sourceTrigger === 'bags' && getFreeSlots() > currentSettings.count_bags_upgrade) return;

        isUpgrading = true;
        if(window.message) window.message(`Ulepszam! ${upgradedItem.name}.`);

        try {
            toggleEnhancementWindow();
            const progressInfo = await setEnhancedItem(upgradedItemId);

            if (progressInfo.isCompleted) {
                if(window.message) window.message(`Maksymalny progres osiągnięty.`);
                return;
            }

            const chunks = chunkReagents(reagents);
            await processChunks(upgradedItemId, chunks);
        } finally {
            toggleEnhancementWindow();
            isUpgrading = false;
        }
    };


    // --- EVENTY I PODPIĘCIA W GRZE ---
    
    function setupCommunicationHook() {
        if (typeof Engine === 'undefined' || typeof Engine.communication === 'undefined' || typeof Engine.communication.parseJSON !== 'function') return;
        const originalParseJSON = Engine.communication.parseJSON;
        Engine.communication.parseJSON = function (data) {
            if (data?.enhancement?.usages_preview?.count !== undefined) {
                dailyUpgradeCount = data.enhancement.usages_preview.count;
                dailyUpgradeLimit = data.enhancement.usages_preview.limit || dailyUpgradeLimit;
                saveDailyUpgradeCount(dailyUpgradeCount);
                updateItemDisplay();
            }
            return originalParseJSON.call(this, data);
        };
    }

    function initItemContextMenu() {
        if (typeof Engine === 'undefined' || typeof Engine.interface === 'undefined') return;
        const ogShowPopupMenu = Engine.interface.showPopupMenu;
        Engine.interface.showPopupMenu = function (menu, e) {
            if (!currentSettings.enabled) return ogShowPopupMenu.call(this, menu, e);

            const match = e.currentTarget?.className?.match(/item-id-(\d+)/);
            const itemId = match ? match[1] : null;
            if (!itemId) return ogShowPopupMenu.call(this, menu, e);

            const item = Engine.items.getItemById(itemId);
            if (!ITEM_TYPE_SETTINGS_MAP.hasOwnProperty(item?.cl)) return ogShowPopupMenu.call(this, menu, e);

            let menuItem;
            if (itemId === currentSettings.upgradedItemId) {
                menuItem = ["Anuluj ulepszanie", () => {
                    currentSettings.upgradedItemId = "";
                    saveSettings();
                    if(window.message) window.message(`Anulowano ulepszanie przedmiotu ${item.name}`);
                    updateItemDisplay();
                }, { button: { cls: "menu-item--red" } }];
            } else {
                menuItem = ["Ulepsz ten przedmiot", async () => {
                    currentSettings.upgradedItemId = itemId;
                    saveSettings();
                    if(window.message) window.message(`Wybrano ulepszanie przedmiotu: ${item.name}`);
                    
                    toggleEnhancementWindow();
                    await setEnhancedItem(itemId);
                    toggleEnhancementWindow();
                }, { button: { cls: "menu-item--green" } }];
            }

            const updatedMenu = [menuItem, ...menu];
            ogShowPopupMenu.call(this, updatedMenu, e);
        };
    }

    function handleKeyDown(e) {
        if (!currentSettings.enabled || !currentSettings.hotkeyEnabled) return;
        
        const el = document.activeElement;
        const isChatFocused = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
        if (isChatFocused) return;

        if (e.key.toLowerCase() === currentSettings.hotkeyKey.toLowerCase()) {
            if (isUpgrading || (typeof Engine.battle !== 'undefined' && Engine.battle.show)) return;
            e.preventDefault();
            executeUpgradeCycle('manual');
        }
    }

    let endBattleHooked = false;
    function hookEndBattle() {
        if (typeof Engine !== 'undefined' && typeof Engine.battle !== 'undefined' && typeof Engine.battle.setEndBattle === 'function' && !endBattleHooked) {
            const originalSetEndBattle = Engine.battle.setEndBattle.bind(Engine.battle);
            Engine.battle.setEndBattle = function() {
                originalSetEndBattle();
                if(currentSettings.enabled && currentSettings.upgrade_endbattle) executeUpgradeCycle('battle');
            };
            endBattleHooked = true;
        }
    }

    function bagLoop() {
        if (currentSettings.enabled && currentSettings.bags_upgrade) executeUpgradeCycle('bags');
    }

    function handleBagLoopToggle() {
        if (BAG_CHECK_INTERVAL_ID) clearInterval(BAG_CHECK_INTERVAL_ID);
        if (currentSettings.bags_upgrade && currentSettings.enabled) {
            BAG_CHECK_INTERVAL_ID = setInterval(bagLoop, BAG_CHECK_INTERVAL);
        }
    }

    // --- CYKL ŻYCIA BADDONZA ---
    function addonInit() {
        loadSettings();
        if (!uiMainWindow) buildUI();
        
        setupCommunicationHook();
        initItemContextMenu();
        hookEndBattle();
        handleBagLoopToggle();
        document.addEventListener('keydown', handleKeyDown);
    }

    function addonStop() {
        if (BAG_CHECK_INTERVAL_ID) {
            clearInterval(BAG_CHECK_INTERVAL_ID);
            BAG_CHECK_INTERVAL_ID = null;
        }
        document.removeEventListener('keydown', handleKeyDown);
        if (uiMainWindow) { uiMainWindow.remove(); uiMainWindow = null; }
        if (uiSettingsWindow) { uiSettingsWindow.remove(); uiSettingsWindow = null; }
    }

    function onStateToggle(isEnabled) {
        currentSettings.enabled = isEnabled;
        saveSettings();
        handleBagLoopToggle();
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
