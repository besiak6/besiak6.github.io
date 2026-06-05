// ==UserScript==
// @name          Ulepszara baddonz
// @version       2.0.5
// @description   Automatyczne ulepszanie wybranego itemu
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
        .wnd-ulepszara { width: 180px; min-width: 180px; }
        .wnd-ulepszara .baddonz-window-body { padding: 5px; gap: 3px; align-items: center; }
        .wnd-ulepszara-settings { width: 250px; min-width: 250px; }
        
        .baddonz-typ-wrapper {
            display: flex; align-items: center; justify-content: center;
            cursor: url("https://gordion.margonem.pl/img/gui/cursor/5n.png") 4 0, pointer;
            gap: 3px; padding: 3px; background: rgba(0, 0, 0, 0.3);
            border-radius: 3px; user-select: none;
        }
        .baddonz-typ-wrapper:hover { background: rgba(255, 255, 255, 0.1); }
        .baddonz-upgrader-item-cursor { cursor: url("https://gordion.margonem.pl/img/gui/cursor/1n.png") 4 0, pointer !important; }
        #baddonz-upgrader-main-item-slot { margin: 0; }
        .upgrader-crafting-window { display: none !important; }
        .baddonz-upg-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px; width: 100%; box-sizing: border-box; }
    `;
    if (!document.querySelector(".upg-custom-styles")) document.head.appendChild(styleSheet);

    // Ustawienia Globalne Konta
    let currentSettings = {
        enabled: true,
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
        cl11: true, cl12: true, cl13: true, cl14: true, cl29: true,
    };

    // Ustawienia dla danej Postaci
    let charSettings = {
        upgradedItemId: "",
        progressText: "",
        dailyUpgradeCount: 0
    };

    let dailyUpgradeLimit = 2000;
    let isUpgrading = false;
    let uiMainWindow = null;
    let uiSettingsWindow = null;
    let BAG_CHECK_INTERVAL_ID = null;
    let isEngineObserved = false;
    let isEndBattleHooked = false;
    let isMenuIntercepted = false;
    let isKeyDownBound = false;
    let windowEnabled = false;

    const MAX_REAGENTS = 25;
    const BAG_CHECK_INTERVAL = 5000;
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
        5: 'Pomocnicze', 6: 'Różdżki', 7: 'Orby', 8: 'Zbroje', 9: 'Hełmy',
        10: 'Buty', 11: 'Rękawice', 12: 'Pierki', 13: 'Naszyjniki',
        14: 'Tarcze', 29: 'Strzały',
    };

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

        let charData = window.BaddonzAPI.getAddonSettings(ADDON_ID) || {};

        currentSettings = { ...currentSettings, ...accSettings };
        charSettings = { ...charSettings, ...charData };
    }

    function saveSettings() {
        if (!window.BaddonzAPI) return;
        const accId = window.BaddonzAPI.accountId;

        let accSettings = {};
        const accKeys = Object.keys(currentSettings);
        accKeys.forEach(k => accSettings[k] = currentSettings[k]);

        window.BaddonzAPI.saveAddonSettings(ADDON_ID, charSettings);

        try {
            let data = JSON.parse(localStorage.getItem('BaddonzData')) || {};
            if (!data[accId]) data[accId] = {};
            if (!data[accId].accountAddons) data[accId].accountAddons = {};
            data[accId].accountAddons[ADDON_ID] = accSettings;
            localStorage.setItem('BaddonzData', JSON.stringify(data));
        } catch (e) {}
    }

    function isChatFocused() {
        const el = document.activeElement;
        return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
    }

    const updateItemDisplay = (itemId) => {
        if (!uiMainWindow) return;
        const $slotWrapper = $('#baddonz-upgrader-item-slot-wrapper');
        const nameEl = document.getElementById("baddonz-upgrader-item-name");
        const progressEl = document.getElementById("baddonz-upgrader-item-progress");

        if (!$slotWrapper.length || !nameEl || !progressEl) return;

        $slotWrapper.empty();
        nameEl.textContent = "Brak przedmiotu";
        progressEl.textContent = "";

        const $slotContainer = $(
            `<div class="enhance__item enhance__item--current interface-element-one-item-slot-decor" id="baddonz-upgrader-main-item-slot">
                <div class="slot"></div>
                <div class="lvl" data-lvl="0"><div class="cl-icon icon-star-0"></div></div>
            </div>`
        );

        if (!itemId || typeof window.Engine === 'undefined' || !window.Engine.items) {
            $slotWrapper.append($slotContainer);
            return;
        }

        const item = window.Engine.items.getItemById(itemId);
        if (!item) {
            $slotWrapper.append($slotContainer);
            return;
        }

        const upgradeLvl = item.upgrade_lvl || 0;
        $slotContainer.find('.lvl').attr('data-lvl', upgradeLvl).html(`<div class="cl-icon icon-star-${upgradeLvl}"></div>`);
        nameEl.textContent = item.name;

        if (charSettings.progressText) {
            progressEl.textContent = `Progres: ${charSettings.progressText}`;
        }

        const $clonedItem = item.$.clone();
        $clonedItem.addClass('baddonz-upgrader-item-cursor');
        $clonedItem.on('click', () => {
            charSettings.upgradedItemId = "";
            charSettings.progressText = "";
            saveSettings();
            if (window.message) window.message(`Anulowano ulepszanie przedmiotu ${item.name}`);
            updateItemDisplay("");
        });
        $clonedItem.data('item', item);
        $clonedItem.css({ 'position': 'relative', 'width': '32px', 'height': '32px', 'top': '0', 'left': '0' });
        $clonedItem.find('canvas.icon, canvas.canvas-notice').remove();

        const iconSource = item.icon || (`${item.id}.png`);
        const gifName = iconSource.replace(/\.[^/.]+$/, '.gif');
        const imgUrl = MICC_BASE_URL + gifName;
        const $img = $('<img>').attr('src', imgUrl).attr('class', 'baddonz-upgrader-gif').css({ width: '32px', height: '32px', position: 'absolute', top: '0', left: '0', zIndex: '0' });
        
        $clonedItem.append($img);
        $slotContainer.find('.slot').append($clonedItem);
        $slotWrapper.append($slotContainer);
    };

    function updateUI() {
        if (!uiMainWindow || !uiSettingsWindow) return;
        
        const dailyLimitEl = uiMainWindow.querySelector("#baddonz-upgrader-daily-limit");
        if (dailyLimitEl) dailyLimitEl.textContent = `Dzienny Limit: ${charSettings.dailyUpgradeCount}/${dailyUpgradeLimit}`;

        updateItemDisplay(charSettings.upgradedItemId);

        uiSettingsWindow.querySelector("#upg-use-common").classList.toggle('active', currentSettings.use_common);
        uiSettingsWindow.querySelector("#upg-use-unique").classList.toggle('active', currentSettings.use_unique);
        uiSettingsWindow.querySelector("#upg-allow-bound").classList.toggle('active', currentSettings.allow_bound_items);
        
        uiSettingsWindow.querySelector("#upg-hotkey-enabled").classList.toggle('active', currentSettings.hotkeyEnabled);
        const hotkeyInput = uiSettingsWindow.querySelector("#upg-hotkey-input");
        if (document.activeElement !== hotkeyInput) {
            hotkeyInput.value = (currentSettings.hotkeyKey === ' ' ? 'SPACJA' : currentSettings.hotkeyKey.toUpperCase());
        }

        uiSettingsWindow.querySelector("#upg-upgrade-endbattle").classList.toggle('active', currentSettings.upgrade_endbattle);
        uiSettingsWindow.querySelector("#upg-endbattle-count").value = currentSettings.count_endbattle;
        uiSettingsWindow.querySelector("#upg-endbattle-opts").style.display = currentSettings.upgrade_endbattle ? 'flex' : 'none';

        uiSettingsWindow.querySelector("#upg-bags-upgrade").classList.toggle('active', currentSettings.bags_upgrade);
        uiSettingsWindow.querySelector("#upg-bags-count").value = currentSettings.count_bags_upgrade;
        uiSettingsWindow.querySelector("#upg-bags-opts").style.display = currentSettings.bags_upgrade ? 'flex' : 'none';

        const itemTypeFiltersContainer = uiSettingsWindow.querySelector("#baddonz-upgrader-type-filters");
        if (itemTypeFiltersContainer) {
            itemTypeFiltersContainer.querySelectorAll('.baddonz-checkbox').forEach(cb => {
                const cl = cb.id.replace('upg-cl-', '');
                const key = `cl${cl}`;
                cb.classList.toggle('active', currentSettings[key]);
            });
        }
    }

    function generateItemTypeFiltersHtml() {
        const ITEM_CL_MAP = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 29];
        let html = '';
        ITEM_CL_MAP.forEach(cl => {
            html += `
                <div class="baddonz-typ-wrapper" data-cl="${cl}">
                    <div class="baddonz-checkbox" id="upg-cl-${cl}"></div>
                    <div class="baddonz-type-icon cl-${cl}"></div>
                </div>
            `;
        });
        return html;
    }

    function buildUI() {
        const mainBodyHtml = `
            <div id="baddonz-upgrader-item-display-container" class="baddonz-flex column" style="align-items: center; justify-content: center; width: 100%; border-bottom: 1px solid #303030; padding-bottom: 5px; margin-bottom: 2px;">
                <div id="baddonz-upgrader-item-slot-wrapper" class="baddonz-flex"></div>
                <div class="baddonz-text" id="baddonz-upgrader-item-name" style="padding: 2px 0 0 0; font-size: 11px; font-weight: bold; color: #ffcc00; text-shadow: 1px 1px #000;">Brak przedmiotu</div>
                <div class="baddonz-text" id="baddonz-upgrader-item-progress" style="padding: 0; font-size: 10px; color: #aaa; text-shadow: 1px 1px #000;"></div>
            </div>
            <div class="baddonz-text" style="padding: 0; text-align: center; width: 100%;">
                <span id="baddonz-upgrader-daily-limit" style="font-size: 11px;">Dzienny Limit: 0/2000</span>
            </div>
        `;

        uiMainWindow = window.BaddonzAPI.createAddonWindow(ADDON_ID, "Ulepszara", mainBodyHtml, { 
            width: '180px', customId: 'wnd-ulepszara', hasSettings: true, hasCollapse: true 
        });

        const settingsBodyHtml = `
            <div class="baddonz-setting-row"><div class="baddonz-checkbox" id="upg-use-common"></div><span class="baddonz-text">Ulepszaj Zwyklakami</span></div>
            <div class="baddonz-setting-row"><div class="baddonz-checkbox" id="upg-use-unique"></div><span class="baddonz-text">Ulepszaj Unikatami</span></div>
            <div class="baddonz-setting-row" style="margin-bottom: 5px;"><div class="baddonz-checkbox" id="upg-allow-bound"></div><span class="baddonz-text">Ulepszaj Związanymi</span></div>
            
            <hr style="width: 100%; border-color: #303030; margin: 3px 0;">
            <div class="baddonz-text" style="text-align: center; width:100%; margin-bottom: 3px;">Typy Itemów:</div>
            <div id="baddonz-upgrader-type-filters" class="baddonz-upg-grid">${generateItemTypeFiltersHtml()}</div>
            <hr style="width: 100%; border-color: #303030; margin: 5px 0 3px 0;">

            <div class="baddonz-setting-row" style="display: flex; align-items: center;">
                <div class="baddonz-checkbox" id="upg-hotkey-enabled"></div><span class="baddonz-text" style="margin-left: 5px;">Klawisz ulepszania:</span>
                <input type="text" class="baddonz-input keybind" id="upg-hotkey-input" readonly style="width: 50px; height: 20px; line-height: 18px; font-size: 11px; padding: 1px 0; margin-left: auto;">
            </div>

            <div class="baddonz-setting-row"><div class="baddonz-checkbox" id="upg-upgrade-endbattle"></div><span class="baddonz-text">Ulepszaj po walce</span></div>
            <div id="upg-endbattle-opts" class="baddonz-setting-row" style="padding-left: 20px;">
                <span class="baddonz-text" style="font-size: 10px;">Min. Reagentów:</span>
                <input type="number" class="baddonz-input" id="upg-endbattle-count" min="1" max="50" style="width: 40px; height: 20px; font-size: 11px; margin-left: auto;">
            </div>

            <div class="baddonz-setting-row"><div class="baddonz-checkbox" id="upg-bags-upgrade"></div><span class="baddonz-text">Ulepszanie po torbie</span></div>
            <div id="upg-bags-opts" class="baddonz-setting-row" style="padding-left: 20px;">
                <span class="baddonz-text" style="font-size: 10px;">Max. wolnych slotów:</span>
                <input type="number" class="baddonz-input" id="upg-bags-count" min="1" max="100" style="width: 40px; height: 20px; font-size: 11px; margin-left: auto;">
            </div>
        `;

        uiSettingsWindow = window.BaddonzAPI.createAddonWindow(ADDON_ID, "Ustawienia Ulepszarki", settingsBodyHtml, { 
            width: '250px', customId: 'wnd-ulepszara-settings' 
        });
        uiSettingsWindow.classList.add('settings-window');
        uiSettingsWindow.style.display = 'none';

        // Bindowanie logiki z checkboxami
        const bindToggle = (id, key, callback = null) => {
            const cb = uiSettingsWindow.querySelector(`#${id}`);
            cb.addEventListener('click', () => {
                currentSettings[key] = cb.classList.toggle('active');
                saveSettings(); updateUI(); if (callback) callback();
            });
        };

        bindToggle('upg-use-common', 'use_common');
        bindToggle('upg-use-unique', 'use_unique');
        bindToggle('upg-allow-bound', 'allow_bound_items');
        bindToggle('upg-hotkey-enabled', 'hotkeyEnabled');
        bindToggle('upg-upgrade-endbattle', 'upgrade_endbattle');
        bindToggle('upg-bags-upgrade', 'bags_upgrade');

        // Bindowanie siatki typów (cl)
        uiSettingsWindow.querySelectorAll('.baddonz-typ-wrapper').forEach(wrapper => {
            const cl = parseInt(wrapper.getAttribute('data-cl'));
            const key = `cl${cl}`;
            if (typeof $ === 'function' && typeof $.fn.tip === 'function' && ITEM_CL_NAMES[cl]) $(wrapper).tip(ITEM_CL_NAMES[cl]);
            
            wrapper.addEventListener('click', () => {
                currentSettings[key] = !currentSettings[key];
                saveSettings(); updateUI();
            });
        });

        // Bindowanie inputów numerycznych
        const bindNumber = (id, key) => {
            const el = uiSettingsWindow.querySelector(`#${id}`);
            el.addEventListener('change', () => {
                let val = parseInt(el.value);
                if (isNaN(val) || val < 1) val = 1;
                el.value = val;
                currentSettings[key] = val;
                saveSettings();
            });
        };
        bindNumber('upg-endbattle-count', 'count_endbattle');
        bindNumber('upg-bags-count', 'count_bags_upgrade');

        // Bindowanie klawisza (hotkey)
        const hotkeyInput = uiSettingsWindow.querySelector("#upg-hotkey-input");
        hotkeyInput.addEventListener('click', () => {
            hotkeyInput.focus();
            hotkeyInput.classList.add('active-keybind-mode');
        });
        
        hotkeyInput.addEventListener('keydown', (e) => {
            if (hotkeyInput.classList.contains('active-keybind-mode')) {
                e.preventDefault();
                const pressedKey = e.key.toLowerCase();
                if (['escape', 'enter', 'tab'].includes(pressedKey)) {
                    hotkeyInput.blur(); return;
                }
                if (window.BaddonzAPI && !window.BaddonzAPI.isValidHotkey(pressedKey)) return;
                if (pressedKey.length !== 1) return;

                currentSettings.hotkeyKey = pressedKey;
                hotkeyInput.value = pressedKey.toUpperCase();
                saveSettings();
                hotkeyInput.blur();
                hotkeyInput.classList.remove('active-keybind-mode');
            }
        });
        hotkeyInput.addEventListener('focusout', () => hotkeyInput.classList.remove('active-keybind-mode'));

        // Ostrzeżenia w dymkach
        if (typeof $ === 'function' && typeof $.fn.tip === 'function') {
            $(uiSettingsWindow.querySelector("#upg-allow-bound")).tip('Używasz na własną odpowiedzialność! Uwaga na itemy z kolosów');
        }

        // Bindowanie przycisku ustawień na głównym oknie Baddonz (aby otwierał panel settings)
        const mainSettingsBtn = uiMainWindow.querySelector('.baddonz-settings-button');
        if (mainSettingsBtn) {
            mainSettingsBtn.addEventListener('click', () => {
                const isVisible = uiSettingsWindow.style.display !== 'none';
                uiSettingsWindow.style.display = isVisible ? 'none' : 'flex';
            });
        }
    }

    const checkDailyLimit = () => { return charSettings.dailyUpgradeCount < dailyUpgradeLimit; }

    function getEnhancementProgressText() {
        try {
            const currentProgressTextEl = document.querySelector('.enhance__progress-text--current');
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

    const getReagents = () => {
        if (!window.Engine || !window.Engine.items) return [];
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

            if (isAllowedType && isAllowedRarity && !isEventItem(item) && !isUpgraded && (currentSettings.allow_bound_items || !isBound) && !isPartOfBuild) {
                acc.push(item.id);
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
                    current = progress.current; max = progress.max;
                    if (current > 0 && current === max) isCompleted = true;
                }

                setTimeout(() => {
                    const progressText = getEnhancementProgressText();
                    if (progressText !== "Brak danych") charSettings.progressText = progressText;
                    else if (isCompleted) charSettings.progressText = `${max}/${max}`;
                    
                    saveSettings(); updateUI();
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
    const toggleEnhancementWindow = () => {
        if (windowEnabled) {
            window.Engine.crafting.window.wnd.$.removeClass("upgrader-crafting-window");
            window.Engine.interface.clickCrafting();
            windowEnabled = false; return;
        }
        window.Engine.crafting.window.wnd.$.addClass("upgrader-crafting-window");
        window.Engine.interface.clickCrafting();
        windowEnabled = true;
    };

    const processChunks = async (upgradedItemId, chunks) => {
        for (const chunk of chunks) {
            if (!checkDailyLimit()) {
                if (window.message) window.message(`Przerwano ulepszanie. Limit ${dailyUpgradeLimit} osiągnięty.`);
                return true;
            }
            await setReagents(upgradedItemId, chunk);
            await enhanceItem(upgradedItemId, chunk);
            await sleep(200);

            const progressInfo = await setEnhancedItem(upgradedItemId);
            await sleep(100);

            if (progressInfo.isCompleted) {
                if (window.message) window.message(`Ulepszono! Progres: ${charSettings.progressText}. (MAX)`);
                return true;
            }
            if (window.message) window.message(`Ulepszono! Progres: ${charSettings.progressText}`);
            await sleep(300);
        }
        return false;
    }

    const handleBagCheck = async () => {
        if (!currentSettings.enabled || !currentSettings.bags_upgrade || !checkDailyLimit() || isUpgrading) return;
        const upgradedItemId = charSettings.upgradedItemId;
        if (!upgradedItemId) return;
        
        const upgradedItem = window.Engine.items.getItemById(upgradedItemId);
        if (!upgradedItem) return;

        const reagents = getReagents();
        const freeSlots = getFreeSlots();

        if (reagents.length >= 1 && freeSlots <= currentSettings.count_bags_upgrade) {
            isUpgrading = true;
            if (window.message) window.message(`Wolne sloty: ${freeSlots}. Ulepszam! ${upgradedItem.name}.`);

            try {
                toggleEnhancementWindow();
                const progressInfo = await setEnhancedItem(upgradedItemId);
                if (progressInfo.isCompleted) {
                    if (window.message) window.message(`Maksymalny progres osiągnięty.`);
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
        const upgradedItemId = charSettings.upgradedItemId;
        if (!upgradedItemId) return;

        const upgradedItem = window.Engine.items.getItemById(upgradedItemId);
        if (!upgradedItem) return;

        const reagents = getReagents();
        if (reagents.length < currentSettings.count_endbattle) return;

        isUpgrading = true;
        if (window.message) window.message(`Ulepszam! ${upgradedItem.name}.`);

        try {
            toggleEnhancementWindow();
            const progressInfo = await setEnhancedItem(upgradedItemId);
            if (progressInfo.isCompleted) {
                if (window.message) window.message(`Maksymalny progres osiągnięty.`);
                return;
            }
            const chunks = chunkReagents(reagents);
            await processChunks(upgradedItemId, chunks);
        } finally {
            toggleEnhancementWindow();
            isUpgrading = false;
        }
    };

    const handleGlobalKeydown = async (event) => {
        if (!currentSettings.enabled || !currentSettings.hotkeyEnabled) return;
        if (isChatFocused()) return;

        if (event.key.toLowerCase() === currentSettings.hotkeyKey.toLowerCase()) {
            if (isUpgrading) { event.preventDefault(); return; }
            
            isUpgrading = true;
            try {
                if (typeof window.Engine.battle?.d !== 'undefined' && window.Engine.battle.d.id !== 0) {
                    if (window.message) window.message("Nie można ręcznie ulepszać podczas walki.");
                    return;
                }
                if (!checkDailyLimit()) {
                    if (window.message) window.message(`Osiągnięto dzienny limit ${dailyUpgradeLimit} ulepszeń.`);
                    return;
                }

                const upgradedItemId = charSettings.upgradedItemId;
                if (!upgradedItemId) { if (window.message) window.message("Nie znaleziono wybranego przedmiotu."); return; }

                const upgradedItem = window.Engine.items.getItemById(upgradedItemId);
                if (!upgradedItem) { if (window.message) window.message("Zły przedmiot ulepszania."); return; }

                const reagents = getReagents();
                if (reagents.length === 0) { if (window.message) window.message("Nie znaleziono odpowiednich składników."); return; }

                event.preventDefault();
                toggleEnhancementWindow();
                const chunks = chunkReagents(reagents);

                const progressInfo = await setEnhancedItem(upgradedItemId);
                if (progressInfo.isCompleted) {
                    if (window.message) window.message(`Ulepszanie zakończone. ${upgradedItem.name} osiągnął MAX progres.`);
                    toggleEnhancementWindow(); return;
                }

                await processChunks(upgradedItemId, chunks);
                toggleEnhancementWindow();
            } finally {
                isUpgrading = false;
            }
        }
    };

    function addonInit() {
        loadSettings();
        if (!uiMainWindow) buildUI();
        updateUI();

        // Podpięcie pod paczki z serwera (limit dzienny ulepszeń)
        if (!isEngineObserved && window.Engine && window.Engine.communication) {
            const originalParseJSON = window.Engine.communication.parseJSON;
            window.Engine.communication.parseJSON = function (data) {
                if (data?.enhancement?.usages_preview?.count !== undefined) {
                    charSettings.dailyUpgradeCount = data.enhancement.usages_preview.count;
                    dailyUpgradeLimit = data.enhancement.usages_preview.limit || dailyUpgradeLimit;
                    saveSettings(); updateUI();
                }
                return originalParseJSON.apply(this, arguments);
            };
            isEngineObserved = true;
        }

        // Podpięcie pod walkę
        if (!isEndBattleHooked && typeof window.Engine?.battle?.setEndBattle === 'function') {
            const originalSetEndBattle = window.Engine.battle.setEndBattle.bind(window.Engine.battle);
            window.Engine.battle.setEndBattle = function() {
                originalSetEndBattle(); handleEndBattle();
            };
            isEndBattleHooked = true;
        }

        // Pętla sprawdzania torby
        BAG_CHECK_INTERVAL_ID = setInterval(() => {
            if (currentSettings.enabled && currentSettings.bags_upgrade) handleBagCheck();
        }, BAG_CHECK_INTERVAL);

        // Skrót klawiszowy
        if (!isKeyDownBound) {
            document.addEventListener('keydown', handleGlobalKeydown);
            isKeyDownBound = true;
        }

        // Menu prawego przycisku myszy (dodanie własnych opcji)
        if (!isMenuIntercepted && window.Engine && window.Engine.interface) {
            const ogShowPopupMenu = window.Engine.interface.showPopupMenu;
            window.Engine.interface.showPopupMenu = function (menu, e) {
                const match = e.currentTarget?.className?.match(/item-id-(\d+)/);
                const itemId = match ? match[1] : null;
                const item = itemId ? window.Engine.items.getItemById(itemId) : null;
                const currentSelectedItemId = charSettings.upgradedItemId;

                if (!itemId || !item || !ITEM_TYPE_SETTINGS_MAP.hasOwnProperty(item.cl)) {
                    return ogShowPopupMenu.call(this, menu, e);
                }

                let menuItem;
                if (itemId === currentSelectedItemId) {
                    menuItem = ["Anuluj ulepszanie", () => {
                        if (!currentSelectedItemId) return;
                        charSettings.upgradedItemId = "";
                        charSettings.progressText = "";
                        saveSettings(); updateUI();
                        if (window.message) window.message(`Anulowano ulepszanie przedmiotu ${item.name}`);
                    }, { button: { cls: "menu-item--red" } }];
                } else {
                    menuItem = ["Ulepsz ten przedmiot", async () => {
                        charSettings.upgradedItemId = itemId;
                        saveSettings(); updateUI();
                        if (window.message) window.message(`Wybrano: ${item.name}`);

                        toggleEnhancementWindow();
                        await setEnhancedItem(itemId);
                        toggleEnhancementWindow();
                    }, { button: { cls: "menu-item--green" } }];
                }

                const updatedMenu = [menuItem, ...menu];
                return ogShowPopupMenu.call(this, updatedMenu, e);
            };
            isMenuIntercepted = true;
        }
    }

    function addonStop() {
        if (isKeyDownBound) { document.removeEventListener('keydown', handleGlobalKeydown); isKeyDownBound = false; }
        if (BAG_CHECK_INTERVAL_ID) { clearInterval(BAG_CHECK_INTERVAL_ID); BAG_CHECK_INTERVAL_ID = null; }
        
        if (uiMainWindow) { uiMainWindow.remove(); uiMainWindow = null; }
        if (uiSettingsWindow) { uiSettingsWindow.remove(); uiSettingsWindow = null; }
    }

    function onStateToggle(isEnabled) {
        currentSettings.enabled = isEnabled;
        saveSettings(); updateUI();
    }

    const checkApi = () => {
        if (!window.BaddonzAPI || !window.BaddonzAPI.registerAddon) {
            setTimeout(checkApi, 500); return;
        }
        window.BaddonzAPI.registerAddon(ADDON_ID, { init: addonInit, stop: addonStop, onStateToggle: onStateToggle });
    };

    checkApi();
})();
