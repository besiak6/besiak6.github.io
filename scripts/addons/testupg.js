// ==UserScript==
// @name          Ulepszator baddonz
// @version       0.4
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
    
    const MAX_REAGENTS = 25;
    const BAG_CHECK_INTERVAL = 5000;
    const EVENT_KEYWORDS = ["Wakacje", "Urodziny Margonem", "Wielkanoc", "Noc Kupały", "Szabat Czarownic", "Halloween", "Gwiazdka", "Licytacja", "Licytacja eventowa"];
    
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
        5: 'Pomocnicze', 6: 'Różdżki', 7: 'Orby', 8: 'Zbroje', 9: 'Hełmy',
        10: 'Buty', 11: 'Rękawice', 12: 'Pierki', 13: 'Naszyjniki',
        14: 'Tarcze', 29: 'Strzały',
    };

    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.className = "upg-custom-styles";
    styleSheet.innerText = `
        .upgrader-crafting-window { display: none !important; }
        .baddonz-upg-wnd { width: 140px; min-width: 140px; }
        .baddonz-upg-wnd-settings { width: 250px; min-width: 250px; height: auto !important; min-height: unset !important; }
        .baddonz-upg-wnd-settings .baddonz-window-body { height: auto !important; min-height: unset !important; display: flex; flex-direction: column; gap: 5px; }
        .baddonz-upg-wnd .baddonz-window-body { padding: 0px 5px 5px 5px !important; gap: 3px !important; }
        
        .baddonz-typ-wrapper { display: flex; align-items: center; justify-content: center; cursor: pointer; gap: 3px; padding: 3px; background: rgba(0, 0, 0, 0.3); border-radius: 3px; user-select: none; }
        .baddonz-typ-wrapper:hover { background: rgba(255, 255, 255, 0.1); }
        .baddonz-typ-wrapper .baddonz-checkbox { pointer-events: none; }
        
        .baddonz-upgrader-item-cursor { cursor: pointer !important; }
        #baddonz-upgrader-main-item-slot { margin: 0 auto; display: flex; justify-content: center; align-items: center; }
        
        .baddonz-upgrader-daily-limit-wrapper { text-align: center; padding: 0; margin-top: 2px; }
        .baddonz-upgrader-daily-limit-single-line { font-size: 11px; color: #fff; display: block; }
        .baddonz-upgrader-daily-limit-single-line.expanded { font-size: 9px !important; }
    `;
    if (!document.querySelector(".upg-custom-styles")) document.head.appendChild(styleSheet);

    let currentSettings = {
        enabled: true,
        windowOpacity: 2,
        windowVisible: true,
        settingsWindowVisible: false,
        windowSettingsOpacity: 2,
        isExpanded: true,
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
        cl11: true, cl12: true, cl13: true, cl14: true, cl29: true
    };

    let uiMainWindow = null;
    let uiSettingsWindow = null;
    let dailyUpgradeCount = 0;
    let dailyUpgradeLimit = 2000;
    let isUpgrading = false;
    let windowEnabled = false;
    let BAG_CHECK_TIMEOUT = null;

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

        const count = parseInt(localStorage.getItem(DAILY_COUNT_KEY));
        dailyUpgradeCount = !isNaN(count) ? count : 0;
    }

    function saveSettings() {
        if (!window.BaddonzAPI) return;
        const accId = window.BaddonzAPI.accountId;

        const accKeys = ['windowOpacity', 'windowVisible', 'settingsWindowVisible', 'windowSettingsOpacity', 'isExpanded', 'hotkeyKey'];
        const charKeys = ['enabled', 'hotkeyEnabled', 'use_common', 'use_unique', 'allow_bound_items', 'upgrade_endbattle', 'count_endbattle', 'bags_upgrade', 'count_bags_upgrade', 'cl1', 'cl2', 'cl3', 'cl4', 'cl5', 'cl6', 'cl7', 'cl8', 'cl9', 'cl10', 'cl11', 'cl12', 'cl13', 'cl14', 'cl29'];

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

    // === PROGRESS LOGIC ===
    function loadProgress(itemId) {
        const charId = window.Engine.hero?.d?.id;
        if (!charId) return null;
        try {
            const allProgress = JSON.parse(localStorage.getItem(`${PROGRESS_STORAGE_KEY}-${charId}`)) || {};
            return allProgress[itemId] || null;
        } catch (e) { return null; }
    }

    function saveProgress(itemId, progressText) {
        const charId = window.Engine.hero?.d?.id;
        if (!itemId || !progressText || progressText === "Brak danych" || !charId) return;
        const storageKey = `${PROGRESS_STORAGE_KEY}-${charId}`;
        let allProgress = {};
        try { allProgress = JSON.parse(localStorage.getItem(storageKey)) || {}; } catch (e) {}
        allProgress[itemId] = progressText;
        if (getUpgradedItemId() !== itemId) delete allProgress[itemId];
        localStorage.setItem(storageKey, JSON.stringify(allProgress));
    }

    function getUpgradedItemId() {
        try { return window.localStorage.getItem(`upgrader-charId-${window.Engine.hero.d.id}`); } 
        catch (e) { return null; }
    }

    function setUpgradedItemId(itemId) {
        if (!window.Engine?.hero?.d) return;
        window.localStorage.setItem(`upgrader-charId-${window.Engine.hero.d.id}`, itemId);
    }

    // === CORE LOGIC ===
    function isEventItem(item) {
        if (!item || !item.getTipContent) return false;
        const tip = item.getTipContent();
        if (!tip) return false;
        const plainText = tip.replace(/<[^>]+>/g, '');
        return EVENT_KEYWORDS.some(keyword => plainText.includes(keyword));
    }

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
            
            const isAllowedRarity = (currentSettings.use_common && rarity === 'common') || (currentSettings.use_unique && rarity === 'unique');
            const itemSettingKey = ITEM_TYPE_SETTINGS_MAP[item.cl];
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
                let isPartOfBuildExtra = false;
                if (typeof Engine.buildsManager !== 'undefined' && item.getBuildsWithThisItem) {
                    try {
                        const buildsExtra = item.getBuildsWithThisItem();
                        if (buildsExtra && buildsExtra.length > 0) isPartOfBuildExtra = true;
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
        if (windowEnabled) {
            Engine.crafting.window.wnd.$.removeClass("upgrader-crafting-window");
            Engine.interface.clickCrafting();
            windowEnabled = false;
            return;
        }
        Engine.crafting.window.wnd.$.addClass("upgrader-crafting-window");
        Engine.interface.clickCrafting();
        windowEnabled = true;
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
                    current = progress.current; max = progress.max;
                    if (current > 0 && current === max) isCompleted = true;
                }
                setTimeout(() => {
                    const progressText = getEnhancementProgressText();
                    if (progressText !== "Brak danych") saveProgress(itemId, progressText);
                    else if (isCompleted) saveProgress(itemId, `${max}/${max}`);
                    updateItemDisplay();
                    resolve({ current, max, isCompleted });
                }, 300);
            });
        });
    };

    const setReagents = (itemId, reagentIds) => new Promise((resolve) => _g(`enhancement&action=progress_preview&item=${itemId}&ingredients=${reagentIds.join(",")}`, resolve));
    const enhanceItem = (itemId, reagentIds) => {
        if (!itemId || !reagentIds) return;
        return new Promise((resolve) => _g(`enhancement&action=progress&item=${itemId}&ingredients=${reagentIds.join(",")}`, resolve));
    };

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const checkDailyLimit = () => dailyUpgradeCount < dailyUpgradeLimit;

    const processChunks = async (upgradedItemId, chunks) => {
        for (const chunk of chunks) {
            if (!checkDailyLimit()) {
                message(`Przerwano ulepszanie. Limit ${dailyUpgradeLimit} osiągnięty.`);
                return true;
            }
            await setReagents(upgradedItemId, chunk);
            await enhanceItem(upgradedItemId, chunk);
            await sleep(200);
            const progressInfo = await setEnhancedItem(upgradedItemId);
            await sleep(100);
            const progressText = getEnhancementProgressText();
            if (progressInfo.isCompleted) {
                message(`Ulepszono! Progres: ${progressText}. (MAX)`);
                return true;
            }
            message(`Ulepszono! Progres: ${progressText}`);
            await sleep(300);
        }
        return false;
    };

    const handleBagCheck = async () => {
        if (!currentSettings.enabled || !currentSettings.bags_upgrade || !checkDailyLimit() || isUpgrading) return;
        const upgradedItemId = getUpgradedItemId();
        const upgradedItem = Engine.items.getItemById(upgradedItemId);
        if (!upgradedItem) return;

        const reagents = getReagents();
        const freeSlots = getFreeSlots();
        if (reagents.length >= 1 && freeSlots <= currentSettings.count_bags_upgrade) {
            isUpgrading = true;
            message(`Wolne sloty: ${freeSlots}. Ulepszam! ${upgradedItem.name}.`);
            try {
                toggleEnhancementWindow();
                const progressInfo = await setEnhancedItem(upgradedItemId);
                if (progressInfo.isCompleted) { message(`Maksymalny progres osiągnięty.`); return; }
                const chunks = chunkReagents(reagents);
                await processChunks(upgradedItemId, chunks);
            } finally {
                toggleEnhancementWindow();
                isUpgrading = false;
            }
        }
    };

    const handleEndBattle = async () => {
        if (!currentSettings.enabled || !currentSettings.upgrade_endbattle || !checkDailyLimit() || isUpgrading) return;
        const upgradedItemId = getUpgradedItemId();
        const upgradedItem = Engine.items.getItemById(upgradedItemId);
        if (!upgradedItem) return;

        const reagents = getReagents();
        if (reagents.length < currentSettings.count_endbattle) return;

        message(`Ulepszam! ${upgradedItem.name}.`);
        isUpgrading = true;
        try {
            toggleEnhancementWindow();
            const progressInfo = await setEnhancedItem(upgradedItemId);
            if (progressInfo.isCompleted) { message(`Maksymalny progres osiągnięty.`); return; }
            const chunks = chunkReagents(reagents);
            await processChunks(upgradedItemId, chunks);
        } finally {
            toggleEnhancementWindow();
            isUpgrading = false;
        }
    };

    // === UI UPDATES ===
    function updateItemDisplay() {
        if (!uiMainWindow || typeof Engine === 'undefined' || !Engine.items) return;
        const itemId = getUpgradedItemId();
        const item = Engine.items.getItemById(itemId);
        
        const $slotWrapper = $(uiMainWindow).find('#baddonz-upgrader-item-slot-wrapper');
        const nameEl = uiMainWindow.querySelector("#baddonz-upgrader-item-name");
        const progressEl = uiMainWindow.querySelector("#baddonz-upgrader-item-progress");

        $slotWrapper.empty();
        nameEl.textContent = "";
        progressEl.textContent = "";

        const $slotContainer = $(`
            <div class="enhance__item enhance__item--current interface-element-one-item-slot-decor" id="baddonz-upgrader-main-item-slot">
                <div class="slot"></div>
                <div class="lvl" data-lvl="0"><div class="cl-icon icon-star-0"></div></div>
            </div>
        `);

        if (!item) {
            $slotWrapper.append($slotContainer);
            return;
        }

        const upgradeLvl = item.upgrade_lvl || 0;
        $slotContainer.find('.lvl').attr('data-lvl', upgradeLvl).html(`<div class="cl-icon icon-star-${upgradeLvl}"></div>`);
        nameEl.textContent = item.name;

        const storedProgress = loadProgress(itemId);
        if (storedProgress) progressEl.textContent = `Progres: ${storedProgress}`;

        const $clonedItem = item.$.clone();
        $clonedItem.addClass('baddonz-upgrader-item-cursor');
        $clonedItem.on('click', () => {
            setUpgradedItemId("");
            message(`Anulowano ulepszanie przedmiotu ${item.name}`);
            updateItemDisplay();
        });

        $clonedItem.css({ 'position': 'relative', 'width': '32px', 'height': '32px', 'top': '0', 'left': '0' });
        $clonedItem.find('canvas.icon, canvas.canvas-notice').remove();

        const iconSource = item.icon || (`${item.id}.png`);
        const imgUrl = MICC_BASE_URL + iconSource.replace(/\.[^/.]+$/, '.gif');
        const $img = $('<img>').attr('src', imgUrl).css({ width: '32px', height: '32px', position: 'absolute', top: '0', left: '0', zIndex: '0' });
        
        $clonedItem.append($img);
        $slotContainer.find('.slot').append($clonedItem);
        $slotWrapper.append($slotContainer);
    }

    function updateMainWindowLimits() {
        if (!uiMainWindow) return;
        const dailyLimitEl = uiMainWindow.querySelector("#baddonz-upgrader-daily-limit");
        dailyLimitEl.textContent = `Dzienny Limit: ${dailyUpgradeCount}/${dailyUpgradeLimit}`;
        if (currentSettings.isExpanded) dailyLimitEl.classList.remove('expanded');
        else dailyLimitEl.classList.add('expanded');
        
        const itemDetails = uiMainWindow.querySelector("#baddonz-upgrader-item-details");
        itemDetails.style.display = currentSettings.isExpanded ? 'flex' : 'none';
    }

    function generateItemTypeFiltersHtml() {
        const ITEM_CL_MAP = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 29];
        let html = '';
        ITEM_CL_MAP.forEach(cl => {
            const key = `cl${cl}`;
            const isActive = currentSettings[key] ? 'active' : '';
            html += `
                <div class="baddonz-typ-wrapper" data-key="${key}" data-cl="${cl}">
                    <div class="baddonz-checkbox ${isActive}"></div>
                    <div class="baddonz-type-icon cl-${cl}"></div>
                </div>
            `;
        });
        return html;
    }

    function buildUI() {
        const mainBodyHtml = `
            <div id="baddonz-upgrader-item-details" class="baddonz-flex column" style="display: ${currentSettings.isExpanded ? 'flex' : 'none'}; border-bottom: 1px solid #303030; padding: 0 0 5px 0; align-items: center; width: 100%;">
                <div id="baddonz-upgrader-item-display-container" class="baddonz-flex column" style="align-items: center; gap: 2px; margin-top: 5px; justify-content: center; width: 100%;">
                    <div id="baddonz-upgrader-item-slot-wrapper" class="baddonz-flex"></div>
                    <div class="baddonz-text" id="baddonz-upgrader-item-name" style="padding: 0; font-size: 11px; font-weight: bold; color: #ffcc00; text-shadow: 1px 1px #000; text-align: center;"></div>
                    <div class="baddonz-text" id="baddonz-upgrader-item-progress" style="padding: 0; font-size: 10px; color: #aaa; text-shadow: 1px 1px #000; text-align: center;"></div>
                </div>
            </div>
            <div class="baddonz-text baddonz-upgrader-daily-limit-wrapper">
                <div id="baddonz-upgrader-daily-limit" class="baddonz-upgrader-daily-limit-single-line ${currentSettings.isExpanded ? '' : 'expanded'}">0/2000</div>
            </div>
        `;

        uiMainWindow = window.BaddonzAPI.createAddonWindow(ADDON_ID, "Ulepszara", mainBodyHtml, { 
            width: '140px', 
            customId: 'baddonz-upg-wnd',
            hasSettings: true,
            hasCollapse: true,
            hasClose: false,
            hasState: true // Wymaga nowej łatki do API
        });
        uiMainWindow.classList.add('baddonz-upg-wnd');

        const settingsBodyHtml = `
            <div class="baddonz-label-wrapper"><div class="baddonz-checkbox" id="upg-use-common"></div><div class="baddonz-text">Ulepszaj Zwyklakami</div></div>
            <div class="baddonz-label-wrapper"><div class="baddonz-checkbox" id="upg-use-unique"></div><div class="baddonz-text">Ulepszaj Unikatami</div></div>
            <div class="baddonz-label-wrapper"><div class="baddonz-checkbox" id="upg-allow-bound"></div><div class="baddonz-text">Ulepszaj Związanymi</div></div>
            <hr style="width: 100%; border-color: #303030; margin: 5px 0;">
            <div class="baddonz-text" style="text-align: center; margin-bottom: 3px;">Typy Itemów:</div>
            <div id="upg-type-filters" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px;">
                ${generateItemTypeFiltersHtml()}
            </div>
            <hr style="width: 100%; border-color: #303030; margin: 5px 0;">
            <div class="baddonz-label-wrapper"><div class="baddonz-checkbox" id="upg-hotkey-enabled"></div><div class="baddonz-text">Ulepszanie Klawiszem</div></div>
            <div id="upg-hotkey-options" class="baddonz-flex column" style="margin-left: 5px; display: ${currentSettings.hotkeyEnabled ? 'flex' : 'none'};">
                <input type="text" class="baddonz-input" id="upg-hotkey-input" maxlength="7" style="width: 100%; text-transform: uppercase; text-align: center;" value="${currentSettings.hotkeyKey === ' ' ? 'SPACJA' : currentSettings.hotkeyKey.toUpperCase()}">
            </div>
            <div class="baddonz-label-wrapper"><div class="baddonz-checkbox" id="upg-endbattle-check"></div><div class="baddonz-text">Ulepszaj po walce</div></div>
            <div id="upg-endbattle-options" class="baddonz-flex column" style="margin-left: 5px; display: ${currentSettings.upgrade_endbattle ? 'flex' : 'none'};">
                <div class="baddonz-text" style="font-size: 10px; margin-bottom: 1px;">Min. Liczba Reagentów:</div>
                <input type="number" class="baddonz-input" id="upg-endbattle-input" min="1" max="50" style="width: 100%; text-align: center;" value="${currentSettings.count_endbattle}">
            </div>
            <div class="baddonz-label-wrapper"><div class="baddonz-checkbox" id="upg-bags-check"></div><div class="baddonz-text">Ulepszanie po miejscach</div></div>
            <div id="upg-bags-options" class="baddonz-flex column" style="margin-left: 5px; display: ${currentSettings.bags_upgrade ? 'flex' : 'none'};">
                <div class="baddonz-text" style="font-size: 10px; margin-bottom: 1px;">Max. Wolne Sloty:</div>
                <input type="number" class="baddonz-input" id="upg-bags-input" min="1" max="100" style="width: 100%; text-align: center;" value="${currentSettings.count_bags_upgrade}">
            </div>
        `;
        uiSettingsWindow = window.BaddonzAPI.createAddonWindow(ADDON_ID, "Ulepszara - Ustaw", settingsBodyHtml, { width: '250px', customId: 'baddonz-upg-wnd-settings' });
        uiSettingsWindow.classList.add('baddonz-upg-wnd-settings');
        uiSettingsWindow.style.display = currentSettings.settingsWindowVisible ? 'flex' : 'none';

        // MAIN WND LOGIC
        const collapseBtn = uiMainWindow.querySelector(".baddonz-collapsed");
        const settingsBtn = uiMainWindow.querySelector(".baddonz-settings-button");
        const stateBtn = uiMainWindow.querySelector(".baddonz-state-button");
        
        if (stateBtn) {
            stateBtn.classList.toggle('active', currentSettings.enabled);
            stateBtn.addEventListener('click', () => {
                currentSettings.enabled = stateBtn.classList.toggle('active');
                saveSettings();
                if (typeof $ === 'function' && typeof $.fn.tip === 'function') $(stateBtn).tip(currentSettings.enabled ? 'Wyłącz' : 'Włącz');
            });
        }

        if (collapseBtn) {
            collapseBtn.addEventListener('click', () => {
                currentSettings.isExpanded = !currentSettings.isExpanded;
                updateMainWindowLimits();
                saveSettings();
                if (typeof $ === 'function' && typeof $.fn.tip === 'function') $(collapseBtn).tip(currentSettings.isExpanded ? "Zwiń" : "Rozwiń");
            });
        }

        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                const isVisible = uiSettingsWindow.style.display !== 'none';
                uiSettingsWindow.style.display = isVisible ? 'none' : 'flex';
                currentSettings.settingsWindowVisible = !isVisible;
                saveSettings();
            });
        }
        uiSettingsWindow.querySelector('.baddonz-close-button').addEventListener('click', () => {
            currentSettings.settingsWindowVisible = false;
            uiSettingsWindow.style.display = 'none';
            saveSettings();
        });

        // SETTINGS WND LOGIC
        const bindCheckbox = (id, key, extraLogic = null) => {
            const cb = uiSettingsWindow.querySelector(`#${id}`);
            cb.classList.toggle('active', currentSettings[key]);
            cb.addEventListener('click', () => {
                currentSettings[key] = cb.classList.toggle('active');
                saveSettings();
                if (extraLogic) extraLogic(currentSettings[key]);
            });
        };

        bindCheckbox('upg-use-common', 'use_common');
        bindCheckbox('upg-use-unique', 'use_unique');
        bindCheckbox('upg-allow-bound', 'allow_bound_items');
        
        bindCheckbox('upg-hotkey-enabled', 'hotkeyEnabled', (val) => {
            uiSettingsWindow.querySelector('#upg-hotkey-options').style.display = val ? 'flex' : 'none';
        });
        bindCheckbox('upg-endbattle-check', 'upgrade_endbattle', (val) => {
            uiSettingsWindow.querySelector('#upg-endbattle-options').style.display = val ? 'flex' : 'none';
        });
        bindCheckbox('upg-bags-check', 'bags_upgrade', (val) => {
            uiSettingsWindow.querySelector('#upg-bags-options').style.display = val ? 'flex' : 'none';
        });

        // TYPE FILTERS
        uiSettingsWindow.querySelectorAll('.baddonz-typ-wrapper').forEach(wrapper => {
            const key = wrapper.getAttribute('data-key');
            const cl = parseInt(wrapper.getAttribute('data-cl'));
            if (typeof $ === 'function' && typeof $.fn.tip === 'function') $(wrapper).tip(ITEM_CL_NAMES[cl]);
            wrapper.addEventListener('click', () => {
                currentSettings[key] = !currentSettings[key];
                wrapper.querySelector('.baddonz-checkbox').classList.toggle('active', currentSettings[key]);
                saveSettings();
            });
        });

        // HOTKEY
        const hotkeyInput = uiSettingsWindow.querySelector('#upg-hotkey-input');
        const handleHotkeySetting = (e) => {
            if (['Tab', 'Enter', 'Escape', 'Shift', 'Control', 'Alt', 'Meta'].includes(e.key) || (e.key.length > 1 && e.key !== ' ')) return;
            e.preventDefault(); e.stopPropagation();
            let newKey = e.key.toLowerCase().slice(0, 1);
            if (newKey) currentSettings.hotkeyKey = newKey;
            else if (e.key === ' ') currentSettings.hotkeyKey = ' ';
            hotkeyInput.removeEventListener('keydown', handleHotkeySetting);
            hotkeyInput.blur();
            hotkeyInput.value = (currentSettings.hotkeyKey === ' ' ? 'SPACJA' : currentSettings.hotkeyKey.toUpperCase());
            saveSettings();
        };
        hotkeyInput.addEventListener('focus', () => hotkeyInput.addEventListener('keydown', handleHotkeySetting));
        hotkeyInput.addEventListener('blur', () => hotkeyInput.removeEventListener('keydown', handleHotkeySetting));

        // NUMBER INPUTS
        uiSettingsWindow.querySelector('#upg-endbattle-input').addEventListener('change', (e) => {
            currentSettings.count_endbattle = Math.max(1, parseInt(e.target.value) || 1); e.target.value = currentSettings.count_endbattle; saveSettings();
        });
        uiSettingsWindow.querySelector('#upg-bags-input').addEventListener('change', (e) => {
            currentSettings.count_bags_upgrade = Math.max(1, parseInt(e.target.value) || 1); e.target.value = currentSettings.count_bags_upgrade; saveSettings();
        });
    }

    const initItemContextMenu = () => {
        const ogShowPopupMenu = Engine.interface.showPopupMenu;
        Engine.interface.showPopupMenu = function (menu, e) {
            const idMatch = e.currentTarget?.className?.match(/item-id-(\d+)/);
            const itemId = idMatch ? idMatch[1] : null;
            const item = itemId ? Engine.items.getItemById(itemId) : null;
            const currentSelectedItemId = getUpgradedItemId();

            if (!itemId || !ITEM_TYPE_SETTINGS_MAP.hasOwnProperty(item?.cl)) return ogShowPopupMenu.call(this, menu, e);

            let menuItem;
            if (itemId === currentSelectedItemId) {
                menuItem = ["Anuluj ulepszanie", () => {
                    if (!currentSelectedItemId) return;
                    setUpgradedItemId("");
                    message(`Anulowano ulepszanie przedmiotu ${item.name}`);
                    updateItemDisplay();
                }, { button: { cls: "menu-item--red" } }];
            } else {
                menuItem = ["Ulepsz ten przedmiot", async () => {
                    setUpgradedItemId(itemId);
                    message(`Ulepszanie przedmiotu ${item.name}`);
                    toggleEnhancementWindow();
                    await setEnhancedItem(itemId);
                    toggleEnhancementWindow();
                }, { button: { cls: "menu-item--green" } }];
            }

            ogShowPopupMenu.call(this, [menuItem, ...menu], e);
        };
    };

    function addonInit() {
        loadSettings();
        if (!uiMainWindow) { buildUI(); updateItemDisplay(); updateMainWindowLimits(); }

        // Hooks
        if (typeof Engine.communication.parseJSON === 'function' && !Engine.communication._upgHooked) {
            const ogParseJSON = Engine.communication.parseJSON;
            Engine.communication.parseJSON = function (data) {
                if (data?.enhancement?.usages_preview?.count !== undefined) {
                    dailyUpgradeCount = data.enhancement.usages_preview.count;
                    dailyUpgradeLimit = data.enhancement.usages_preview.limit || dailyUpgradeLimit;
                    localStorage.setItem(DAILY_COUNT_KEY, dailyUpgradeCount);
                    updateMainWindowLimits();
                }
                return ogParseJSON.call(this, data);
            };
            Engine.communication._upgHooked = true;
        }

        if (typeof Engine.battle.setEndBattle === 'function' && !Engine.battle._upgHooked) {
            const ogSetEndBattle = Engine.battle.setEndBattle.bind(Engine.battle);
            Engine.battle.setEndBattle = function() {
                ogSetEndBattle();
                if (currentSettings.enabled && currentSettings.upgrade_endbattle) setTimeout(handleEndBattle, 500);
            };
            Engine.battle._upgHooked = true;
        }

        window.document.addEventListener("keydown", async (event) => {
            const hotkey = currentSettings.hotkeyKey.toLowerCase();
            const isInputActive = ["TEXTAREA", "MAGIC_INPUT", "INPUT"].includes(document.activeElement.tagName);
            if (event.key.toLowerCase() !== hotkey || isInputActive) return;
            if (isUpgrading) { event.preventDefault(); return; }

            if (currentSettings.enabled && currentSettings.hotkeyEnabled) {
                isUpgrading = true;
                try {
                    if (typeof Engine.battle.d !== 'undefined' && Engine.battle.d.id !== 0) { message("Nie można ręcznie ulepszać podczas walki."); return; }
                    if (!checkDailyLimit()) { message(`Osiągnięto dzienny limit ${dailyUpgradeLimit} ulepszeń.`); return; }
                    
                    const upgradedItemId = getUpgradedItemId();
                    const upgradedItem = Engine.items.getItemById(upgradedItemId);
                    if (!upgradedItem) { message("Nie znaleziono wybranego przedmiotu."); return; }
                    
                    const reagents = getReagents();
                    if (reagents.length === 0) { message("Nie znaleziono odpowiednich składników."); return; }
                    
                    event.preventDefault();
                    toggleEnhancementWindow();
                    const chunks = chunkReagents(reagents);
                    const progressInfo = await setEnhancedItem(upgradedItemId);
                    
                    if (progressInfo.isCompleted) {
                        message(`Ulepszanie zakończone. ${upgradedItem.name} osiągnął MAX progres.`);
                        toggleEnhancementWindow();
                        return;
                    }
                    await processChunks(upgradedItemId, chunks);
                    toggleEnhancementWindow();
                } finally { isUpgrading = false; }
            }
        });

        initItemContextMenu();

        if (currentSettings.bags_upgrade) {
            BAG_CHECK_TIMEOUT = setInterval(() => { if (currentSettings.enabled && currentSettings.bags_upgrade) handleBagCheck(); }, BAG_CHECK_INTERVAL);
        }
    }

    function addonStop() {
        if (BAG_CHECK_TIMEOUT) clearInterval(BAG_CHECK_TIMEOUT);
        if (uiMainWindow) { uiMainWindow.remove(); uiMainWindow = null; }
        if (uiSettingsWindow) { uiSettingsWindow.remove(); uiSettingsWindow = null; }
    }

    function onStateToggle(isEnabled) {
        currentSettings.enabled = isEnabled;
        if (uiMainWindow) {
            const stateBtn = uiMainWindow.querySelector(".baddonz-state-button");
            if (stateBtn) {
                stateBtn.classList.toggle('active', isEnabled);
                if (typeof $ === 'function' && typeof $.fn.tip === 'function') $(stateBtn).tip(isEnabled ? 'Wyłącz' : 'Włącz');
            }
        }
        saveSettings();
    }

    const checkApi = () => {
        if (!window.BaddonzAPI || !window.BaddonzAPI.registerAddon) { setTimeout(checkApi, 500); return; }
        window.BaddonzAPI.registerAddon(ADDON_ID, { init: addonInit, stop: addonStop, onStateToggle: onStateToggle });
    };
    checkApi();

})();
