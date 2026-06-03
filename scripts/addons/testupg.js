// ==UserScript==
// @name          Ulepszator baddonz
// @version       0.4
// @description   Automatyczne ulepszanie (API 2.0 - Pełna integracja UI)
// @author        besiak
// @match         https://*.margonem.pl/*
// @grant         none
// ==/UserScript==

(function () {
    'use strict';

    const ADDON_ID = "UPG";
    const MICC_BASE_URL = 'https://micc.garmory-cdn.cloud/obrazki/itemy/';
    const DAILY_COUNT_KEY = "baddonz-daily-upgrade-count";
    const PROGRESS_STORAGE_KEY = "baddonz-enhancement-progress-char";
    
    const VISIBILITY_CHECK_INTERVAL = 100;
    const BAG_CHECK_INTERVAL = 5000;
    const MAX_REAGENTS = 25;

    const EVENT_KEYWORDS = ["Wakacje", "Urodziny Margonem", "Wielkanoc", "Noc Kupały", "Szabat Czarownic", "Halloween", "Gwiazdka", "Licytacja", "Licytacja eventowa"];
    const CL_MAP = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 29];

    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.className = "upg-custom-styles";
    styleSheet.innerText = `
        .baddonz-upg-wnd { width:160px; min-width:160px; }
        .baddonz-upg-wnd-settings { width:260px; min-width:260px; height: auto !important; min-height: unset !important; max-height: unset !important; }
        .baddonz-upg-wnd-settings .baddonz-window-body { height: auto !important; min-height: unset !important; display: flex; flex-direction: column; gap: 5px; }
        .baddonz-upg-wnd .baddonz-window-body { padding: 4px 8px 8px 8px !important; gap: 3px !important; }
        .upgrader-crafting-window { display: none !important; }
        .baddonz-typ-wrapper { display: flex; align-items: center; justify-content: flex-start; cursor: pointer; gap: 5px; padding: 3px; background: rgba(0, 0, 0, 0.3); border-radius: 3px; user-select: none; }
        .baddonz-typ-wrapper:hover { background: rgba(255, 255, 255, 0.1); }
        .upg-slot-container { position: relative; width: 32px; height: 32px; border: 1px solid #444; border-radius: 3px; background: #000; margin-bottom: 5px; }
        .baddonz-upgrader-gif { position: absolute; top: 0; left: 0; width: 32px; height: 32px; cursor: pointer; }
    `;
    if (!document.querySelector(".upg-custom-styles")) document.head.appendChild(styleSheet);

    let currentSettings = {
        // Account 
        enabled: true,
        windowOpacity: 2,
        windowVisible: true,
        settingsWindowVisible: false,
        windowSettingsOpacity: 2,
        isExpanded: true,
        hotkeyKey: "j",
        // Character
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
    };

    let uiMainWindow = null;
    let uiSettingsWindow = null;
    let dailyUpgradeCount = 0;
    let dailyUpgradeLimit = 2000;
    let isUpgrading = false;
    let windowEnabled = false;
    let isEngineObserved = false;
    let isMenuIntercepted = false;

    function loadSettings() {
        if (!window.BaddonzAPI) return;
        const accId = window.BaddonzAPI.accountId;
        let accSettings = {};
        try {
            const data = JSON.parse(localStorage.getItem('BaddonzData')) || {};
            if (data[accId] && data[accId].accountAddons) accSettings = data[accId].accountAddons[ADDON_ID] || {};
        } catch (e) {}

        let charSettings = window.BaddonzAPI.getAddonSettings(ADDON_ID) || {};
        currentSettings = { ...currentSettings, ...accSettings, ...charSettings };

        const storedDaily = parseInt(localStorage.getItem(DAILY_COUNT_KEY));
        dailyUpgradeCount = !isNaN(storedDaily) ? storedDaily : 0;
    }

    function saveSettings() {
        if (!window.BaddonzAPI) return;
        const accId = window.BaddonzAPI.accountId;

        const accKeys = ['enabled', 'windowOpacity', 'windowVisible', 'settingsWindowVisible', 'windowSettingsOpacity', 'isExpanded', 'hotkeyKey'];
        const charKeys = ['hotkeyEnabled', 'use_common', 'use_unique', 'allow_bound_items', 'upgrade_endbattle', 'count_endbattle', 'bags_upgrade', 'count_bags_upgrade', ...CL_MAP.map(cl => `cl${cl}`)];

        let accSettings = {}; let charSettings = {};
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

    // --- PROGRES & ID ---
    function loadProgress(itemId) {
        const charId = window.Engine?.hero?.d?.id;
        if (!charId) return null;
        try {
            const allProgress = JSON.parse(localStorage.getItem(`${PROGRESS_STORAGE_KEY}-${charId}`)) || {};
            return allProgress[itemId] || null;
        } catch (e) { return null; }
    }

    function saveProgress(itemId, progressText) {
        const charId = window.Engine?.hero?.d?.id;
        if (!itemId || !progressText || progressText === "Brak danych" || !charId) return;

        const storageKey = `${PROGRESS_STORAGE_KEY}-${charId}`;
        let allProgress = {};
        try { allProgress = JSON.parse(localStorage.getItem(storageKey)) || {}; } catch (e) {}

        allProgress[itemId] = progressText;
        const upgradedItemId = getUpgradedItemId();
        if (!upgradedItemId || upgradedItemId !== itemId) delete allProgress[itemId];

        localStorage.setItem(storageKey, JSON.stringify(allProgress));
    }

    function getUpgradedItemId() {
        const charId = window.Engine?.hero?.d?.id;
        if (!charId) return null;
        try { return window.localStorage.getItem(`upgrader-charId-${charId}`); } catch (e) { return null; }
    }

    function setUpgradedItemId(itemId) {
        const charId = window.Engine?.hero?.d?.id;
        if (!charId) return;
        window.localStorage.setItem(`upgrader-charId-${charId}`, itemId);
        updateMainDisplay();
    }

    // --- LOGIKA ULEPSZANIA ---
    const getReagents = () => {
        return window.Engine.items.fetchLocationItems("g").reduce((acc, item) => {
            if (!item) return acc;
            const cached = item._cachedStats || {};
            const rarity = cached.rarity || item.rarity;
            const enhancement_upgrade_lvl = cached.enhancement_upgrade_lvl !== undefined ? cached.enhancement_upgrade_lvl : (item.enhancement_upgrade_lvl ?? undefined);
            const isWorthless = ((cached && Object.prototype.hasOwnProperty.call(cached, 'artisan_worthless')) || Object.prototype.hasOwnProperty.call(item, 'artisan_worthless'));
            const cursed_flag = (cached.cursed !== undefined ? cached.cursed : (item.cursed !== undefined ? item.cursed : false));
            const itemLevel = (item.lvl ?? item.level ?? cached.lvl ?? 0);
            
            const isAllowedRarity = (currentSettings.use_common && rarity === 'common') || (currentSettings.use_unique && rarity === 'unique');
            const isAllowedType = currentSettings[`cl${item.cl}`] === true;
            const isUpgraded = enhancement_upgrade_lvl !== undefined && enhancement_upgrade_lvl !== null;
            const isBound = (item.checkSoulbound && item.checkSoulbound()) || (item.checkPermbound && item.checkPermbound());

            let isPartOfBuild = false;
            try { if (typeof item.getBuildsWithThisItem === 'function') { const builds = item.getBuildsWithThisItem(); if (builds && builds.length > 0) isPartOfBuild = true; } } catch (e) { isPartOfBuild = false; }

            if (itemLevel < 20 || cursed_flag || isWorthless) return acc;

            if (isAllowedType && isAllowedRarity && !isEventItem(item) && !isUpgraded && !isWorthless && (currentSettings.allow_bound_items || !isBound) && !isPartOfBuild) {
                acc.push(item.id);
            }
            return acc;
        }, []);
    };

    function isEventItem(item) {
        if (!item || !item.getTipContent) return false;
        const tip = item.getTipContent();
        if (!tip) return false;
        const plainText = tip.replace(/<[^>]+>/g, '');
        return EVENT_KEYWORDS.some(k => plainText.includes(k));
    }

    const getFreeSlots = () => {
        let totalFreeSlots = 0;
        if (typeof window.Engine !== 'undefined' && window.Engine.bags && Array.isArray(window.Engine.bags)) {
            const bagsToCount = window.Engine.bags.length > 0 ? window.Engine.bags.slice(0, window.Engine.bags.length - 1) : window.Engine.bags;
            bagsToCount.forEach(bag => {
                if (Array.isArray(bag) && bag.length >= 2) totalFreeSlots += Math.max(0, bag[0] - bag[1]);
            });
        }
        return totalFreeSlots;
    };

    const chunkReagents = (reagents) => {
        const chunks = [];
        for (let i = 0; i < reagents.length; i += MAX_REAGENTS) chunks.push(reagents.slice(i, i + MAX_REAGENTS));
        return chunks;
    };

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
                    const p = data.enhancement.progress;
                    current = p.current; max = p.max;
                    if (current > 0 && current === max) isCompleted = true;
                }
                setTimeout(() => {
                    const progressText = getEnhancementProgressText();
                    if (progressText !== "Brak danych") saveProgress(itemId, progressText);
                    else if (isCompleted) saveProgress(itemId, `${max}/${max}`);
                    updateMainDisplay();
                    resolve({ current, max, isCompleted });
                }, 300);
            });
        });
    };

    const setReagents = (itemId, reagentIds) => {
        const r = reagentIds.join(",");
        return new Promise((resolve) => window._g(`enhancement&action=progress_preview&item=${itemId}&ingredients=${r}`, (data) => resolve(data)));
    };

    const enhanceItem = (itemId, reagentIds) => {
        if (!itemId || !reagentIds) return;
        const r = reagentIds.join(",");
        return new Promise((resolve) => window._g(`enhancement&action=progress&item=${itemId}&ingredients=${r}`, (data) => resolve(data)));
    };

    function getEnhancementProgressText() {
        try {
            const currentProgressTextEl = window.Engine.crafting.window.wnd.$[0].querySelector('.enhance__progress-text--current');
            if (currentProgressTextEl) return currentProgressTextEl.textContent.trim();
        } catch (e) {}
        return "Brak danych";
    }

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const processChunks = async (upgradedItemId, chunks) => {
        for (const chunk of chunks) {
            if (dailyUpgradeCount >= dailyUpgradeLimit) {
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

    // --- TRIGGERY (Torb, Koniec Walki, Hotkey) ---
    const handleBagCheck = async () => {
        if (!currentSettings.enabled || !currentSettings.bags_upgrade || dailyUpgradeCount >= dailyUpgradeLimit || isUpgrading) return;
        const upgradedItemId = getUpgradedItemId();
        const upgradedItem = window.Engine.items.getItemById(upgradedItemId);
        if (!upgradedItem) return;

        const reagents = getReagents();
        const freeSlots = getFreeSlots();

        if (reagents.length >= 1 && freeSlots <= currentSettings.count_bags_upgrade) {
            isUpgrading = true;
            if(window.message) window.message(`Wolne sloty: ${freeSlots}. Ulepszam! ${upgradedItem.name}.`);
            try {
                toggleEnhancementWindow();
                const progressInfo = await setEnhancedItem(upgradedItemId);
                if (progressInfo.isCompleted) { if(window.message) window.message(`Maksymalny progres osiągnięty.`); return; }
                const chunks = chunkReagents(reagents);
                await processChunks(upgradedItemId, chunks);
            } finally {
                toggleEnhancementWindow();
                isUpgrading = false;
            }
        }
    };

    const handleEndBattle = async () => {
        if (!currentSettings.enabled || !currentSettings.upgrade_endbattle || dailyUpgradeCount >= dailyUpgradeLimit || isUpgrading) return;
        const upgradedItemId = getUpgradedItemId();
        const upgradedItem = window.Engine.items.getItemById(upgradedItemId);
        if (!upgradedItem) return;

        const reagents = getReagents();
        if (reagents.length < currentSettings.count_endbattle) return;

        if(window.message) window.message(`Ulepszam! ${upgradedItem.name}.`);
        isUpgrading = true;
        try {
            toggleEnhancementWindow();
            const progressInfo = await setEnhancedItem(upgradedItemId);
            if (progressInfo.isCompleted) { if(window.message) window.message(`Maksymalny progres osiągnięty.`); return; }
            const chunks = chunkReagents(reagents);
            await processChunks(upgradedItemId, chunks);
        } finally {
            toggleEnhancementWindow();
            isUpgrading = false;
        }
    };

    // --- UI ---
    function updateMainDisplay() {
        if (!uiMainWindow) return;
        const slotWrapper = uiMainWindow.querySelector('#upg-main-slot-wrapper');
        const nameEl = uiMainWindow.querySelector('#upg-item-name');
        const progEl = uiMainWindow.querySelector('#upg-item-progress');
        const limitEl = uiMainWindow.querySelector('#upg-daily-limit');

        slotWrapper.innerHTML = '';
        nameEl.innerText = '';
        progEl.innerText = '';
        limitEl.innerText = `Limit: ${dailyUpgradeCount}/${dailyUpgradeLimit}`;

        const upgradedItemId = getUpgradedItemId();
        if (!upgradedItemId) {
            slotWrapper.innerHTML = `<div class="upg-slot-container"></div>`;
            nameEl.innerText = "Brak przedmiotu";
            return;
        }

        const item = window.Engine.items.getItemById(upgradedItemId);
        if (!item) {
            slotWrapper.innerHTML = `<div class="upg-slot-container"></div>`;
            return;
        }

        nameEl.innerText = item.name;
        const storedProgress = loadProgress(upgradedItemId);
        if (storedProgress) progEl.innerText = `Progres: ${storedProgress}`;

        const iconSource = item.icon || (`${item.id}.png`);
        const gifName = iconSource.replace(/\.[^/.]+$/, '.gif');
        const imgUrl = MICC_BASE_URL + gifName;

        slotWrapper.innerHTML = `
            <div class="upg-slot-container">
                <img src="${imgUrl}" class="baddonz-upgrader-gif" title="Kliknij, aby anulować">
            </div>
        `;

        slotWrapper.querySelector('img').addEventListener('click', () => {
            setUpgradedItemId("");
            if(window.message) window.message(`Anulowano ulepszanie przedmiotu ${item.name}`);
            updateMainDisplay();
        });
    }

    function buildUI() {
        const mainBodyHtml = `
            <div class="baddonz-setting-row" style="margin-bottom:8px;">
                <div class="baddonz-checkbox upg-enabled-checkbox ${currentSettings.enabled ? 'active' : ''}"></div><span class="baddonz-text">Włącz Ulepszarkę</span>
            </div>
            <div class="baddonz-expanded-controls" style="display: ${currentSettings.isExpanded ? 'flex' : 'none'}; flex-direction: column;">
                <div class="baddonz-flex column centered" style="border-bottom: 1px solid #303030; padding-bottom: 5px; margin-bottom: 5px;">
                    <div id="upg-main-slot-wrapper"></div>
                    <div id="upg-item-name" class="baddonz-text" style="color:#ffcc00; font-weight:bold; font-size:11px; text-align:center;"></div>
                    <div id="upg-item-progress" class="baddonz-text" style="color:#aaa; font-size:10px; text-align:center;"></div>
                </div>
                <div id="upg-daily-limit" class="baddonz-text" style="text-align: center; font-size: 11px;">Limit: 0/2000</div>
            </div>
        `;
        uiMainWindow = window.BaddonzAPI.createAddonWindow(ADDON_ID, "Ulepszara", mainBodyHtml, { 
            width: '160px', customId: 'baddonz-upg-wnd', hasSettings: true, hasCollapse: true, hasClose: false 
        });

        const typesGridHtml = CL_MAP.map(cl => `
            <div class="baddonz-typ-wrapper upg-type-toggle" data-cl="${cl}">
                <div class="baddonz-checkbox upg-cl-checkbox ${currentSettings[`cl${cl}`] ? 'active' : ''}"></div>
                <div class="baddonz-type-icon cl-${cl}"></div>
            </div>
        `).join('');

        const settingsBodyHtml = `
            <div class="baddonz-setting-row"><div class="baddonz-checkbox upg-use-common ${currentSettings.use_common ? 'active' : ''}"></div><span>Zwyklaki</span></div>
            <div class="baddonz-setting-row"><div class="baddonz-checkbox upg-use-unique ${currentSettings.use_unique ? 'active' : ''}"></div><span>Unikaty</span></div>
            <div class="baddonz-setting-row"><div class="baddonz-checkbox upg-allow-bound ${currentSettings.allow_bound_items ? 'active' : ''}"></div><span>Związane (Uwaga na kolosy!)</span></div>
            
            <hr style="width: 100%; border-color: #303030; margin: 5px 0;">
            <div class="baddonz-text" style="text-align: center; margin-bottom:3px;">Typy Itemów:</div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px;">
                ${typesGridHtml}
            </div>

            <hr style="width: 100%; border-color: #303030; margin: 5px 0;">
            <div class="baddonz-setting-row hotkey-row">
                <div class="baddonz-label-wrapper"><div class="baddonz-checkbox upg-hotkey-enabled ${currentSettings.hotkeyEnabled ? 'active' : ''}"></div><span>Klawisz</span></div>
                <input type="text" class="baddonz-input keybind upg-hotkey-input" value="${currentSettings.hotkeyKey === ' ' ? 'SPACJA' : currentSettings.hotkeyKey.toUpperCase()}">
            </div>

            <hr style="width: 100%; border-color: #303030; margin: 5px 0;">
            <div class="baddonz-setting-row"><div class="baddonz-checkbox upg-endbattle-enabled ${currentSettings.upgrade_endbattle ? 'active' : ''}"></div><span>Po walce</span></div>
            <div class="baddonz-setting-row"><span>Min. Reagentów:</span><input type="number" class="baddonz-input upg-endbattle-count" min="1" value="${currentSettings.count_endbattle}"></div>

            <hr style="width: 100%; border-color: #303030; margin: 5px 0;">
            <div class="baddonz-setting-row"><div class="baddonz-checkbox upg-bags-enabled ${currentSettings.bags_upgrade ? 'active' : ''}"></div><span>Po slotach w torbie</span></div>
            <div class="baddonz-setting-row"><span>Max wolnych slotów:</span><input type="number" class="baddonz-input upg-bags-count" min="1" value="${currentSettings.count_bags_upgrade}"></div>
        `;
        
        uiSettingsWindow = window.BaddonzAPI.createAddonWindow(ADDON_ID, "Ulepszara Ustawienia", settingsBodyHtml, { 
            width: '260px', customId: 'baddonz-upg-wnd-settings' 
        });
        uiSettingsWindow.style.display = currentSettings.settingsWindowVisible ? 'flex' : 'none';

        // MAIN BINDINGS
        uiMainWindow.querySelector(".upg-enabled-checkbox").addEventListener('click', function() {
            currentSettings.enabled = this.classList.toggle('active'); saveSettings();
        });
        
        const collapseBtn = uiMainWindow.querySelector(".baddonz-collapsed");
        if (collapseBtn) {
            collapseBtn.addEventListener('click', () => {
                currentSettings.isExpanded = !currentSettings.isExpanded;
                uiMainWindow.querySelector(".baddonz-expanded-controls").style.display = currentSettings.isExpanded ? 'flex' : 'none';
                saveSettings();
            });
        }
        
        const settingsBtn = uiMainWindow.querySelector(".baddonz-settings-button");
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                const isVisible = uiSettingsWindow.style.display !== 'none';
                uiSettingsWindow.style.display = isVisible ? 'none' : 'flex';
                currentSettings.settingsWindowVisible = !isVisible;
                saveSettings();
            });
        }

        // SETTINGS BINDINGS
        const bindCb = (selector, key) => {
            const cb = uiSettingsWindow.querySelector(selector);
            cb.addEventListener('click', () => { currentSettings[key] = cb.classList.toggle('active'); saveSettings(); });
        };
        bindCb(".upg-use-common", "use_common");
        bindCb(".upg-use-unique", "use_unique");
        bindCb(".upg-allow-bound", "allow_bound_items");
        bindCb(".upg-hotkey-enabled", "hotkeyEnabled");
        bindCb(".upg-endbattle-enabled", "upgrade_endbattle");
        bindCb(".upg-bags-enabled", "bags_upgrade");

        uiSettingsWindow.querySelectorAll(".upg-type-toggle").forEach(wrapper => {
            wrapper.addEventListener('click', function() {
                const cl = this.getAttribute('data-cl');
                const cb = this.querySelector('.upg-cl-checkbox');
                currentSettings[`cl${cl}`] = cb.classList.toggle('active');
                saveSettings();
            });
        });

        const inEndbattle = uiSettingsWindow.querySelector(".upg-endbattle-count");
        inEndbattle.addEventListener('change', () => { currentSettings.count_endbattle = Math.max(1, parseInt(inEndbattle.value) || 1); inEndbattle.value = currentSettings.count_endbattle; saveSettings(); });
        
        const inBags = uiSettingsWindow.querySelector(".upg-bags-count");
        inBags.addEventListener('change', () => { currentSettings.count_bags_upgrade = Math.max(1, parseInt(inBags.value) || 1); inBags.value = currentSettings.count_bags_upgrade; saveSettings(); });

        const hotkeyInput = uiSettingsWindow.querySelector(".upg-hotkey-input");
        const handleHotkeySetting = (e) => {
            if (['Tab', 'Enter', 'Escape', 'Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
            e.preventDefault(); e.stopPropagation();
            let newKey = e.key.toLowerCase().slice(0, 1);
            if (newKey) currentSettings.hotkeyKey = newKey;
            else if (e.key === ' ') currentSettings.hotkeyKey = ' ';
            hotkeyInput.classList.remove("active-keybind-mode");
            hotkeyInput.removeEventListener('keydown', handleHotkeySetting);
            hotkeyInput.blur();
            hotkeyInput.value = (currentSettings.hotkeyKey === ' ' ? 'SPACJA' : currentSettings.hotkeyKey.toUpperCase());
            saveSettings();
        };
        hotkeyInput.addEventListener('focus', () => {
            hotkeyInput.classList.add("active-keybind-mode");
            hotkeyInput.addEventListener('keydown', handleHotkeySetting);
        });
        hotkeyInput.addEventListener('blur', () => {
            hotkeyInput.classList.remove("active-keybind-mode");
            hotkeyInput.removeEventListener('keydown', handleHotkeySetting);
        });

        uiSettingsWindow.querySelector('.baddonz-close-button').addEventListener('click', () => {
            currentSettings.settingsWindowVisible = false;
            uiSettingsWindow.style.display = 'none';
            saveSettings();
        });

        updateMainDisplay();
    }

    const intercept = (obj, key, cb) => {
        const _orig = obj[key];
        obj[key] = function (...args) { cb.apply(this, args); return _orig.apply(this, args); };
    };

    function addonInit() {
        loadSettings();
        if (!uiMainWindow) buildUI();

        // Hook na otrzymywanie paczek z serwera (limit i zużycie)
        if (!isEngineObserved) {
            intercept(window.Engine.communication, 'parseJSON', (data) => {
                if (data?.enhancement?.usages_preview?.count !== undefined) {
                    dailyUpgradeCount = data.enhancement.usages_preview.count;
                    dailyUpgradeLimit = data.enhancement.usages_preview.limit || dailyUpgradeLimit;
                    localStorage.setItem(DAILY_COUNT_KEY, dailyUpgradeCount);
                    updateMainDisplay();
                }
            });
            isEngineObserved = true;
        }

        // Hook na menu kontekstowe PPM (Ulepsz ten przedmiot)
        if (!isMenuIntercepted) {
            intercept(window.Engine.interface, 'showPopupMenu', function (options, event) {
                const target = event.target;
                const $itemEl = $(target).closest('.item');
                const idMatch = ($itemEl.length ? $itemEl.attr('class') : target.className)?.match(/item-id-(\d+)/);
                const id = idMatch ? idMatch[1] : null;
                if (!id) return;

                const item = window.Engine.items.getItemById(id);
                if (!item || !CL_MAP.includes(parseInt(item.cl, 10))) return;

                const currentSelectedItemId = getUpgradedItemId();
                let menuItem;

                if (id === currentSelectedItemId) {
                    menuItem = ["Anuluj ulepszanie", () => {
                        setUpgradedItemId("");
                        if(window.message) window.message(`Anulowano ulepszanie przedmiotu ${item.name}`);
                    }, { button: { cls: "menu-item--red" } }];
                } else {
                    menuItem = ["Ulepsz ten przedmiot", async () => {
                        setUpgradedItemId(id);
                        if(window.message) window.message(`Ulepszanie przedmiotu ${item.name}`);
                        toggleEnhancementWindow();
                        await setEnhancedItem(id);
                        toggleEnhancementWindow();
                    }, { button: { cls: "menu-item--green" } }];
                }

                // Dodajemy na samą górę menu
                options.unshift(menuItem);
            });
            isMenuIntercepted = true;
        }

        // Hook na koniec walki
        if (typeof window.Engine.battle?.setEndBattle === 'function') {
            intercept(window.Engine.battle, 'setEndBattle', () => { handleEndBattle(); });
        }

        // Klawisz przypisany z menu
        window.document.addEventListener("keydown", async (event) => {
            const hotkey = currentSettings.hotkeyKey.toLowerCase();
            const isInputActive = ["TEXTAREA", "MAGIC_INPUT", "INPUT"].includes(document.activeElement?.tagName);
            if (event.key.toLowerCase() !== hotkey || isInputActive) return;

            if (isUpgrading) { event.preventDefault(); return; }
            if (currentSettings.enabled && currentSettings.hotkeyEnabled) {
                isUpgrading = true;
                try {
                    if (typeof window.Engine.battle.d !== 'undefined' && window.Engine.battle.d.id !== 0) {
                        if(window.message) window.message("Nie można ręcznie ulepszać podczas walki.");
                        return;
                    }
                    if (dailyUpgradeCount >= dailyUpgradeLimit) {
                        if(window.message) window.message(`Osiągnięto dzienny limit ${dailyUpgradeLimit} ulepszeń.`);
                        return;
                    }
                    const upgradedItemId = getUpgradedItemId();
                    const upgradedItem = window.Engine.items.getItemById(upgradedItemId);
                    if (!upgradedItem) { if(window.message) window.message("Nie znaleziono wybranego przedmiotu."); return; }

                    const reagents = getReagents();
                    if (reagents.length === 0) { if(window.message) window.message("Nie znaleziono odpowiednich składników."); return; }

                    event.preventDefault();
                    toggleEnhancementWindow();
                    const chunks = chunkReagents(reagents);
                    const progressInfo = await setEnhancedItem(upgradedItemId);
                    
                    if (progressInfo.isCompleted) {
                        if(window.message) window.message(`Ulepszanie zakończone. ${upgradedItem.name} osiągnął MAX progres.`);
                        toggleEnhancementWindow();
                        return;
                    }
                    await processChunks(upgradedItemId, chunks);
                    toggleEnhancementWindow();
                } finally {
                    isUpgrading = false;
                }
            }
        });

        // Wątek sprawdzający torbę
        setTimeout(function bagLoop() {
            if (currentSettings.bags_upgrade && currentSettings.enabled) handleBagCheck();
            setTimeout(bagLoop, BAG_CHECK_INTERVAL);
        }, BAG_CHECK_INTERVAL);
    }

    function addonStop() {
        if (uiMainWindow) { uiMainWindow.remove(); uiMainWindow = null; }
        if (uiSettingsWindow) { uiSettingsWindow.remove(); uiSettingsWindow = null; }
    }

    function onStateToggle(isEnabled) {
        currentSettings.enabled = isEnabled;
        if (uiMainWindow) {
            const cb = uiMainWindow.querySelector(".upg-enabled-checkbox");
            if (cb) {
                if (isEnabled) cb.classList.add('active');
                else cb.classList.remove('active');
            }
        }
        saveSettings();
    }

    const checkApi = () => {
        if (!window.BaddonzAPI || !window.BaddonzAPI.registerAddon) {
            setTimeout(checkApi, 500); return;
        }
        window.BaddonzAPI.registerAddon(ADDON_ID, { init: addonInit, stop: addonStop, onStateToggle: onStateToggle });
    };

    checkApi();

})();
