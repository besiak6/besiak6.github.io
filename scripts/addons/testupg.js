// ==UserScript==
// @name          Ulepszator baddonz
// @version       1.0
// @author        besiak
// @match         https://*.margonem.pl/
// @grant         none
// ==/UserScript==

(function () {
    'use strict';

    const ADDON_ID = "UL";

    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.className = "ul-custom-styles";
    styleSheet.innerText = `
        .baddonz-ul-wnd { width: 170px; min-width: 170px; }
        .baddonz-ul-wnd-settings { width: 250px; min-width: 250px; height: auto !important; min-height: unset !important; max-height: unset !important; }
        .baddonz-ul-wnd-settings .baddonz-window-body { height: auto !important; min-height: unset !important; display: flex; flex-direction: column; gap: 5px; padding-top: 5px !important; }
        .baddonz-typ-wrapper { display: flex; align-items: center; justify-content: flex-start; cursor: url("https://gordion.margonem.pl/img/gui/cursor/5n.png") 4 0, pointer; gap: 5px; padding: 3px; background: rgba(0, 0, 0, 0.3); border-radius: 3px; user-select: none; border: 1px solid transparent; }
        .baddonz-typ-wrapper:hover { background: rgba(255, 255, 255, 0.1); }
        .baddonz-typ-wrapper.active { border-color: #96f096; background: rgba(70, 70, 70, 0.4); }
        .baddonz-ul-item-cursor { cursor: url("https://gordion.margonem.pl/img/gui/cursor/1n.png") 4 0, pointer !important; }
        .menu-item--yellow { background:rgb(57, 100, 17) !important; color: #fff !important; border-radius: 5px !important; padding: 5px !important; }
        .upgrader-crafting-window { display: none !important; }
        .baddonz-ul-wnd-settings .baddonz-input { height:20px !important; line-height:18px; font-size: 11px; padding: 1px 0px; text-align: center; width: 100%; max-width: 60px; }
        .baddonz-setting-row.hotkey-row span { font-size: 11px; }
    `;
    if (!document.querySelector(".ul-custom-styles")) document.head.appendChild(styleSheet);

    const MICC_BASE_URL = 'https://micc.garmory-cdn.cloud/obrazki/itemy/';
    const DAILY_COUNT_KEY = "baddonz-daily-upgrade-count";
    const PROGRESS_STORAGE_KEY = "baddonz-enhancement-progress-char";
    const MAX_REAGENTS = 25;
    const EVENT_KEYWORDS = ["Wakacje", "Urodziny Margonem", "Wielkanoc", "Noc Kupały", "Szabat Czarownic", "Halloween", "Gwiazdka", "Licytacja", "Licytacja eventowa"];
    const CL = { ONE_HAND_WEAPON: 1, TWO_HAND_WEAPON: 2, ONE_AND_HALF_HAND_WEAPON: 3, DISTANCE_WEAPON: 4, HELP_WEAPON: 5, WAND_WEAPON: 6, ORB_WEAPON: 7, ARMOR: 8, HELMET: 9, BOOTS: 10, GLOVES: 11, RING: 12, NECKLACE: 13, SHIELD: 14, QUIVER: 29 };
    const ITEM_TYPE_SETTINGS_MAP = { [CL.ONE_HAND_WEAPON]: 'cl1', [CL.TWO_HAND_WEAPON]: 'cl2', [CL.ONE_AND_HALF_HAND_WEAPON]: 'cl3', [CL.DISTANCE_WEAPON]: 'cl4', [CL.HELP_WEAPON]: 'cl5', [CL.WAND_WEAPON]: 'cl6', [CL.ORB_WEAPON]: 'cl7', [CL.ARMOR]: 'cl8', [CL.HELMET]: 'cl9', [CL.BOOTS]: 'cl10', [CL.GLOVES]: 'cl11', [CL.RING]: 'cl12', [CL.NECKLACE]: 'cl13', [CL.SHIELD]: 'cl14', [CL.QUIVER]: 'cl29' };
    const ITEM_CL_NAMES = { 1: 'Jednoręczne', 2: 'Dwuręczne', 3: 'Półtoraręczne', 4: 'Łuki', 5: 'Pomocnicze', 6: 'Różdżki', 7: 'Orby', 8: 'Zbroje', 9: 'Hełmy', 10: 'Buty', 11: 'Rękawice', 12: 'Pierścienie', 13: 'Naszyjniki', 14: 'Tarcze', 29: 'Strzały' };

    let currentSettings = {
        enabled: true,
        windowOpacity: 2,
        settingsWindowVisible: false,
        windowSettingsOpacity: 2,
        isExpanded: true,
        hotkeyEnabled: true,
        hotkeyKey: "j",
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
    let isMenuIntercepted = false;
    let isEndBattleHooked = false;
    let BAG_INTERVAL = null;

    function loadSettings() {
        if (!window.BaddonzAPI) return;
        const accId = window.BaddonzAPI.accountId;
        try {
            const data = JSON.parse(localStorage.getItem('BaddonzData')) || {};
            if (data[accId] && data[accId].accountAddons && data[accId].accountAddons[ADDON_ID]) {
                Object.assign(currentSettings, data[accId].accountAddons[ADDON_ID]);
            }
        } catch (e) {}

        const charSettings = window.BaddonzAPI.getAddonSettings(ADDON_ID) || {};
        Object.assign(currentSettings, charSettings);

        const count = parseInt(localStorage.getItem(DAILY_COUNT_KEY));
        dailyUpgradeCount = !isNaN(count) ? count : 0;
    }

    function saveSettings() {
        if (!window.BaddonzAPI) return;
        const accId = window.BaddonzAPI.accountId;
        const accKeys = ['enabled', 'windowOpacity', 'settingsWindowVisible', 'windowSettingsOpacity', 'isExpanded'];
        const charKeys = ['hotkeyEnabled', 'hotkeyKey', 'use_common', 'use_unique', 'allow_bound_items', 'upgrade_endbattle', 'count_endbattle', 'bags_upgrade', 'count_bags_upgrade', 'cl1', 'cl2', 'cl3', 'cl4', 'cl5', 'cl6', 'cl7', 'cl8', 'cl9', 'cl10', 'cl11', 'cl12', 'cl13', 'cl14', 'cl29'];

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

    function loadProgress(itemId) {
        const charId = window.Engine?.hero?.d?.id;
        if (!charId) return null;
        const storageKey = `${PROGRESS_STORAGE_KEY}-${charId}`;
        try { return (JSON.parse(localStorage.getItem(storageKey)) || {})[itemId] || null; } catch(e) { return null; }
    }

    function saveProgress(itemId, progressText) {
        const charId = window.Engine?.hero?.d?.id;
        if (!itemId || !progressText || progressText === "Brak danych" || !charId) return;
        const storageKey = `${PROGRESS_STORAGE_KEY}-${charId}`;
        try {
            let allProgress = JSON.parse(localStorage.getItem(storageKey)) || {};
            allProgress[itemId] = progressText;
            const upgradedItemId = getUpgradedItemId();
            if (!upgradedItemId || upgradedItemId !== itemId) delete allProgress[itemId];
            localStorage.setItem(storageKey, JSON.stringify(allProgress));
        } catch(e) {}
    }

    function saveDailyUpgradeCount(count) {
        localStorage.setItem(DAILY_COUNT_KEY, count);
    }

    function setUpgradedItemId(itemId) {
        if (!window.Engine || !window.Engine.hero || !window.Engine.hero.d) return;
        window.localStorage.setItem(`upgrader-charId-${window.Engine.hero.d.id}`, itemId);
    }

    function getUpgradedItemId() {
        try { return window.localStorage.getItem(`upgrader-charId-${window.Engine.hero.d.id}`); } catch (e) { return null; }
    }

    function getEnhancementProgressText() {
        try {
            const currentProgressTextEl = window.Engine.crafting.window.wnd.$[0].querySelector('.enhance__progress-text--current');
            if (currentProgressTextEl) return currentProgressTextEl.textContent.trim();
        } catch (e) {}
        return "Brak danych";
    }

    function isEventItem(item) {
        if (!item || !item.getTipContent) return false;
        const tip = item.getTipContent();
        if (!tip) return false;
        const plainText = tip.replace(/<[^>]+>/g, '');
        return EVENT_KEYWORDS.some(keyword => plainText.includes(keyword));
    }

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
                let isPartOfBuildExtra = false;
                if (typeof window.Engine.buildsManager !== 'undefined' && item.getBuildsWithThisItem) {
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

    const setEnhancedItem = (itemId) => {
        return new Promise((resolve) => {
            window._g(`enhancement&action=status&item=${itemId}`, (data) => {
                let current = 0, max = 0, isCompleted = false;
                if (data?.enhancement?.progress) {
                    const progress = data.enhancement.progress;
                    current = progress.current;
                    max = progress.max;
                    if (current > 0 && current === max) isCompleted = true;
                }
                setTimeout(() => {
                    const progressText = getEnhancementProgressText();
                    if (progressText !== "Brak danych") saveProgress(itemId, progressText);
                    else if (isCompleted) saveProgress(itemId, `${max}/${max}`);
                    updateItemDisplay(itemId);
                    resolve({ current, max, isCompleted });
                }, 300);
            });
        });
    };

    const setReagents = (itemId, reagentIds) => {
        const reagents = reagentIds.join(",");
        return new Promise((resolve) => {
            window._g(`enhancement&action=progress_preview&item=${itemId}&ingredients=${reagents}`, (data) => resolve(data));
        });
    };

    const enhanceItem = (itemId, reagentIds) => {
        if (!itemId || !reagentIds) return;
        const reagents = reagentIds.join(",");
        return new Promise((resolve) => {
            window._g(`enhancement&action=progress&item=${itemId}&ingredients=${reagents}`, (data) => resolve(data));
        });
    };

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const checkDailyLimit = () => { return dailyUpgradeCount < dailyUpgradeLimit; };

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

    const handleBagCheck = async () => {
        if (!currentSettings.enabled || !currentSettings.bags_upgrade || !checkDailyLimit() || isUpgrading) return;
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
        }
    };

    const handleEndBattle = async () => {
        if (!currentSettings.enabled || !currentSettings.upgrade_endbattle || !checkDailyLimit() || isUpgrading) return;
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

    function updateItemDisplay(itemId) {
        if (!uiMainWindow) return;
        const $slotWrapper = $(uiMainWindow.querySelector('#baddonz-ul-item-slot-wrapper'));
        const nameEl = uiMainWindow.querySelector("#baddonz-ul-item-name");
        const progressEl = uiMainWindow.querySelector("#baddonz-ul-item-progress");

        $slotWrapper.empty();
        if (!itemId || !window.Engine || !window.Engine.items) {
            nameEl.textContent = "Brak przedmiotu";
            progressEl.textContent = "Wybierz z ekwipunku";
            return;
        }

        const item = window.Engine.items.getItemById(itemId);
        if (!item) {
            nameEl.textContent = "Brak przedmiotu";
            progressEl.textContent = "Nie znaleziono w torbie";
            return;
        }

        nameEl.textContent = item.name;
        const storedProgress = loadProgress(itemId);
        if (storedProgress) progressEl.textContent = `Progres: ${storedProgress}`;
        else progressEl.textContent = `Progres: Brak danych`;

        const iconSource = item.icon || (`${item.id}.png`);
        const gifName = iconSource.replace(/\.[^/.]+$/, '.gif');
        const imgUrl = MICC_BASE_URL + gifName;

        const stats = item._cachedStats || parseStats(item.stat || item.stats || "");
        const upgradeLvl = item.upgrade_lvl || stats.enhancement_upgrade_lvl || 0;

        const html = `
            <div class="enhance__item enhance__item--current interface-element-one-item-slot-decor" style="margin:0;">
                <div class="slot">
                    <div class="baddonz-ul-item-cursor" style="position:relative; width:32px; height:32px;">
                        <img src="${imgUrl}" style="width:32px; height:32px; position:absolute; top:0; left:0; z-index:0;">
                    </div>
                </div>
                <div class="lvl" data-lvl="${upgradeLvl}">
                    <div class="cl-icon icon-star-${upgradeLvl}"></div>
                </div>
            </div>
        `;
        const $el = $(html);
        $el.find('.baddonz-ul-item-cursor').on('click', () => {
            setUpgradedItemId("");
            if(window.message) window.message(`Anulowano ulepszanie przedmiotu ${item.name}`);
            updateItemDisplay("");
        });
        $slotWrapper.append($el);
    }

    function updateDailyLimitUI() {
        if(uiMainWindow) uiMainWindow.querySelector('#baddonz-ul-daily-limit').textContent = `Limit: ${dailyUpgradeCount}/${dailyUpgradeLimit}`;
    }

    function generateItemTypeFiltersHtml() {
        const CL_ARR = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 29];
        let html = '<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px; margin: 3px 0;">';
        CL_ARR.forEach(cl => {
            html += `
                <div class="baddonz-typ-wrapper ul-cl-wrapper" data-cl="${cl}">
                    <div class="baddonz-checkbox ul-cl-cb" data-cl="${cl}"></div>
                    <div class="baddonz-type-icon cl-${cl}"></div>
                </div>
            `;
        });
        html += '</div>';
        return html;
    }

    function buildUI() {
        const mainBodyHtml = `
            <div id="baddonz-ul-item-details" class="baddonz-flex column" style="display: ${currentSettings.isExpanded ? 'flex' : 'none'}; border-bottom: 1px solid #303030; padding-bottom: 5px; align-items: center; margin-bottom: 4px;">
                <div id="baddonz-ul-item-slot-wrapper" class="baddonz-flex" style="justify-content: center; height: 32px; margin-bottom: 5px; position:relative;"></div>
                <div class="baddonz-text" id="baddonz-ul-item-name" style="padding: 0; font-size: 11px; font-weight: bold; color: #ffcc00; text-shadow: 1px 1px #000; text-align: center;">Brak przedmiotu</div>
                <div class="baddonz-text" id="baddonz-ul-item-progress" style="padding: 0; font-size: 10px; color: #aaa; text-shadow: 1px 1px #000; text-align: center;">Wybierz z ekwipunku</div>
            </div>
            <div class="baddonz-text" style="padding: 0; margin: 0; text-align: center;">
                <span id="baddonz-ul-daily-limit" style="font-size: ${currentSettings.isExpanded ? '11px' : '9px'}; color: #fff;">Limit: 0/2000</span>
            </div>
        `;
        uiMainWindow = window.BaddonzAPI.createAddonWindow(ADDON_ID, "Ulepszara", mainBodyHtml, { 
            width: '180px', 
            customId: 'baddonz-ul-wnd',
            hasSettings: true,
            hasCollapse: true,
            hasClose: false
        });

        const settingsBodyHtml = `
            <button class="baddonz-button ul-reset-pos-btn" style="width:100%; margin-bottom: 5px;">Resetuj pozycje okienka</button>
            
            <div class="baddonz-setting-row"><div class="baddonz-checkbox ul-use-common-cb"></div><span class="baddonz-text">Ulepszaj Zwyklakami</span></div>
            <div class="baddonz-setting-row"><div class="baddonz-checkbox ul-use-unique-cb"></div><span class="baddonz-text">Ulepszaj Unikatami</span></div>
            <div class="baddonz-setting-row"><div class="baddonz-checkbox ul-allow-bound-cb"></div><span class="baddonz-text" style="color:#ff5555;" title="Na własną odpowiedzialność! (np. eventówki z kolosa)">Ulepszaj Związanymi</span></div>
            
            <hr style="width: 100%; border-color: #303030; margin: 5px 0;">
            <div class="baddonz-text" style="text-align:center; padding: 0;">Typy Itemów:</div>
            ${generateItemTypeFiltersHtml()}
            
            <hr style="width: 100%; border-color: #303030; margin: 5px 0;">
            <div class="baddonz-setting-row"><div class="baddonz-checkbox ul-hotkey-cb"></div><span class="baddonz-text">Ulepszanie Klawiszem</span></div>
            <div class="baddonz-setting-row hotkey-row ul-hotkey-options">
                <span class="baddonz-label baddonz-text" style="padding-left:10px;">Klawisz:</span>
                <input type="text" class="baddonz-input keybind ul-hotkey-input" maxlength="7" style="text-transform: uppercase;">
            </div>
            
            <hr style="width: 100%; border-color: #303030; margin: 5px 0;">
            <div class="baddonz-setting-row"><div class="baddonz-checkbox ul-endbattle-cb"></div><span class="baddonz-text">Ulepszaj po walce</span></div>
            <div class="baddonz-setting-row hotkey-row ul-endbattle-options">
                <span class="baddonz-label baddonz-text" style="padding-left:10px;">Min. Reagentów:</span>
                <input type="number" class="baddonz-input ul-endbattle-input" min="1" max="50">
            </div>

            <hr style="width: 100%; border-color: #303030; margin: 5px 0;">
            <div class="baddonz-setting-row"><div class="baddonz-checkbox ul-bags-cb"></div><span class="baddonz-text">Ulepszanie (Miejsca w torbie)</span></div>
            <div class="baddonz-setting-row hotkey-row ul-bags-options">
                <span class="baddonz-label baddonz-text" style="padding-left:10px;">Max. Wolnych:</span>
                <input type="number" class="baddonz-input ul-bags-input" min="1" max="100">
            </div>
        `;
        uiSettingsWindow = window.BaddonzAPI.createAddonWindow(ADDON_ID, "Ulepszara Ustawienia", settingsBodyHtml, { width: '250px', customId: 'baddonz-ul-wnd-settings' });
        uiSettingsWindow.classList.add('settings-window');
        uiSettingsWindow.removeAttribute('data-addon-id');
        uiSettingsWindow.style.display = currentSettings.settingsWindowVisible ? 'flex' : 'none';

        const isUnified = localStorage.getItem('BaddonzData') && JSON.parse(localStorage.getItem('BaddonzData'))[window.BaddonzAPI.accountId]?.manager?.unifiedOpacityEnabled;
        if (!isUnified) {
            uiSettingsWindow.className = uiSettingsWindow.className.replace(/opacity-\d/, `opacity-${currentSettings.windowSettingsOpacity}`);
        }

        // BINDINGS MAIN
        const axCollapsedBtn = uiMainWindow.querySelector(".baddonz-collapsed");
        if (axCollapsedBtn) {
            if (typeof $ === 'function' && typeof $.fn.tip === 'function') $(axCollapsedBtn).tip(currentSettings.isExpanded ? "Zwiń" : "Rozwiń");
            axCollapsedBtn.addEventListener('click', () => {
                currentSettings.isExpanded = !currentSettings.isExpanded;
                uiMainWindow.querySelector('#baddonz-ul-item-details').style.display = currentSettings.isExpanded ? 'flex' : 'none';
                uiMainWindow.querySelector('#baddonz-ul-daily-limit').style.fontSize = currentSettings.isExpanded ? '11px' : '9px';
                if (typeof $ === 'function' && typeof $.fn.tip === 'function') $(axCollapsedBtn).tip(currentSettings.isExpanded ? "Zwiń" : "Rozwiń");
                saveSettings();
            });
        }

        const axSettingsBtn = uiMainWindow.querySelector(".baddonz-settings-button");
        if (axSettingsBtn) {
            axSettingsBtn.addEventListener('click', () => {
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

        uiSettingsWindow.querySelector('.baddonz-opacity-button').addEventListener('click', () => {
            if (isUnified) return; 
            uiSettingsWindow.classList.remove(`opacity-${currentSettings.windowSettingsOpacity}`);
            currentSettings.windowSettingsOpacity = (currentSettings.windowSettingsOpacity + 1) % 5;
            uiSettingsWindow.classList.add(`opacity-${currentSettings.windowSettingsOpacity}`);
            saveSettings();
        });

        uiSettingsWindow.querySelector(".ul-reset-pos-btn").addEventListener('click', () => {
            if (uiMainWindow) { uiMainWindow.style.left = '0px'; uiMainWindow.style.top = '0px'; }
            let data = JSON.parse(localStorage.getItem('BaddonzData')) || {};
            if(data[window.BaddonzAPI.accountId] && data[window.BaddonzAPI.accountId].manager) {
                data[window.BaddonzAPI.accountId].manager.positions['baddonz-ul-wnd'] = { left: '0px', top: '0px' };
                localStorage.setItem('BaddonzData', JSON.stringify(data));
            }
        });

        // BINDINGS SETTINGS
        function bindSettingToggle(selector, key, callback) {
            const el = uiSettingsWindow.querySelector(selector);
            if(currentSettings[key]) el.classList.add('active');
            el.addEventListener('click', () => {
                currentSettings[key] = el.classList.toggle('active');
                saveSettings();
                if(callback) callback();
            });
        }
        
        const toggleDisplay = (selector, isVisible) => uiSettingsWindow.querySelector(selector).style.display = isVisible ? 'flex' : 'none';

        bindSettingToggle('.ul-use-common-cb', 'use_common');
        bindSettingToggle('.ul-use-unique-cb', 'use_unique');
        bindSettingToggle('.ul-allow-bound-cb', 'allow_bound_items');

        bindSettingToggle('.ul-hotkey-cb', 'hotkeyEnabled', () => toggleDisplay('.ul-hotkey-options', currentSettings.hotkeyEnabled));
        toggleDisplay('.ul-hotkey-options', currentSettings.hotkeyEnabled);

        bindSettingToggle('.ul-endbattle-cb', 'upgrade_endbattle', () => toggleDisplay('.ul-endbattle-options', currentSettings.upgrade_endbattle));
        toggleDisplay('.ul-endbattle-options', currentSettings.upgrade_endbattle);

        bindSettingToggle('.ul-bags-cb', 'bags_upgrade', () => toggleDisplay('.ul-bags-options', currentSettings.bags_upgrade));
        toggleDisplay('.ul-bags-options', currentSettings.bags_upgrade);

        const endBattleInput = uiSettingsWindow.querySelector('.ul-endbattle-input');
        endBattleInput.value = currentSettings.count_endbattle;
        endBattleInput.addEventListener('change', () => {
            const val = Math.max(1, parseInt(endBattleInput.value) || 1);
            currentSettings.count_endbattle = val;
            endBattleInput.value = val;
            saveSettings();
        });

        const bagsInput = uiSettingsWindow.querySelector('.ul-bags-input');
        bagsInput.value = currentSettings.count_bags_upgrade;
        bagsInput.addEventListener('change', () => {
            const val = Math.max(1, parseInt(bagsInput.value) || 1);
            currentSettings.count_bags_upgrade = val;
            bagsInput.value = val;
            saveSettings();
        });

        const hotkeyInput = uiSettingsWindow.querySelector(".ul-hotkey-input");
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
        hotkeyInput.addEventListener('focus', () => {
            hotkeyInput.value = (currentSettings.hotkeyKey === ' ' ? 'SPACJA' : currentSettings.hotkeyKey.toUpperCase());
            hotkeyInput.addEventListener('keydown', handleHotkeySetting);
        });
        hotkeyInput.addEventListener('blur', () => hotkeyInput.removeEventListener('keydown', handleHotkeySetting));
        hotkeyInput.value = (currentSettings.hotkeyKey === ' ' ? 'SPACJA' : currentSettings.hotkeyKey.toUpperCase());

        uiSettingsWindow.querySelectorAll('.ul-cl-wrapper').forEach(wrapper => {
            const cl = wrapper.getAttribute('data-cl');
            const key = `cl${cl}`;
            if (currentSettings[key]) {
                wrapper.querySelector('.ul-cl-cb').classList.add('active');
                wrapper.classList.add('active');
            }
            wrapper.addEventListener('click', () => {
                currentSettings[key] = !currentSettings[key];
                wrapper.querySelector('.ul-cl-cb').classList.toggle('active', currentSettings[key]);
                wrapper.classList.toggle('active', currentSettings[key]);
                saveSettings();
            });
            if (typeof $ !== 'undefined' && typeof $.fn.tip === 'function') $(wrapper).tip(ITEM_CL_NAMES[cl]);
        });
    }

    const intercept = (obj, key, cb) => {
        const _orig = obj[key];
        obj[key] = function (...args) {
            cb(...args);
            return _orig.apply(this, args);
        };
    };

    function addonInit() {
        loadSettings();
        if (!uiMainWindow) buildUI();

        updateDailyLimitUI();
        updateItemDisplay(getUpgradedItemId());

        const originalParseJSON = window.Engine.communication.parseJSON;
        window.Engine.communication.parseJSON = function (data) {
            if (data?.enhancement?.usages_preview?.count !== undefined) {
                dailyUpgradeCount = data.enhancement.usages_preview.count;
                dailyUpgradeLimit = data.enhancement.usages_preview.limit || dailyUpgradeLimit;
                saveDailyUpgradeCount(dailyUpgradeCount);
                updateDailyLimitUI();
            }
            return originalParseJSON.call(this, data);
        };

        if (!isMenuIntercepted) {
            intercept(window.Engine.interface, 'showPopupMenu', (options, event) => {
                if (!currentSettings.enabled) return;
                let target = event.target;
                let $itemEl = $(target).closest('.item');
                if (!$itemEl.length && target.classList.contains('item')) $itemEl = $(target);

                const idMatch = $itemEl.attr('class')?.match(/item-id-(\d+)/);
                const itemId = idMatch ? idMatch[1] : null;
                if (!itemId) return;

                let item = $itemEl.data('item');
                if (!item && window.Engine.items) item = window.Engine.items.getItemById(itemId);
                if (!item || !ITEM_TYPE_SETTINGS_MAP.hasOwnProperty(item.cl)) return;

                const currentSelectedItemId = getUpgradedItemId();
                let menuItem;
                if (itemId === currentSelectedItemId) {
                    menuItem = ["Anuluj ulepszanie", () => {
                        setUpgradedItemId("");
                        if(window.message) window.message(`Anulowano ulepszanie przedmiotu ${item.name}`);
                        updateItemDisplay("");
                    }, { button: { cls: "menu-item--red" } }];
                } else {
                    menuItem = ["Ulepsz ten przedmiot", async () => {
                        setUpgradedItemId(itemId);
                        if(window.message) window.message(`Wybrano przedmiot: ${item.name}`);
                        toggleEnhancementWindow();
                        await setEnhancedItem(itemId);
                        toggleEnhancementWindow();
                    }, { button: { cls: "menu-item--green" } }];
                }
                options.unshift(menuItem);
            });
            isMenuIntercepted = true;
        }

        window.document.addEventListener("keydown", async (event) => {
            if (!currentSettings.enabled || !currentSettings.hotkeyEnabled) return;
            const hotkey = currentSettings.hotkeyKey.toLowerCase();
            const isInputActive = ["TEXTAREA", "MAGIC_INPUT", "INPUT"].includes(document.activeElement.tagName);
            if (event.key.toLowerCase() !== hotkey || isInputActive) return;

            if (isUpgrading) { event.preventDefault(); return; }
            isUpgrading = true;

            try {
                if (typeof window.Engine.battle?.d !== 'undefined' && window.Engine.battle.d.id !== 0) {
                    if(window.message) window.message("Nie można ręcznie ulepszać podczas walki.");
                    return;
                }
                if (!checkDailyLimit()) {
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
        });

        if (!isEndBattleHooked && typeof window.Engine?.battle?.setEndBattle === 'function') {
            const originalSetEndBattle = window.Engine.battle.setEndBattle.bind(window.Engine.battle);
            window.Engine.battle.setEndBattle = function() { 
                originalSetEndBattle(); 
                handleEndBattle(); 
            };
            isEndBattleHooked = true;
        }

        BAG_INTERVAL = setInterval(() => {
            if (currentSettings.enabled && currentSettings.bags_upgrade) handleBagCheck();
        }, 5000);
    }

    function addonStop() {
        if (BAG_INTERVAL) clearInterval(BAG_INTERVAL);
        BAG_INTERVAL = null;
        if (uiMainWindow) { uiMainWindow.remove(); uiMainWindow = null; }
        if (uiSettingsWindow) { uiSettingsWindow.remove(); uiSettingsWindow = null; }
    }

    function onStateToggle(isEnabled) {
        currentSettings.enabled = isEnabled;
    }

    const checkApi = () => {
        if (!window.BaddonzAPI || !window.BaddonzAPI.registerAddon) {
            setTimeout(checkApi, 500); return;
        }
        window.BaddonzAPI.registerAddon(ADDON_ID, { init: addonInit, stop: addonStop, onStateToggle: onStateToggle });
    };

    checkApi();

})();
