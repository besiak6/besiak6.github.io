// ==UserScript==
// @name          Ulepszator baddonz
// @version       0.3 (API 2.0.5)
// @author        besiak
// @match         https://*.margonem.pl/
// @grant         none
// ==/UserScript==

(function () {
    'use strict';

    const ADDON_ID = "UPG";
    const MICC_BASE_URL = 'https://micc.garmory-cdn.cloud/obrazki/itemy/';
    const DAILY_COUNT_KEY = "baddonz-daily-upgrade-count";
    const PROGRESS_STORAGE_KEY = "baddonz-enhancement-progress-char";
    
    const BAG_CHECK_INTERVAL = 5000;
    const MAX_REAGENTS = 25;

    const EVENT_KEYWORDS = [
        "Wakacje", "Urodziny Margonem", "Wielkanoc", "Noc Kupały",
        "Szabat Czarownic", "Halloween", "Gwiazdka", "Licytacja", "Licytacja eventowa"
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
        [CL.GLOVES]: 'cl11', [CL.RING]: 'cl12', [CL.NECKLACE]: 'cl13', [CL.SHIELD]: 'cl14', [CL.QUIVER]: 'cl29',
    };

    const ITEM_CL_NAMES = {
        1: 'Jednoręczne', 2: 'Dwuręczne', 3: 'Półtoraręczne', 4: 'Łuki',
        5: 'Pomocnicze', 6: 'Różdżki', 7: 'Orby', 8: 'Zbroje', 9: 'Heły',
        10: 'Buty', 11: 'Rękawice', 12: 'Pierki', 13: 'Naszyjniki', 14: 'Tarcze', 29: 'Strzały',
    };

    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.className = "upgrader-custom-styles";
    styleSheet.innerText = `
        .upgrader-crafting-window { display: none !important; }
        .baddonz-upg-wnd { width: 160px; min-width: 160px; }
        .baddonz-upg-wnd-settings { width: 220px; min-width: 220px; height: auto !important; min-height: unset !important; }
        .baddonz-upg-wnd-settings .baddonz-window-body { height: auto !important; min-height: unset !important; display: flex; flex-direction: column; gap: 5px; }
        .baddonz-typ-wrapper { display: flex; align-items: center; justify-content: center; cursor: url("https://gordion.margonem.pl/img/gui/cursor/5n.png") 4 0, pointer; gap: 3px; padding: 3px; background: rgba(0, 0, 0, 0.3); border-radius: 3px; user-select: none; }
        .baddonz-typ-wrapper:hover { background: rgba(255, 255, 255, 0.1); }
        .baddonz-typ-wrapper.active { background: rgba(57, 100, 17, 0.5); }
        .baddonz-upgrader-item-cursor { cursor: url("https://gordion.margonem.pl/img/gui/cursor/1n.png") 4 0, pointer !important; }
        .baddonz-setting-row span { white-space:nowrap; font-size:11px; }
    `;
    if (!document.querySelector(".upgrader-custom-styles")) document.head.appendChild(styleSheet);

    let currentSettings = {
        enabled: true,
        windowOpacity: 2,
        windowVisible: true,
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
        cl11: true, cl12: true, cl13: true, cl14: true, cl29: true,
    };

    let uiMainWindow = null;
    let uiSettingsWindow = null;
    let BADDONZ_BAG_INTERVAL = null;
    let isEndBattleHooked = false;
    let isMenuIntercepted = false;
    let isCommunicationHooked = false;
    let isKeyDownHooked = false;
    let windowEnabled = false;
    
    let dailyUpgradeCount = 0;
    let dailyUpgradeLimit = 2000;
    let isUpgrading = false;

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

    function loadProgress(itemId) {
        const charId = window.Engine?.hero?.d?.id;
        if (!charId) return null;
        try { return (JSON.parse(localStorage.getItem(`${PROGRESS_STORAGE_KEY}-${charId}`)) || {})[itemId] || null; } 
        catch (e) { return null; }
    }

    function saveProgress(itemId, progressText) {
        const charId = window.Engine?.hero?.d?.id;
        if (!itemId || !progressText || progressText === "Brak danych" || !charId) return;

        const storageKey = `${PROGRESS_STORAGE_KEY}-${charId}`;
        let allProgress = {};
        try { allProgress = JSON.parse(localStorage.getItem(storageKey)) || {}; } catch (e) {}
        
        allProgress[itemId] = progressText;
        if (getUpgradedItemId() !== itemId) delete allProgress[itemId];
        
        localStorage.setItem(storageKey, JSON.stringify(allProgress));
    }

    function setUpgradedItemId(itemId) {
        if (!window.Engine?.hero?.d) return;
        window.localStorage.setItem(`upgrader-charId-${Engine.hero.d.id}`, itemId);
    }

    function getUpgradedItemId() {
        try { return window.localStorage.getItem(`upgrader-charId-${Engine.hero.d.id}`); } 
        catch (e) { return null; }
    }

    function updateItemDisplay() {
        if (!uiMainWindow) return;
        const itemId = getUpgradedItemId();
        const $slotWrapper = $('#baddonz-upgrader-item-slot-wrapper');
        const nameEl = document.getElementById("baddonz-upgrader-item-name");
        const progressEl = document.getElementById("baddonz-upgrader-item-progress");
        const dailyLimitEl = document.getElementById("baddonz-upgrader-daily-limit");

        if (dailyLimitEl) dailyLimitEl.textContent = `${dailyUpgradeCount}/${dailyUpgradeLimit}`;

        if (!$slotWrapper.length || !nameEl || !progressEl) return;

        $slotWrapper.empty();
        nameEl.textContent = "";
        progressEl.textContent = "";

        const $slotContainer = $(`
            <div class="enhance__item enhance__item--current interface-element-one-item-slot-decor" style="margin:0;">
                <div class="slot"></div>
                <div class="lvl" data-lvl="0"><div class="cl-icon icon-star-0"></div></div>
            </div>
        `);

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

        const storedProgress = loadProgress(itemId);
        if (storedProgress) progressEl.textContent = `Progres: ${storedProgress}`;

        const $clonedItem = item.$.clone();
        $clonedItem.addClass('baddonz-upgrader-item-cursor');
        $clonedItem.on('click', () => {
            setUpgradedItemId("");
            if(window.message) message(`Anulowano ulepszanie przedmiotu ${item.name}`);
            updateItemDisplay();
        });

        $clonedItem.css({ 'position': 'relative', 'width': '32px', 'height': '32px', 'top': '0', 'left': '0' });
        $clonedItem.find('canvas.icon, canvas.canvas-notice').remove();

        const iconSource = item.icon || (`${item.id}.png`);
        const gifName = iconSource.replace(/\.[^/.]+$/, '.gif');
        const imgUrl = MICC_BASE_URL + gifName;
        
        const $img = $('<img>').attr('src', imgUrl).css({ width: '32px', height: '32px', position: 'absolute', top: '0', left: '0', zIndex: '0' });
        $clonedItem.append($img);

        $slotContainer.find('.slot').append($clonedItem);
        $slotWrapper.append($slotContainer);
    }

    function buildUI() {
        const mainBodyHtml = `
            <div id="baddonz-upgrader-item-details" class="baddonz-flex column" style="border-bottom: 1px solid #303030; padding-bottom: 5px; align-items: center; display: ${currentSettings.isExpanded ? 'flex' : 'none'};">
                <div id="baddonz-upgrader-item-slot-wrapper" class="baddonz-flex" style="margin-top: 5px;"></div>
                <div class="baddonz-text" id="baddonz-upgrader-item-name" style="padding:0; font-size:11px; font-weight:bold; color:#ffcc00; text-shadow:1px 1px #000; text-align:center;"></div>
                <div class="baddonz-text" id="baddonz-upgrader-item-progress" style="padding:0; font-size:10px; color:#aaa; text-shadow:1px 1px #000; text-align:center;"></div>
            </div>
            <div class="baddonz-text baddonz-upgrader-daily-limit-wrapper" style="text-align:center; padding-top:2px;">
                <div id="baddonz-upgrader-daily-limit" style="font-size:11px; color:#fff;">0/2000</div>
            </div>
        `;
        uiMainWindow = window.BaddonzAPI.createAddonWindow(ADDON_ID, "Ulepszara", mainBodyHtml, { 
            width: '160px', 
            customId: 'baddonz-upg-wnd',
            hasSettings: true,
            hasCollapse: true,
            hasClose: false
        });
        uiMainWindow.classList.add('baddonz-upg-wnd');

        const ITEM_CL_MAP = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 29];
        let typeFiltersHtml = '';
        ITEM_CL_MAP.forEach(cl => {
            const key = `cl${cl}`;
            typeFiltersHtml += `
                <div class="baddonz-typ-wrapper ${currentSettings[key] ? 'active' : ''}" data-key="${key}" data-cl="${cl}">
                    <div class="baddonz-checkbox ${currentSettings[key] ? 'active' : ''}" style="pointer-events:none;"></div>
                    <div class="baddonz-type-icon cl-${cl}"></div>
                </div>
            `;
        });

        const settingsBodyHtml = `
            <div class="baddonz-setting-row"><div class="baddonz-checkbox upg-use-common ${currentSettings.use_common ? 'active' : ''}"></div><span>Ulepszaj Zwyklakami</span></div>
            <div class="baddonz-setting-row"><div class="baddonz-checkbox upg-use-unique ${currentSettings.use_unique ? 'active' : ''}"></div><span>Ulepszaj Unikatami</span></div>
            <div class="baddonz-setting-row"><div class="baddonz-checkbox upg-allow-bound ${currentSettings.allow_bound_items ? 'active' : ''}"></div><span id="upg-allow-bound-txt">Ulepszaj Związanymi</span></div>
            
            <hr style="width: 100%; border-color: #303030; margin: 3px 0;">
            <div style="text-align:center; font-size:11px; margin-bottom:2px; color: #b0b0b0;">Typy Przedmiotów:</div>
            <div id="baddonz-upgrader-type-filters" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px;">
                ${typeFiltersHtml}
            </div>

            <hr style="width: 100%; border-color: #303030; margin: 3px 0;">
            <div class="baddonz-setting-row"><div class="baddonz-checkbox upg-hotkey-enabled ${currentSettings.hotkeyEnabled ? 'active' : ''}"></div><span>Ulepszanie Klawiszem</span></div>
            <div class="upg-hotkey-options" style="display: ${currentSettings.hotkeyEnabled ? 'flex' : 'none'}; flex-direction:column; align-items:center; margin-bottom:5px;">
                <input type="text" class="baddonz-input upg-hotkey-input" maxlength="7" style="width:80px; height:20px !important; text-align:center; text-transform:uppercase; font-weight:bold;" value="${currentSettings.hotkeyKey === ' ' ? 'SPACJA' : currentSettings.hotkeyKey.toUpperCase()}">
            </div>

            <div class="baddonz-setting-row"><div class="baddonz-checkbox upg-upgrade-endbattle ${currentSettings.upgrade_endbattle ? 'active' : ''}"></div><span id="upg-endbattle-txt">Ulepszaj po walce</span></div>
            <div class="upg-endbattle-options baddonz-setting-row" style="display: ${currentSettings.upgrade_endbattle ? 'flex' : 'none'}; justify-content:space-between;">
                <span style="font-size:10px;">Min. Reagentów:</span>
                <input type="number" class="baddonz-input upg-count-endbattle" min="1" max="50" style="width:40px; height:20px !important; text-align:center;" value="${currentSettings.count_endbattle}">
            </div>

            <div class="baddonz-setting-row"><div class="baddonz-checkbox upg-bags-upgrade ${currentSettings.bags_upgrade ? 'active' : ''}"></div><span>Po miejscach w torbie</span></div>
            <div class="upg-bags-options baddonz-setting-row" style="display: ${currentSettings.bags_upgrade ? 'flex' : 'none'}; justify-content:space-between;">
                <span style="font-size:10px;">Max. Wolne Sloty:</span>
                <input type="number" class="baddonz-input upg-count-bags" min="1" max="100" style="width:40px; height:20px !important; text-align:center;" value="${currentSettings.count_bags_upgrade}">
            </div>
        `;

        uiSettingsWindow = window.BaddonzAPI.createAddonWindow(ADDON_ID + "_SET", "Ulepszara - Ustaw.", settingsBodyHtml, { 
            width: '220px', 
            customId: 'baddonz-upg-wnd-settings',
            hasSettings: false,
            hasCollapse: false,
            hasClose: true
        });
        uiSettingsWindow.classList.add('baddonz-upg-wnd-settings');
        uiSettingsWindow.style.display = currentSettings.settingsWindowVisible ? 'flex' : 'none';

        const isUnified = localStorage.getItem('BaddonzData') && JSON.parse(localStorage.getItem('BaddonzData'))[window.BaddonzAPI.accountId]?.manager?.unifiedOpacityEnabled;
        if (!isUnified) uiSettingsWindow.className = uiSettingsWindow.className.replace(/opacity-\d/, `opacity-${currentSettings.windowSettingsOpacity}`);

        bindUIEvents();
    }

    function bindUIEvents() {
        const collapseBtn = uiMainWindow.querySelector('.baddonz-collapsed');
        const settingsBtn = uiMainWindow.querySelector('.baddonz-settings-button');
        const itemDetails = uiMainWindow.querySelector('#baddonz-upgrader-item-details');

        if (collapseBtn) {
            collapseBtn.addEventListener('click', () => {
                currentSettings.isExpanded = !currentSettings.isExpanded;
                itemDetails.style.display = currentSettings.isExpanded ? 'flex' : 'none';
                saveSettings();
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
            saveSettings();
        });

        uiSettingsWindow.querySelector('.baddonz-opacity-button').addEventListener('click', () => {
            const isUnified = localStorage.getItem('BaddonzData') && JSON.parse(localStorage.getItem('BaddonzData'))[window.BaddonzAPI.accountId]?.manager?.unifiedOpacityEnabled;
            if (isUnified) return; 
            uiSettingsWindow.classList.remove(`opacity-${currentSettings.windowSettingsOpacity}`);
            currentSettings.windowSettingsOpacity = (currentSettings.windowSettingsOpacity + 1) % 5;
            uiSettingsWindow.classList.add(`opacity-${currentSettings.windowSettingsOpacity}`);
            saveSettings();
        });

        const bindToggle = (className, key, toggleEl = null) => {
            const cb = uiSettingsWindow.querySelector(`.${className}`);
            cb.addEventListener('click', () => {
                currentSettings[key] = cb.classList.toggle('active');
                if (toggleEl) toggleEl.style.display = currentSettings[key] ? 'flex' : 'none';
                saveSettings();
            });
        };

        bindToggle('upg-use-common', 'use_common');
        bindToggle('upg-use-unique', 'use_unique');
        bindToggle('upg-allow-bound', 'allow_bound_items');
        bindToggle('upg-hotkey-enabled', 'hotkeyEnabled', uiSettingsWindow.querySelector('.upg-hotkey-options'));
        bindToggle('upg-upgrade-endbattle', 'upgrade_endbattle', uiSettingsWindow.querySelector('.upg-endbattle-options'));
        bindToggle('upg-bags-upgrade', 'bags_upgrade', uiSettingsWindow.querySelector('.upg-bags-options'));

        uiSettingsWindow.querySelectorAll('.baddonz-typ-wrapper').forEach(wrapper => {
            wrapper.addEventListener('click', () => {
                const key = wrapper.getAttribute('data-key');
                currentSettings[key] = !currentSettings[key];
                wrapper.classList.toggle('active', currentSettings[key]);
                wrapper.querySelector('.baddonz-checkbox').classList.toggle('active', currentSettings[key]);
                saveSettings();
            });
            const cl = wrapper.getAttribute('data-cl');
            if (typeof $ !== 'undefined' && $.fn.tip && ITEM_CL_NAMES[cl]) $(wrapper).tip(ITEM_CL_NAMES[cl]);
        });

        const numBind = (className, key) => {
            const input = uiSettingsWindow.querySelector(`.${className}`);
            input.addEventListener('change', () => {
                let val = parseInt(input.value) || 1;
                val = Math.max(1, Math.min(val, parseInt(input.getAttribute('max'))));
                currentSettings[key] = val;
                input.value = val;
                saveSettings();
            });
        };
        numBind('upg-count-endbattle', 'count_endbattle');
        numBind('upg-count-bags', 'count_bags_upgrade');

        const hotkeyInput = uiSettingsWindow.querySelector('.upg-hotkey-input');
        const handleHotkeySetting = (e) => {
            if (['Tab', 'Enter', 'Escape', 'Shift', 'Control', 'Alt', 'Meta'].includes(e.key) || (e.key.length > 1 && e.key !== ' ')) return;
            e.preventDefault(); e.stopPropagation();
            let newKey = e.key.toLowerCase().slice(0, 1);
            if (newKey) currentSettings.hotkeyKey = newKey;
            else if (e.key === ' ') currentSettings.hotkeyKey = ' ';
            hotkeyInput.removeEventListener('keydown', handleHotkeySetting);
            hotkeyInput.blur();
            saveSettings();
        };
        hotkeyInput.addEventListener('focus', () => {
            hotkeyInput.value = (currentSettings.hotkeyKey === ' ' ? 'SPACJA' : currentSettings.hotkeyKey.toUpperCase());
            hotkeyInput.addEventListener('keydown', handleHotkeySetting);
        });
        hotkeyInput.addEventListener('blur', () => {
            hotkeyInput.removeEventListener('keydown', handleHotkeySetting);
            hotkeyInput.value = (currentSettings.hotkeyKey === ' ' ? 'SPACJA' : currentSettings.hotkeyKey.toUpperCase());
        });

        if (typeof $ !== 'undefined' && $.fn.tip) {
            $(uiSettingsWindow.querySelector('#upg-allow-bound-txt')).tip('Używasz na własną odpowiedzialność! Uwaga na itemy z kolosów');
            $(uiSettingsWindow.querySelector('#upg-endbattle-txt')).tip('Automatyczne ulepszanie po walce');
            $(uiSettingsWindow.querySelector('.upg-count-bags')).tip('Ilość miejsc potrzebna do uruchomienia ulepszania');
        }
    }

    // --- LOGIKA ULEPSZANIA ---

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

    const checkDailyLimit = () => dailyUpgradeCount < dailyUpgradeLimit;

    function getEnhancementProgressText() {
        try {
            const currentProgressTextEl = window.Engine.crafting.window.wnd.$[0].querySelector('.enhance__progress-text--current');
            if (currentProgressTextEl) return currentProgressTextEl.textContent.trim();
        } catch (e) {}
        return "Brak danych";
    }

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
                    updateItemDisplay();
                    resolve({ current, max, isCompleted });
                }, 300);
            });
        });
    };

    const setReagents = (itemId, reagentIds) => {
        const reagents = reagentIds.join(",");
        return new Promise((resolve) => window._g(`enhancement&action=progress_preview&item=${itemId}&ingredients=${reagents}`, resolve));
    };

    const enhanceItem = (itemId, reagentIds) => {
        if (!itemId || !reagentIds) return;
        const reagents = reagentIds.join(",");
        return new Promise((resolve) => window._g(`enhancement&action=progress&item=${itemId}&ingredients=${reagents}`, resolve));
    };

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const processChunks = async (upgradedItemId, chunks) => {
        for (const chunk of chunks) {
            if (!checkDailyLimit()) {
                if(window.message) message(`Przerwano ulepszanie. Limit ${dailyUpgradeLimit} osiągnięty.`);
                return true;
            }
            await setReagents(upgradedItemId, chunk);
            await enhanceItem(upgradedItemId, chunk);
            await sleep(200);

            const progressInfo = await setEnhancedItem(upgradedItemId);
            await sleep(100);

            const progressText = getEnhancementProgressText();
            if (progressInfo.isCompleted) {
                if(window.message) message(`Ulepszono! Progres: ${progressText}. (MAX)`);
                return true;
            }
            if(window.message) message(`Ulepszono! Progres: ${progressText}`);
            await sleep(300);
        }
        return false;
    }

    const handleBagCheck = async () => {
        if (!currentSettings.enabled || !currentSettings.bags_upgrade || !checkDailyLimit() || isUpgrading) return;
        const upgradedItemId = getUpgradedItemId();
        const upgradedItem = window.Engine.items.getItemById(upgradedItemId);
        if (!upgradedItem) return;

        const reagents = getReagents();
        const freeSlots = getFreeSlots();
        if (reagents.length >= 1 && freeSlots <= currentSettings.count_bags_upgrade) {
            isUpgrading = true;
            if(window.message) message(`Wolne sloty: ${freeSlots}. Ulepszam! ${upgradedItem.name}.`);
            try {
                toggleEnhancementWindow();
                const progressInfo = await setEnhancedItem(upgradedItemId);
                if (progressInfo.isCompleted) {
                    if(window.message) message(`Maksymalny progres osiągnięty.`);
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
        
        if(window.message) message(`Ulepszam! ${upgradedItem.name}.`);
        isUpgrading = true;
        try {
            toggleEnhancementWindow();
            const progressInfo = await setEnhancedItem(upgradedItemId);
            if (progressInfo.isCompleted) {
                if(window.message) message(`Maksymalny progres osiągnięty.`);
                return;
            }
            const chunks = chunkReagents(reagents);
            await processChunks(upgradedItemId, chunks);
        } finally {
            toggleEnhancementWindow();
            isUpgrading = false;
        }
    };

    const handleKeydown = async (event) => {
        const hotkey = currentSettings.hotkeyKey.toLowerCase();
        const isInputActive = ["TEXTAREA", "MAGIC_INPUT", "INPUT"].includes(document.activeElement.tagName);

        if (event.key.toLowerCase() !== hotkey || isInputActive) return;

        if (isUpgrading) {
            event.preventDefault();
            return;
        }

        if (currentSettings.enabled && currentSettings.hotkeyEnabled) {
            isUpgrading = true;
            try {
                if (typeof window.Engine.battle?.d !== 'undefined' && window.Engine.battle.d.id !== 0) {
                    if(window.message) message("Nie można ręcznie ulepszać podczas walki.");
                    return;
                }
                if (!checkDailyLimit()) {
                    if(window.message) message(`Osiągnięto dzienny limit ${dailyUpgradeLimit} ulepszeń.`);
                    return;
                }
                const upgradedItemId = getUpgradedItemId();
                const upgradedItem = window.Engine.items.getItemById(upgradedItemId);
                if (!upgradedItem) { if(window.message) message("Nie znaleziono wybranego przedmiotu."); return; }

                const reagents = getReagents();
                if (reagents.length === 0) { if(window.message) message("Nie znaleziono odpowiednich składników."); return; }

                event.preventDefault();
                toggleEnhancementWindow();
                const chunks = chunkReagents(reagents);
                const progressInfo = await setEnhancedItem(upgradedItemId);
                if (progressInfo.isCompleted) {
                    if(window.message) message(`Ulepszanie zakończone. ${upgradedItem.name} osiągnął MAX progres.`);
                    toggleEnhancementWindow();
                    return;
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
        updateItemDisplay();

        if (!isMenuIntercepted) {
            const ogShowPopupMenu = window.Engine.interface.showPopupMenu;
            window.Engine.interface.showPopupMenu = function (menu, e) {
                const itemIdMatch = e.currentTarget?.className?.match(/item-id-(\d+)/);
                const itemId = itemIdMatch ? itemIdMatch[1] : null;
                const item = window.Engine.items.getItemById(itemId);
                const currentSelectedItemId = getUpgradedItemId();

                if (!itemId || !ITEM_TYPE_SETTINGS_MAP.hasOwnProperty(item?.cl)) {
                    return ogShowPopupMenu.call(this, menu, e);
                }

                let menuItem;
                if (itemId === currentSelectedItemId) {
                    menuItem = ["Anuluj ulepszanie", () => {
                        if (!currentSelectedItemId) return;
                        setUpgradedItemId("");
                        if(window.message) message(`Anulowano ulepszanie przedmiotu ${item.name}`);
                        updateItemDisplay();
                    }, { button: { cls: "menu-item--red" } }];
                } else {
                    menuItem = ["Ulepsz ten przedmiot", async () => {
                        setUpgradedItemId(itemId);
                        if(window.message) message(`Ulepszanie przedmiotu ${item.name}`);
                        toggleEnhancementWindow();
                        await setEnhancedItem(itemId);
                        toggleEnhancementWindow();
                        updateItemDisplay();
                    }, { button: { cls: "menu-item--green" } }];
                }

                const updatedMenu = [menuItem, ...menu];
                return ogShowPopupMenu.call(this, updatedMenu, e);
            };
            isMenuIntercepted = true;
        }

        if (!isCommunicationHooked) {
            const originalParseJSON = window.Engine.communication.parseJSON;
            window.Engine.communication.parseJSON = function (data) {
                if (data?.enhancement?.usages_preview?.count !== undefined) {
                    dailyUpgradeCount = data.enhancement.usages_preview.count;
                    dailyUpgradeLimit = data.enhancement.usages_preview.limit || dailyUpgradeLimit;
                    localStorage.setItem(DAILY_COUNT_KEY, dailyUpgradeCount);
                    updateItemDisplay();
                }
                return originalParseJSON.call(this, data);
            };
            isCommunicationHooked = true;
        }

        if (!isEndBattleHooked && typeof window.Engine?.battle?.setEndBattle === 'function') {
            const originalSetEndBattle = window.Engine.battle.setEndBattle.bind(window.Engine.battle);
            window.Engine.battle.setEndBattle = function() {
                originalSetEndBattle();
                if (currentSettings.enabled && currentSettings.upgrade_endbattle) handleEndBattle();
            };
            isEndBattleHooked = true;
        }

        if (!isKeyDownHooked) {
            window.document.addEventListener("keydown", handleKeydown);
            isKeyDownHooked = true;
        }

        BADDONZ_BAG_INTERVAL = setInterval(() => {
            if (currentSettings.enabled && currentSettings.bags_upgrade) handleBagCheck();
        }, BAG_CHECK_INTERVAL);
    }

    function addonStop() {
        if (BADDONZ_BAG_INTERVAL) clearInterval(BADDONZ_BAG_INTERVAL);
        BADDONZ_BAG_INTERVAL = null;

        if (uiMainWindow) { uiMainWindow.remove(); uiMainWindow = null; }
        if (uiSettingsWindow) { uiSettingsWindow.remove(); uiSettingsWindow = null; }
    }

    function onStateToggle(isEnabled) {
        currentSettings.enabled = isEnabled;
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
