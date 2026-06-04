// ==UserScript==
// @name          UPG Baddonz (Ulepszara)
// @version       2.0
// @author        besiak
// @match         https://*.margonem.pl/*
// @grant         none
// ==/UserScript==

(function () {
    'use strict';

    const ADDON_ID = "UPG";
    const MICC_BASE_URL = 'https://micc.garmory-cdn.cloud/obrazki/itemy/';

    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.className = "upg-custom-styles";
    styleSheet.innerText = `
        .wnd-ulepszara { width: 140px; min-width: 140px; }
        .wnd-ulepszara-settings { width: 230px; min-width: 230px; }
        .wnd-ulepszara .baddonz-window-body { padding: 4px 6px 6px 6px !important; gap: 3px !important; align-items: center; }
        .wnd-ulepszara-settings .baddonz-window-body { padding: 4px 6px 6px 6px !important; gap: 3px !important; }
        .wnd-ulepszara-settings .baddonz-setting-row { margin-bottom: 2px !important; }
        .wnd-ulepszara-settings .baddonz-text { font-size: 11px; }
        .upg-item-slot { width: 32px; height: 32px; position: relative; margin: 0 auto; border: 1px solid #555; background: #000; border-radius: 3px; cursor: url("https://gordion.margonem.pl/img/gui/cursor/1n.png") 4 0, pointer; }
        .upg-item-slot img { position: absolute; top:0; left:0; width: 32px; height: 32px; z-index: 0; }
        .upg-item-slot .lvl { position: absolute; bottom: -2px; right: -2px; z-index: 1; pointer-events: none; }
        .upgrader-crafting-window { display: none !important; }
        .upg-types-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2px 5px; width: 100%; box-sizing: border-box; margin-top: 2px; }
        .upg-type-wrapper { display: flex; align-items: center; gap: 2px; padding: 2px; background: rgba(0,0,0,0.3); border-radius: 3px; }
    `;
    if (!document.querySelector(".upg-custom-styles")) document.head.appendChild(styleSheet);

    const EVENT_KEYWORDS = ["Wakacje", "Urodziny Margonem", "Wielkanoc", "Noc Kupały", "Szabat Czarownic", "Halloween", "Gwiazdka", "Licytacja", "Licytacja eventowa"];
    const CL = { ONE_HAND_WEAPON: 1, TWO_HAND_WEAPON: 2, ONE_AND_HALF_HAND_WEAPON: 3, DISTANCE_WEAPON: 4, HELP_WEAPON: 5, WAND_WEAPON: 6, ORB_WEAPON: 7, ARMOR: 8, HELMET: 9, BOOTS: 10, GLOVES: 11, RING: 12, NECKLACE: 13, SHIELD: 14, QUIVER: 29 };
    const ITEM_CL_NAMES = { 1: 'Jednoręczne', 2: 'Dwuręczne', 3: 'Półtoraręczne', 4: 'Łuki', 5: 'Pomocnicze', 6: 'Różdżki', 7: 'Orby', 8: 'Zbroje', 9: 'Hełmy', 10: 'Buty', 11: 'Rękawice', 12: 'Pierki', 13: 'Naszyjniki', 14: 'Tarcze', 29: 'Strzały' };
    const ITEM_TYPE_SETTINGS_MAP = { 1: 'cl1', 2: 'cl2', 3: 'cl3', 4: 'cl4', 5: 'cl5', 6: 'cl6', 7: 'cl7', 8: 'cl8', 9: 'cl9', 10: 'cl10', 11: 'cl11', 12: 'cl12', 13: 'cl13', 14: 'cl14', 29: 'cl29' };

    let currentSettings = {
        enabled: true,
        hotkeyKey: "j",
        use_common: false,
        use_unique: false,
        allow_bound_items: false,
        upgrade_endbattle: false,
        count_endbattle: 10,
        bags_upgrade: false,
        count_bags_upgrade: 3,
        selectedItemId: null,
        cl1: true, cl2: true, cl3: true, cl4: true, cl5: true, cl6: true, cl7: true, cl8: true, cl9: true, cl10: true, cl11: true, cl12: true, cl13: true, cl14: true, cl29: true
    };

    let uiMainWindow = null;
    let uiSettingsWindow = null;
    let dailyUpgradeCount = 0;
    let dailyUpgradeLimit = 2000;
    let isUpgrading = false;
    let keybindInputActive = false;
    let isKeyDownBound = false;
    let bagLoopTimeout = null;

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

        // Load daily limit manually (cross-character)
        const count = parseInt(localStorage.getItem("baddonz-daily-upgrade-count"));
        dailyUpgradeCount = !isNaN(count) ? count : 0;
    }

    function saveSettings() {
        if (!window.BaddonzAPI) return;
        const accId = window.BaddonzAPI.accountId;

        // Podział na ustawienia konta (filtry) i postaci (wybrany item, włącznik)
        const accKeys = ['hotkeyKey', 'use_common', 'use_unique', 'allow_bound_items', 'upgrade_endbattle', 'count_endbattle', 'bags_upgrade', 'count_bags_upgrade', 'cl1', 'cl2', 'cl3', 'cl4', 'cl5', 'cl6', 'cl7', 'cl8', 'cl9', 'cl10', 'cl11', 'cl12', 'cl13', 'cl14', 'cl29'];
        const charKeys = ['enabled', 'selectedItemId'];

        let accSettings = {};
        let charSettings = {};
        accKeys.forEach(k => accSettings[k] = currentSettings[k]);
        charKeys.forEach(k => charSettings[k] = currentSettings[k]);

        window.BaddonzAPI.saveAddonSettings(ADDON_ID, charSettings);

        try {
            let data = JSON.parse(localStorage.getItem('BaddonzData')) || {};
            if (!data[accId]) data[accId] = {};
            if (!data[accId].accountAddons) data[accId].accountAddons = {};
            data[accId].accountAddons[ADDON_ID] = accSettings;
            localStorage.setItem('BaddonzData', JSON.stringify(data));
        } catch (e) {}
    }

    function saveDailyUpgradeCount(count) {
        localStorage.setItem("baddonz-daily-upgrade-count", count);
    }

    function loadProgress(itemId) {
        const charId = window.Engine.hero?.d?.id;
        if (!charId) return null;
        try {
            const allProgress = JSON.parse(localStorage.getItem(`baddonz-enhancement-progress-char-${charId}`)) || {};
            return allProgress[itemId] || null;
        } catch (e) { return null; }
    }

    function saveProgress(itemId, progressText) {
        const charId = window.Engine.hero?.d?.id;
        if (!itemId || !progressText || progressText === "Brak danych" || !charId) return;

        const storageKey = `baddonz-enhancement-progress-char-${charId}`;
        let allProgress = {};
        try { allProgress = JSON.parse(localStorage.getItem(storageKey)) || {}; } catch (e) {}
        
        allProgress[itemId] = progressText;

        if (currentSettings.selectedItemId !== itemId) delete allProgress[itemId];
        localStorage.setItem(storageKey, JSON.stringify(allProgress));
    }

    function checkDailyLimit() { return dailyUpgradeCount < dailyUpgradeLimit; }

    function getFreeSlots() {
        let totalFreeSlots = 0;
        if (typeof window.Engine !== 'undefined' && window.Engine.bags && Array.isArray(window.Engine.bags)) {
            const bagsToCount = window.Engine.bags.length > 0 ? window.Engine.bags.slice(0, window.Engine.bags.length - 1) : window.Engine.bags;
            bagsToCount.forEach(bag => {
                if (Array.isArray(bag) && bag.length >= 2) totalFreeSlots += Math.max(0, bag[0] - bag[1]);
            });
        }
        return totalFreeSlots;
    }

    function isEventItem(item) {
        if (!item || !item.getTipContent) return false;
        const tip = item.getTipContent();
        if (!tip) return false;
        const plainText = tip.replace(/<[^>]+>/g, '');
        return EVENT_KEYWORDS.some(keyword => plainText.includes(keyword));
    }

    const getReagents = () => {
        return window.Engine.items.fetchLocationItems("g").reduce((acc, item) => {
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

            if (itemLevel < 20 || cursed_flag || isWorthless) return acc;

            if (isAllowedType && isAllowedRarity && !isEventItem(item) && !isUpgraded && !isWorthless && (currentSettings.allow_bound_items || !isBound) && !isPartOfBuild) {
                acc.push(item.id);
            }
            return acc;
        }, []);
    };

    const chunkReagents = (reagents) => {
        const chunks = [];
        for (let i = 0; i < reagents.length; i += 25) chunks.push(reagents.slice(i, i + 25));
        return chunks;
    };

    function getEnhancementProgressText() {
        try {
            const currentProgressTextEl = window.Engine.crafting.window.wnd.$[0].querySelector('.enhance__progress-text--current');
            if (currentProgressTextEl) return currentProgressTextEl.textContent.trim();
        } catch (e) {}
        return "Brak danych";
    }

    let windowEnabled = false;
    const toggleEnhancementWindow = () => {
        if (windowEnabled) {
            window.Engine.crafting.window.wnd.$.removeClass("upgrader-crafting-window");
            window.Engine.interface.clickCrafting();
            windowEnabled = false;
            return;
        }
        window.Engine.crafting.window.wnd.$.addClass("upgrader-crafting-window");
        window.Engine.interface.clickCrafting();
        windowEnabled = true;
    };

    const setEnhancedItem = (itemId) => {
        return new Promise((resolve) => {
            window._g(`enhancement&action=status&item=${itemId}`, (data) => {
                let current = 0, max = 0, isCompleted = false;
                if (data?.enhancement?.progress) {
                    const progress = data.enhancement.progress;
                    current = progress.current; max = progress.max;
                    if (current > 0 && current === max) isCompleted = true;
                }
                setTimeout(() => {
                    const progressText = getEnhancementProgressText();
                    if (progressText !== "Brak danych") saveProgress(itemId, progressText);
                    else if (isCompleted) saveProgress(itemId, `${max}/${max}`);
                    updateUI();
                    resolve({ current, max, isCompleted });
                }, 300);
            });
        });
    };

    const setReagents = (itemId, reagentIds) => {
        const reagents = reagentIds.join(",");
        return new Promise((resolve) => window._g(`enhancement&action=progress_preview&item=${itemId}&ingredients=${reagents}`, (data) => resolve(data)));
    };

    const enhanceItem = (itemId, reagentIds) => {
        if (!itemId || !reagentIds) return;
        const reagents = reagentIds.join(",");
        return new Promise((resolve) => window._g(`enhancement&action=progress&item=${itemId}&ingredients=${reagents}`, (data) => resolve(data)));
    };

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const processChunks = async (upgradedItemId, chunks) => {
        for (const chunk of chunks) {
            if (!checkDailyLimit()) {
                window.message(`Przerwano ulepszanie. Limit ${dailyUpgradeLimit} osiągnięty.`);
                return true;
            }
            await setReagents(upgradedItemId, chunk);
            await enhanceItem(upgradedItemId, chunk);
            await sleep(200);

            const progressInfo = await setEnhancedItem(upgradedItemId);
            await sleep(100);

            const progressText = getEnhancementProgressText();
            if (progressInfo.isCompleted) {
                window.message(`Ulepszono! Progres: ${progressText}. (MAX)`);
                return true;
            }
            window.message(`Ulepszono! Progres: ${progressText}`);
            await sleep(300);
        }
        return false;
    }

    const handleBagCheck = async () => {
        if (!currentSettings.enabled || !currentSettings.bags_upgrade || !checkDailyLimit() || isUpgrading) return;
        if (!currentSettings.selectedItemId) return;
        const upgradedItem = window.Engine.items.getItemById(currentSettings.selectedItemId);
        if (!upgradedItem) return;

        const reagents = getReagents();
        const freeSlots = getFreeSlots();
        if (reagents.length >= 1 && freeSlots <= currentSettings.count_bags_upgrade) {
            isUpgrading = true;
            window.message(`Wolne sloty: ${freeSlots}. Ulepszam! ${upgradedItem.name}.`);
            try {
                toggleEnhancementWindow();
                const progressInfo = await setEnhancedItem(currentSettings.selectedItemId);
                if (progressInfo.isCompleted) { window.message(`Maksymalny progres osiągnięty.`); return; }
                const chunks = chunkReagents(reagents);
                await processChunks(currentSettings.selectedItemId, chunks);
            } finally {
                toggleEnhancementWindow();
                isUpgrading = false;
            }
        }
    };

    const handleEndBattle = async () => {
        if (!currentSettings.enabled || !currentSettings.upgrade_endbattle || !checkDailyLimit() || isUpgrading) return;
        if (!currentSettings.selectedItemId) return;
        const upgradedItem = window.Engine.items.getItemById(currentSettings.selectedItemId);
        if (!upgradedItem) return;

        const reagents = getReagents();
        if (reagents.length < currentSettings.count_endbattle) return;

        window.message(`Ulepszam! ${upgradedItem.name}.`);
        isUpgrading = true;

        try {
            toggleEnhancementWindow();
            const progressInfo = await setEnhancedItem(currentSettings.selectedItemId);
            if (progressInfo.isCompleted) { window.message(`Maksymalny progres osiągnięty.`); return; }
            const chunks = chunkReagents(reagents);
            await processChunks(currentSettings.selectedItemId, chunks);
        } finally {
            toggleEnhancementWindow();
            isUpgrading = false;
        }
    };

    function updateUI() {
        if (!uiMainWindow) return;
        const dailyLimitEl = uiMainWindow.querySelector("#upg-daily-limit");
        if (dailyLimitEl) dailyLimitEl.textContent = `Limit: ${dailyUpgradeCount}/${dailyUpgradeLimit}`;

        const container = uiMainWindow.querySelector("#upg-item-container");
        const noItemText = uiMainWindow.querySelector("#upg-no-item");
        
        if (currentSettings.selectedItemId && window.Engine.items) {
            const item = window.Engine.items.getItemById(currentSettings.selectedItemId);
            if (item) {
                container.style.display = "block";
                noItemText.style.display = "none";
                
                const iconSource = item.icon || (`${item.id}.png`);
                const gifName = iconSource.replace(/\.[^/.]+$/, '.gif');
                uiMainWindow.querySelector("#upg-item-img").src = MICC_BASE_URL + gifName;
                
                const upgradeLvl = item.upgrade_lvl || 0;
                uiMainWindow.querySelector("#upg-item-lvl").className = `lvl cl-icon icon-star-${upgradeLvl}`;
                uiMainWindow.querySelector("#upg-item-name").textContent = item.name;
                
                const storedProgress = loadProgress(currentSettings.selectedItemId);
                uiMainWindow.querySelector("#upg-item-progress").textContent = storedProgress ? `Progres: ${storedProgress}` : "";
            } else {
                container.style.display = "none";
                noItemText.style.display = "block";
            }
        } else {
            container.style.display = "none";
            noItemText.style.display = "block";
        }
    }

    function handleKeyDown(e) {
        if (!currentSettings.enabled) return;
        const upgKeybindInput = uiSettingsWindow ? uiSettingsWindow.querySelector(".upg-keybind-input") : null;

        if (keybindInputActive && upgKeybindInput) {
            e.preventDefault();
            const pressedKey = e.key.toLowerCase();
            
            if (['escape', 'enter', 'tab'].includes(pressedKey)) {
                upgKeybindInput.blur();
                return;
            }

            if (window.BaddonzAPI && !window.BaddonzAPI.isValidHotkey(pressedKey)) return;
            if (pressedKey.length !== 1) return;

            currentSettings.hotkeyKey = pressedKey;
            upgKeybindInput.value = pressedKey.toUpperCase();
            saveSettings();
            keybindInputActive = false;
            upgKeybindInput.blur();
            upgKeybindInput.classList.remove('active-keybind-mode');
            return;
        }

        const isInputActive = ["TEXTAREA", "MAGIC_INPUT", "INPUT"].includes(document.activeElement.tagName);
        if (!isInputActive && e.key.toLowerCase() === currentSettings.hotkeyKey) {
            e.preventDefault();
            
            if (isUpgrading) return;
            isUpgrading = true;
            
            (async () => {
                try {
                    if (typeof window.Engine.battle.d !== 'undefined' && window.Engine.battle.d.id !== 0) {
                        window.message("Nie można ręcznie ulepszać podczas walki.");
                        return;
                    }
                    if (!checkDailyLimit()) {
                        window.message(`Osiągnięto dzienny limit ${dailyUpgradeLimit} ulepszeń.`);
                        return;
                    }
                    if (!currentSettings.selectedItemId) { window.message("Nie wybrano przedmiotu."); return; }
                    const upgradedItem = window.Engine.items.getItemById(currentSettings.selectedItemId);
                    if (!upgradedItem) { window.message("Nie znaleziono wybranego przedmiotu."); return; }

                    const reagents = getReagents();
                    if (reagents.length === 0) { window.message("Nie znaleziono odpowiednich składników."); return; }

                    toggleEnhancementWindow();
                    const chunks = chunkReagents(reagents);
                    const progressInfo = await setEnhancedItem(currentSettings.selectedItemId);
                    
                    if (progressInfo.isCompleted) {
                        window.message(`Ulepszanie zakończone. ${upgradedItem.name} osiągnął MAX progres.`);
                        toggleEnhancementWindow();
                        return;
                    }
                    await processChunks(currentSettings.selectedItemId, chunks);
                    toggleEnhancementWindow();
                } finally {
                    isUpgrading = false;
                }
            })();
        }
    }

    function buildUI() {
        const createTypesGrid = () => {
            let html = '';
            Object.keys(ITEM_TYPE_SETTINGS_MAP).forEach(cl => {
                html += `
                    <div class="upg-type-wrapper cl-btn-${cl}">
                        <div class="baddonz-checkbox upg-cl-cb-${cl} ${currentSettings[`cl${cl}`] ? 'active' : ''}"></div>
                        <div class="baddonz-type-icon cl-${cl}"></div>
                    </div>
                `;
            });
            return html;
        };

        const mainBodyHtml = `
            <div id="upg-item-container" style="display:none; text-align: center;">
                <div id="upg-item-slot" class="upg-item-slot baddonz-upgrader-item-cursor">
                    <img id="upg-item-img" src="">
                    <div id="upg-item-lvl" class="lvl"></div>
                </div>
                <div id="upg-item-name" class="baddonz-text" style="color: #ffcc00; font-weight: bold; margin-top: 2px;"></div>
                <div id="upg-item-progress" class="baddonz-text" style="color: #aaa; font-size: 10px;"></div>
            </div>
            <div id="upg-no-item" class="baddonz-text" style="color: #777; text-align: center; margin: 10px 0;">PPM -> Ulepsz ten przedmiot</div>
            <hr style="width: 100%; border-color: #303030; margin: 3px 0;">
            <div id="upg-daily-limit" class="baddonz-text" style="color: #fff; text-align: center;">Limit: 0/2000</div>
        `;

        const settingsBodyHtml = `
            <div class="baddonz-setting-row" style="margin-bottom: 4px !important;">
                <span class="baddonz-text" style="padding: 0;">Skrót do ulepszania:</span>
                <input type="text" class="baddonz-input keybind upg-keybind-input" value="${currentSettings.hotkeyKey.toUpperCase()}" readonly style="width: 50px; height: 20px; line-height: 18px; font-size: 11px; padding: 1px 0; margin-left: auto;">
            </div>
            <hr style="width: 100%; border-color: #303030; margin: 2px 0;">
            
            <div class="baddonz-setting-row"><div class="baddonz-checkbox upg-use-common ${currentSettings.use_common ? 'active' : ''}"></div><span class="baddonz-text">Ulepszaj Zwyklakami</span></div>
            <div class="baddonz-setting-row"><div class="baddonz-checkbox upg-use-unique ${currentSettings.use_unique ? 'active' : ''}"></div><span class="baddonz-text">Ulepszaj Unikatami</span></div>
            <div class="baddonz-setting-row"><div class="baddonz-checkbox upg-allow-bound ${currentSettings.allow_bound_items ? 'active' : ''}"></div><span class="baddonz-text" style="color: #ff5555;">Ulepszaj Związanymi (!)</span></div>
            
            <hr style="width: 100%; border-color: #303030; margin: 2px 0;">
            <div class="baddonz-setting-row"><div class="baddonz-checkbox upg-endbattle ${currentSettings.upgrade_endbattle ? 'active' : ''}"></div><span class="baddonz-text">Ulepszaj po walce</span></div>
            <div class="baddonz-setting-row upg-endbattle-opts" style="display: ${currentSettings.upgrade_endbattle ? 'flex' : 'none'};"><span class="baddonz-text">Min. Reagentów:</span>
                <input type="number" class="baddonz-input upg-endbattle-count" value="${currentSettings.count_endbattle}" min="1" max="50" style="width: 40px; height: 18px; margin-left: auto; text-align: center; padding: 1px;">
            </div>
            
            <div class="baddonz-setting-row"><div class="baddonz-checkbox upg-bags ${currentSettings.bags_upgrade ? 'active' : ''}"></div><span class="baddonz-text">Ulepsz po torbie</span></div>
            <div class="baddonz-setting-row upg-bags-opts" style="display: ${currentSettings.bags_upgrade ? 'flex' : 'none'};"><span class="baddonz-text">Max Wolne Sloty:</span>
                <input type="number" class="baddonz-input upg-bags-count" value="${currentSettings.count_bags_upgrade}" min="1" max="100" style="width: 40px; height: 18px; margin-left: auto; text-align: center; padding: 1px;">
            </div>

            <hr style="width: 100%; border-color: #303030; margin: 2px 0;">
            <div class="baddonz-text" style="text-align: center;">Typy Itemów do spalenia:</div>
            <div class="upg-types-grid">
                ${createTypesGrid()}
            </div>
        `;

        uiMainWindow = window.BaddonzAPI.createAddonWindow(ADDON_ID, "Ulepszara", mainBodyHtml, { width: '140px', customId: 'wnd-ulepszara', hasSettings: true, hasCollapse: true });
        uiSettingsWindow = window.BaddonzAPI.createAddonWindow(ADDON_ID, "Ulepszara Ustawienia", settingsBodyHtml, { width: '230px', customId: 'wnd-ulepszara-settings' });
        
        uiMainWindow.classList.add('wnd-ulepszara');
        uiSettingsWindow.classList.add('wnd-ulepszara-settings', 'settings-window');
        uiSettingsWindow.removeAttribute('data-addon-id');
        uiSettingsWindow.style.display = 'none';

        // Anulowanie itemu klikiem na główny obrazek
        uiMainWindow.querySelector("#upg-item-slot").addEventListener('click', () => {
            if (currentSettings.selectedItemId) {
                currentSettings.selectedItemId = null;
                saveSettings();
                window.message(`Anulowano wybór przedmiotu.`);
                updateUI();
            }
        });

        const upgKeybindInput = uiSettingsWindow.querySelector(".upg-keybind-input");
        upgKeybindInput.addEventListener('click', () => { keybindInputActive = true; upgKeybindInput.focus(); upgKeybindInput.classList.add('active-keybind-mode'); });
        upgKeybindInput.addEventListener('focusout', () => { if (keybindInputActive) { keybindInputActive = false; upgKeybindInput.value = currentSettings.hotkeyKey.toUpperCase(); } upgKeybindInput.classList.remove('active-keybind-mode'); });

        const bindCb = (cls, key, callback = null) => {
            const cb = uiSettingsWindow.querySelector(`.${cls}`);
            cb.addEventListener('click', () => { currentSettings[key] = cb.classList.toggle('active'); saveSettings(); if(callback) callback(); });
        };

        bindCb('upg-use-common', 'use_common');
        bindCb('upg-use-unique', 'use_unique');
        bindCb('upg-allow-bound', 'allow_bound_items');
        bindCb('upg-endbattle', 'upgrade_endbattle', () => { uiSettingsWindow.querySelector('.upg-endbattle-opts').style.display = currentSettings.upgrade_endbattle ? 'flex' : 'none'; });
        bindCb('upg-bags', 'bags_upgrade', () => { uiSettingsWindow.querySelector('.upg-bags-opts').style.display = currentSettings.bags_upgrade ? 'flex' : 'none'; });

        uiSettingsWindow.querySelector(".upg-endbattle-count").addEventListener('change', (e) => { currentSettings.count_endbattle = Math.max(1, parseInt(e.target.value) || 1); e.target.value = currentSettings.count_endbattle; saveSettings(); });
        uiSettingsWindow.querySelector(".upg-bags-count").addEventListener('change', (e) => { currentSettings.count_bags_upgrade = Math.max(1, parseInt(e.target.value) || 1); e.target.value = currentSettings.count_bags_upgrade; saveSettings(); });

        Object.keys(ITEM_TYPE_SETTINGS_MAP).forEach(cl => {
            const btn = uiSettingsWindow.querySelector(`.cl-btn-${cl}`);
            const cb = uiSettingsWindow.querySelector(`.upg-cl-cb-${cl}`);
            if(typeof $ === 'function' && typeof $.fn.tip === 'function') $(btn).tip(ITEM_CL_NAMES[cl]);
            btn.addEventListener('click', () => { currentSettings[`cl${cl}`] = cb.classList.toggle('active'); saveSettings(); });
        });
    }

    const initItemContextMenu = () => {
        const ogShowPopupMenu = window.Engine.interface.showPopupMenu;
        window.Engine.interface.showPopupMenu = function (menu, e) {
            const match = e.currentTarget?.className?.match(/item-id-(\d+)/);
            const itemId = match ? match[1] : null;
            const item = window.Engine.items.getItemById(itemId);

            if (!itemId || !ITEM_TYPE_SETTINGS_MAP.hasOwnProperty(item?.cl)) {
                return ogShowPopupMenu.call(this, menu, e);
            }

            let menuItem;
            if (itemId === currentSettings.selectedItemId) {
                menuItem = ["Anuluj ulepszanie", () => {
                    currentSettings.selectedItemId = null;
                    saveSettings();
                    window.message(`Anulowano ulepszanie przedmiotu ${item.name}`);
                    updateUI();
                }, { button: { cls: "menu-item--red" } }];
            } else {
                menuItem = ["Ulepsz ten przedmiot", async () => {
                    currentSettings.selectedItemId = itemId;
                    saveSettings();
                    window.message(`Ulepszanie przedmiotu ${item.name}`);
                    updateUI();
                    
                    toggleEnhancementWindow();
                    await setEnhancedItem(itemId);
                    toggleEnhancementWindow();
                }, { button: { cls: "menu-item--green" } }];
            }

            const updatedMenu = [menuItem, ...menu];
            ogShowPopupMenu.call(this, updatedMenu, e);
        };
    };

    function addonInit() {
        loadSettings();
        if (!uiMainWindow) buildUI();
        updateUI();

        if (!isKeyDownBound) {
            document.addEventListener('keydown', handleKeyDown);
            isKeyDownBound = true;
        }

        initItemContextMenu();

        if (typeof window.Engine.communication.parseJSON === 'function' && !window.Engine.communication.parseJSON._upgHooked) {
            const originalParseJSON = window.Engine.communication.parseJSON;
            window.Engine.communication.parseJSON = function (data) {
                if (data?.enhancement?.usages_preview?.count !== undefined) {
                    dailyUpgradeCount = data.enhancement.usages_preview.count;
                    dailyUpgradeLimit = data.enhancement.usages_preview.limit || dailyUpgradeLimit;
                    saveDailyUpgradeCount(dailyUpgradeCount);
                    updateUI();
                }
                return originalParseJSON.call(this, data);
            };
            window.Engine.communication.parseJSON._upgHooked = true;
        }

        if (typeof window.Engine.battle.setEndBattle === 'function' && !window.Engine.battle.setEndBattle._upgHooked) {
            const originalSetEndBattle = window.Engine.battle.setEndBattle.bind(window.Engine.battle);
            window.Engine.battle.setEndBattle = function() {
                originalSetEndBattle();
                handleEndBattle();
            };
            window.Engine.battle.setEndBattle._upgHooked = true;
        }

        const bagLoop = () => {
            if (currentSettings.enabled && currentSettings.bags_upgrade) handleBagCheck();
            bagLoopTimeout = setTimeout(bagLoop, 5000);
        };
        if (!bagLoopTimeout) bagLoop();
    }

    function addonStop() {
        if (isKeyDownBound) {
            document.removeEventListener('keydown', handleKeyDown);
            isKeyDownBound = false;
        }
        if (bagLoopTimeout) {
            clearTimeout(bagLoopTimeout);
            bagLoopTimeout = null;
        }
        if (uiMainWindow) { uiMainWindow.remove(); uiMainWindow = null; }
        if (uiSettingsWindow) { uiSettingsWindow.remove(); uiSettingsWindow = null; }
    }

    function onStateToggle(isEnabled) {
        currentSettings.enabled = isEnabled;
        saveSettings();
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
