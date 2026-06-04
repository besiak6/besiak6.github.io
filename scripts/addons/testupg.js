// ==UserScript==
// @name          Ulepszator - Moduł Baddonz
// @version       0.4
// @author        besiak (Refactor)
// @match         https://*.margonem.pl/
// @grant         none
// ==/UserScript==

(function () {
    'use strict';

    const ADDON_ID = 'ulepszara';
    const MICC_BASE_URL = 'https://micc.garmory-cdn.cloud/obrazki/itemy/';
    const DAILY_COUNT_KEY = "baddonz-daily-upgrade-count";
    const PROGRESS_STORAGE_KEY = "baddonz-enhancement-progress-char";
    const BAG_CHECK_INTERVAL = 5000;
    const MAX_REAGENTS = 25;

    const DEFAULT_SETTINGS = {
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

    let settings = { ...DEFAULT_SETTINGS };
    let dailyUpgradeCount = 0;
    let dailyUpgradeLimit = 2000;
    let isUpgrading = false;
    let windowEnabled = false;

    // Oryginalne referencje do czyszczenia przy stop()
    let originalSetEndBattle, originalParseJSON, ogShowPopupMenu;
    let bagLoopTimeout;

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
        const upgradedItemId = getUpgradedItemId();
        if (!upgradedItemId || upgradedItemId !== itemId) delete allProgress[itemId];
        localStorage.setItem(storageKey, JSON.stringify(allProgress));
    }

    function saveDailyUpgradeCount(count) { localStorage.setItem(DAILY_COUNT_KEY, count); }
    function loadDailyUpgradeCount() {
        const count = parseInt(localStorage.getItem(DAILY_COUNT_KEY));
        dailyUpgradeCount = !isNaN(count) ? count : 0;
    }

    function setUpgradedItemId(itemId) {
        if (!window.Engine || !Engine.hero || !Engine.hero.d) return;
        window.localStorage.setItem(`upgrader-charId-${Engine.hero.d.id}`, itemId);
    }

    function getUpgradedItemId() {
        try { return window.localStorage.getItem(`upgrader-charId-${Engine.hero.d.id}`); } catch (e) { return null; }
    }

    function loadSettings() {
        // Wykorzystanie BaddonzAPI do pobrania ustawień przypisanych do tego modułu
        const savedSettings = window.BaddonzAPI.getAddonSettings(ADDON_ID) || {};
        settings = { ...DEFAULT_SETTINGS, ...savedSettings };
        loadDailyUpgradeCount();
    }

    function saveSettings() {
        // Zapis przez BaddonzAPI (automatycznie kategoryzuje konta/postaci)
        window.BaddonzAPI.saveAddonSettings(ADDON_ID, settings);
    }

    const updateItemDisplay = (itemId) => {
        if (typeof $ === 'undefined' || typeof Engine === 'undefined' || !Engine.items) return;
        const item = Engine.items.getItemById(itemId);
        const $slotWrapper = $('#baddonz-upgrader-item-slot-wrapper');
        const nameEl = document.getElementById("baddonz-upgrader-item-name");
        const progressEl = document.getElementById("baddonz-upgrader-item-progress");

        if (!$slotWrapper.length) return;

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
            updateUI();
        });

        $clonedItem.css({ position: 'relative', width: '32px', height: '32px', top: '0', left: '0' });
        $clonedItem.find('canvas.icon, canvas.canvas-notice').remove();

        const iconSource = item.icon || (`${item.id}.png`);
        const gifName = iconSource.replace(/\.[^/.]+$/, '.gif');
        const imgUrl = MICC_BASE_URL + gifName;

        const $img = $('<img>').attr('src', imgUrl).addClass('baddonz-upgrader-gif').css({
            width: '32px', height: '32px', position: 'absolute', top: '0', left: '0', zIndex: '0'
        });

        $clonedItem.append($img);
        $slotContainer.find('.slot').append($clonedItem);
        $slotWrapper.append($slotContainer);
    };

    function updateUI() {
        const stateToggle = document.getElementById("baddonz-upgrader-state-toggle");
        if (stateToggle) stateToggle.classList.toggle('active', settings.enabled);

        const upgradedItemId = getUpgradedItemId();
        updateItemDisplay(upgradedItemId);

        const dailyLimitEl = document.getElementById("baddonz-upgrader-daily-limit");
        if (dailyLimitEl) dailyLimitEl.textContent = `Dzienny Limit: ${dailyUpgradeCount}/${dailyUpgradeLimit}`;

        const doc = document;
        const toggleClass = (id, key) => {
            const el = doc.getElementById(id);
            if (el) el.classList.toggle('active', settings[key]);
        };

        toggleClass("baddonz-upgrader-hotkey-enabled", "hotkeyEnabled");
        toggleClass("baddonz-upgrader-use-common", "use_common");
        toggleClass("baddonz-upgrader-use-unique", "use_unique");
        toggleClass("baddonz-upgrader-allow-bound", "allow_bound_items");
        toggleClass("baddonz-upgrader-upgrade-endbattle-check", "upgrade_endbattle");
        toggleClass("baddonz-upgrader-bags-upgrade-check", "bags_upgrade");

        const countEndbattleInput = doc.getElementById("baddonz-upgrader-count-endbattle-input");
        if (countEndbattleInput) countEndbattleInput.value = settings.count_endbattle;

        const countBagsUpgradeInput = doc.getElementById("baddonz-upgrader-count-bags-upgrade-input");
        if (countBagsUpgradeInput) countBagsUpgradeInput.value = settings.count_bags_upgrade;

        const hotkeyInputWrapper = doc.getElementById("baddonz-upgrader-hotkey-options");
        const hotkeyInput = doc.getElementById("baddonz-upgrader-hotkey-input");
        if (hotkeyInput && document.activeElement !== hotkeyInput) {
            hotkeyInput.value = (settings.hotkeyKey === ' ' ? 'SPACJA' : settings.hotkeyKey.toUpperCase());
        }
        if (hotkeyInputWrapper) hotkeyInputWrapper.style.display = settings.hotkeyEnabled ? 'flex' : 'none';

        const endbattleOpts = doc.getElementById("baddonz-upgrader-endbattle-options");
        if (endbattleOpts) endbattleOpts.style.display = settings.upgrade_endbattle ? 'flex' : 'none';

        const bagsOpts = doc.getElementById("baddonz-upgrader-bags-options");
        if (bagsOpts) bagsOpts.style.display = settings.bags_upgrade ? 'flex' : 'none';

        const itemTypeFiltersContainer = doc.getElementById("baddonz-upgrader-type-filters");
        if(itemTypeFiltersContainer) {
            itemTypeFiltersContainer.querySelectorAll('.baddonz-checkbox').forEach(cb => {
                const cl = cb.id.replace('baddonz-upgrader-cl-', '');
                cb.classList.toggle('active', settings[`cl${cl}`]);
            });
        }
    }

    function generateItemTypeFiltersHtml() {
        const ITEM_CL_MAP = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 29];
        return ITEM_CL_MAP.map(cl => `
            <div class="baddonz-typ-wrapper" data-key="cl${cl}" data-cl="${cl}">
                <div class="baddonz-checkbox" id="baddonz-upgrader-cl-${cl}"></div>
                <div class="baddonz-type-icon cl-${cl}"></div>
            </div>
        `).join('');
    }

    function createUI() {
        // Przekazujemy tylko czystą zawartość - okienkami zajmuje się BaddonzAPI
        const main_wnd_html = `
            <div class="baddonz-flex column" style="gap: 0; padding-bottom: 0;">
                <div id="baddonz-upgrader-item-details" class="baddonz-flex column" style="display: block; border-bottom: 1px solid #303030; padding: 0 0 5px 0; align-items: center;">
                    <div id="baddonz-upgrader-item-display-container" class="baddonz-flex column" style="align-items: center; gap: 2px; margin-top: 5px; justify-content: center;">
                        <div id="baddonz-upgrader-item-slot-wrapper" class="baddonz-flex"></div>
                        <div class="baddonz-text" id="baddonz-upgrader-item-name" style="padding: 0; font-size: 11px; font-weight: bold; color: #ffcc00; text-shadow: 1px 1px #000;"></div>
                        <div class="baddonz-text" id="baddonz-upgrader-item-progress" style="padding: 0; font-size: 10px; color: #aaa; text-shadow: 1px 1px #000;"></div>
                    </div>
                </div>
                <div class="baddonz-text baddonz-upgrader-daily-limit-wrapper" style="padding-top: 5px; margin-bottom: 0;">
                    <div id="baddonz-upgrader-daily-limit" class="baddonz-upgrader-daily-limit-single-line">0/2000</div>
                </div>
                <div class="baddonz-flex" style="justify-content: center; margin-top: 5px; cursor: pointer;" id="baddonz-upgrader-state-toggle-wrapper">
                    <div class="baddonz-checkbox" id="baddonz-upgrader-state-toggle" style="margin-right: 5px;"></div>
                    <div class="baddonz-text">Włącz Ulepszarkę</div>
                </div>
            </div>
        `;

        const settings_wnd_html = `
            <div class="baddonz-flex column" style="gap: 2px; width: 250px;">
                <div class="baddonz-label-wrapper">
                    <div class="baddonz-checkbox" id="baddonz-upgrader-use-common"></div>
                    <div class="baddonz-text">Ulepszaj Zwyklakami</div>
                </div>
                <div class="baddonz-label-wrapper">
                    <div class="baddonz-checkbox" id="baddonz-upgrader-use-unique"></div>
                    <div class="baddonz-text">Ulepszaj Unikatami</div>
                </div>
                <div class="baddonz-label-wrapper">
                    <div class="baddonz-checkbox" id="baddonz-upgrader-allow-bound"></div>
                    <div class="baddonz-text">Ulepszaj Związanymi</div>
                </div>
                <div style="border-bottom: 1px solid #303030; margin-top: 2px;"></div>
                <div class="baddonz-text" style="text-align: center; border-bottom: 1px solid #303030; padding-bottom: 2px;">Typy Itemów:</div>
                <div id="baddonz-upgrader-type-filters" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; margin-left: 5px;">
                    ${generateItemTypeFiltersHtml()}
                </div>
                <div style="border-bottom: 1px solid #303030; margin-top: 2px;"></div>
                <div class="baddonz-label-wrapper">
                    <div class="baddonz-checkbox" id="baddonz-upgrader-hotkey-enabled"></div>
                    <div class="baddonz-text">Ulepszanie Klawiszem</div>
                </div>
                <div id="baddonz-upgrader-hotkey-options" class="baddonz-flex column" style="margin-left: 5px;">
                    <div class="baddonz-text" style="font-size: 10px; margin-bottom: 3px;">Klawisz:</div>
                    <input type="text" class="baddonz-input" id="baddonz-upgrader-hotkey-input" maxlength="7" style="width: 100%; text-transform: uppercase; text-align: center;">
                </div>
                <div class="baddonz-label-wrapper">
                    <div class="baddonz-checkbox" id="baddonz-upgrader-upgrade-endbattle-check"></div>
                    <div class="baddonz-text">Ulepszaj po walce</div>
                </div>
                <div id="baddonz-upgrader-endbattle-options" class="baddonz-flex column" style="margin-left: 5px;">
                    <div class="baddonz-text" style="font-size: 10px; margin-bottom: 3px;">Min. Liczba Reagentów:</div>
                    <input type="number" class="baddonz-input" id="baddonz-upgrader-count-endbattle-input" min="1" max="50" style="width: 100%; text-align: center;">
                </div>
                <div class="baddonz-label-wrapper">
                    <div class="baddonz-checkbox" id="baddonz-upgrader-bags-upgrade-check"></div>
                    <div class="baddonz-text">Ulepszanie po miejscach w torbie</div>
                </div>
                <div id="baddonz-upgrader-bags-options" class="baddonz-flex column" style="margin-left: 5px;">
                    <div class="baddonz-text" style="font-size: 10px; margin-bottom: 3px;">Max. Wolne Slotów:</div>
                    <input type="number" class="baddonz-input" id="baddonz-upgrader-count-bags-upgrade-input" min="1" max="100" style="width: 100%; text-align: center;">
                </div>
            </div>
        `;

        if (window.BaddonzAPI && typeof window.BaddonzAPI.createAddonWindow === 'function') {
            window.BaddonzAPI.createAddonWindow({
                id: ADDON_ID,
                title: 'Ulepszara',
                content: main_wnd_html,
                settingsContent: settings_wnd_html,
                width: 250
            });
        }

        updateUI();
        setupListeners();
    }

    function setupListeners() {
        const toggleWrapper = document.getElementById("baddonz-upgrader-state-toggle-wrapper");
        if (toggleWrapper) {
            toggleWrapper.addEventListener('click', () => {
                settings.enabled = !settings.enabled;
                saveSettings();
                updateUI();
            });
        }

        const checkboxes = [
            { id: "baddonz-upgrader-hotkey-enabled", key: "hotkeyEnabled" },
            { id: "baddonz-upgrader-use-common", key: "use_common" },
            { id: "baddonz-upgrader-use-unique", key: "use_unique" },
            { id: "baddonz-upgrader-allow-bound", key: "allow_bound_items" },
            { id: "baddonz-upgrader-upgrade-endbattle-check", key: "upgrade_endbattle" },
            { id: "baddonz-upgrader-bags-upgrade-check", key: "bags_upgrade" },
        ];

        checkboxes.forEach(item => {
            const el = document.getElementById(item.id);
            if (el) {
                el.addEventListener('click', () => {
                    settings[item.key] = !settings[item.key];
                    saveSettings();
                    updateUI();
                });
            }
        });

        const countEndbattleInput = document.getElementById("baddonz-upgrader-count-endbattle-input");
        if(countEndbattleInput) countEndbattleInput.addEventListener('change', () => {
            settings.count_endbattle = Math.max(1, parseInt(countEndbattleInput.value) || 1);
            saveSettings();
            updateUI();
        });

        const countBagsUpgradeInput = document.getElementById("baddonz-upgrader-count-bags-upgrade-input");
        if(countBagsUpgradeInput) countBagsUpgradeInput.addEventListener('change', () => {
            settings.count_bags_upgrade = Math.max(1, parseInt(countBagsUpgradeInput.value) || 1);
            saveSettings();
            updateUI();
        });

        const hotkeyInput = document.getElementById("baddonz-upgrader-hotkey-input");
        const handleHotkeySetting = (e) => {
            if (['Tab', 'Enter', 'Escape', 'Shift', 'Control', 'Alt', 'Meta'].includes(e.key) || (e.key.length > 1 && e.key !== ' ')) return;
            e.preventDefault(); e.stopPropagation();
            settings.hotkeyKey = e.key === ' ' ? ' ' : e.key.toLowerCase().slice(0, 1);
            hotkeyInput.removeEventListener('keydown', handleHotkeySetting);
            hotkeyInput.blur();
            saveSettings();
            updateUI();
        };

        if(hotkeyInput) {
            hotkeyInput.addEventListener('focus', () => {
                hotkeyInput.value = (settings.hotkeyKey === ' ' ? 'SPACJA' : settings.hotkeyKey.toUpperCase());
                hotkeyInput.addEventListener('keydown', handleHotkeySetting);
            });
            hotkeyInput.addEventListener('blur', () => {
                hotkeyInput.removeEventListener('keydown', handleHotkeySetting);
                updateUI();
            });
        }

        const itemTypeFiltersContainer = document.getElementById("baddonz-upgrader-type-filters");
        if (itemTypeFiltersContainer && typeof $ === 'function' && typeof $.fn.tip === 'function') {
            const tip = (el, text) => $(el).tip(text);
            itemTypeFiltersContainer.querySelectorAll('.baddonz-typ-wrapper').forEach(wrapper => {
                const cl = parseInt(wrapper.getAttribute('data-cl'));
                if (cl && ITEM_CL_NAMES[cl]) tip(wrapper, ITEM_CL_NAMES[cl]);

                wrapper.addEventListener('click', () => {
                    const key = wrapper.getAttribute('data-key');
                    if (key) {
                        settings[key] = !settings[key];
                        saveSettings();
                        updateUI();
                    }
                });
            });

            tip(document.getElementById("baddonz-upgrader-allow-bound"), 'Używasz na własną odpowiedzialność! Uwaga na itemy z kolosów');
            tip(document.getElementById("baddonz-upgrader-upgrade-endbattle-check"), 'Automatyczne ulepszanie po walce gdy mamy odpwidnią ilość składników');
            tip(countBagsUpgradeInput, 'Ilośc miejsc potrzebna do uruchomienia ulepszania');
        }
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
        if (typeof Engine !== 'undefined' && Engine.bags && Array.isArray(Engine.bags)) {
            const bagsToCount = Engine.bags.length > 0 ? Engine.bags.slice(0, Engine.bags.length - 1) : Engine.bags;
            bagsToCount.forEach(bag => {
                if (Array.isArray(bag) && bag.length >= 2) totalFreeSlots += Math.max(0, bag[0] - bag[1]);
            });
        }
        return totalFreeSlots;
    };

    const initializeScript = () => {
        if (!window.Engine || !window.Engine.allInit) {
            setTimeout(initializeScript, 500);
            return;
        }

        loadSettings();
        createUI();
        setupCSS();
        setupKeydownHandler();
        initItemContextMenu();
        setupCommunicationHook();

        if (typeof Engine.battle.setEndBattle === 'function') {
            originalSetEndBattle = Engine.battle.setEndBattle.bind(Engine.battle);
            Engine.battle.setEndBattle = function() {
                originalSetEndBattle();
                handleEndBattle();
            };
        }

        const bagLoop = () => {
            if (settings.bags_upgrade && settings.enabled) handleBagCheck();
            bagLoopTimeout = setTimeout(bagLoop, BAG_CHECK_INTERVAL);
        };
        bagLoopTimeout = setTimeout(bagLoop, BAG_CHECK_INTERVAL);
    };

    const stopScript = () => {
        // Funkcja usuwająca modyfikacje wywoływana przy deaktywacji w Baddonz
        if (originalSetEndBattle) Engine.battle.setEndBattle = originalSetEndBattle;
        if (originalParseJSON) Engine.communication.parseJSON = originalParseJSON;
        if (ogShowPopupMenu) Engine.interface.showPopupMenu = ogShowPopupMenu;
        clearTimeout(bagLoopTimeout);
        // Baddonz zniszczy kod HTML automatycznie przy wyłączeniu modułu
    };

    const setupCommunicationHook = () => {
        if (typeof Engine.communication.parseJSON !== 'function') {
            setTimeout(setupCommunicationHook, 500);
            return;
        }
        originalParseJSON = Engine.communication.parseJSON;
        Engine.communication.parseJSON = function (data) {
            if (data?.enhancement?.usages_preview?.count !== undefined) {
                dailyUpgradeCount = data.enhancement.usages_preview.count;
                dailyUpgradeLimit = data.enhancement.usages_preview.limit || dailyUpgradeLimit;
                saveDailyUpgradeCount(dailyUpgradeCount);
                updateUI();
            }
            return originalParseJSON.call(this, data);
        };
    };

    const checkDailyLimit = () => dailyUpgradeCount < dailyUpgradeLimit;

    function getEnhancementProgressText() {
        try {
            const currentProgressTextEl = Engine.crafting.window.wnd.$[0].querySelector('.enhance__progress-text--current');
            if (currentProgressTextEl) return currentProgressTextEl.textContent.trim();
        } catch (e) {}
        return "Brak danych";
    }

    const handleBagCheck = async () => {
        if (!settings.enabled || !settings.bags_upgrade || !checkDailyLimit() || isUpgrading) return;
        const upgradedItemId = getUpgradedItemId();
        const upgradedItem = Engine.items.getItemById(upgradedItemId);
        if (!upgradedItem) return;

        const reagents = getReagents();
        const freeSlots = getFreeSlots();
        if (reagents.length >= 1 && freeSlots <= settings.count_bags_upgrade) {
            isUpgrading = true;
            message(`Wolne sloty: ${freeSlots}. Ulepszam! ${upgradedItem.name}.`);
            try {
                toggleEnhancementWindow();
                const progressInfo = await setEnhancedItem(upgradedItemId);
                if (progressInfo.isCompleted) {
                    message(`Maksymalny progres osiągnięty.`);
                    return;
                }
                await processChunks(upgradedItemId, chunkReagents(reagents));
            } finally {
                toggleEnhancementWindow();
                isUpgrading = false;
            }
        }
    };

    const handleEndBattle = async () => {
        if (!settings.enabled || !settings.upgrade_endbattle || !checkDailyLimit() || isUpgrading) return;
        const upgradedItemId = getUpgradedItemId();
        const upgradedItem = Engine.items.getItemById(upgradedItemId);
        if (!upgradedItem) return;

        const reagents = getReagents();
        if (reagents.length < settings.count_endbattle) return;
        
        message(`Ulepszam! ${upgradedItem.name}.`);
        isUpgrading = true;

        try {
            toggleEnhancementWindow();
            const progressInfo = await setEnhancedItem(upgradedItemId);
            if (progressInfo.isCompleted) {
                message(`Maksymalny progres osiągnięty.`);
                return;
            }
            await processChunks(upgradedItemId, chunkReagents(reagents));
        } finally {
            toggleEnhancementWindow();
            isUpgrading = false;
        }
    };

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
    }

    const setupCSS = () => {
        const css = `
            .upgrader-crafting-window { display: none !important; }
            .menu-item--yellow { background:rgb(57, 100, 17) !important; color: #fff !important; border-radius: 5px !important; padding: 5px !important; }
            .baddonz-label-wrapper { justify-content: flex-start !important; gap: 5px; }
            .baddonz-typ-wrapper {
                display: flex; align-items: center; justify-content: center;
                cursor: url("https://gordion.margonem.pl/img/gui/cursor/5n.png") 4 0, pointer;
                gap: 3px; padding: 3px; background: rgba(0, 0, 0, 0.3); border-radius: 3px; user-select: none;
            }
            .baddonz-typ-wrapper:hover { background: rgba(255, 255, 255, 0.1); }
            #baddonz-upgrader-hotkey-input { font-weight: bold; }
            .baddonz-upgrader-item-cursor { cursor: url("https://gordion.margonem.pl/img/gui/cursor/1n.png") 4 0, pointer !important; }
            #baddonz-upgrader-main-item-slot { margin: 0; }
            .baddonz-upgrader-daily-limit-wrapper { text-align: center; padding: 0; margin-top: 0; display: block; gap: 0; }
            .baddonz-upgrader-daily-limit-single-line { font-size: 11px; color: #fff; font-weight: normal; padding: 0; margin: 0; display: block; }
        `;
        const style = document.createElement("style");
        style.appendChild(document.createTextNode(css));
        document.head.appendChild(style);
    };

    const setupKeydownHandler = () => {
        window.document.addEventListener("keydown", async (event) => {
            const hotkey = settings.hotkeyKey.toLowerCase();
            const isInputActive = ["TEXTAREA", "MAGIC_INPUT", "INPUT"].includes(document.activeElement.tagName);

            if (event.key.toLowerCase() !== hotkey || isInputActive) return;
            if (isUpgrading) { event.preventDefault(); return; }

            if (settings.enabled && settings.hotkeyEnabled) {
                isUpgrading = true;
                try {
                    if (typeof Engine.battle.d !== 'undefined' && Engine.battle.d.id !== 0) {
                        message("Nie można ręcznie ulepszać podczas walki.");
                        return;
                    }
                    if (!checkDailyLimit()) {
                        message(`Osiągnięto dzienny limit ${dailyUpgradeLimit} ulepszeń.`);
                        return;
                    }

                    const upgradedItemId = getUpgradedItemId();
                    const upgradedItem = Engine.items.getItemById(upgradedItemId);
                    if (!upgradedItem) { message("Nie znaleziono wybranego przedmiotu."); return; }

                    const reagents = getReagents();
                    if (reagents.length === 0) { message("Nie znaleziono odpowiednich składników."); return; }

                    event.preventDefault();
                    toggleEnhancementWindow();

                    const progressInfo = await setEnhancedItem(upgradedItemId);
                    if (progressInfo.isCompleted) {
                        message(`Ulepszanie zakończone. ${upgradedItem.name} osiągnął MAX progres.`);
                        toggleEnhancementWindow();
                        return;
                    }

                    await processChunks(upgradedItemId, chunkReagents(reagents));
                    toggleEnhancementWindow();
                } finally {
                    isUpgrading = false;
                }
            }
        });
    };

    const initItemContextMenu = () => {
        ogShowPopupMenu = Engine.interface.showPopupMenu;
        Engine.interface.showPopupMenu = function (menu, e) {
            const itemId = getItemIdFromClassName(e.currentTarget?.className);
            const item = Engine.items.getItemById(itemId);
            const currentSelectedItemId = getUpgradedItemId();

            if (!itemId || !ITEM_TYPE_SETTINGS_MAP.hasOwnProperty(item?.cl)) {
                return ogShowPopupMenu.call(this, menu, e);
            }

            let menuItem;
            if (itemId === currentSelectedItemId) {
                menuItem = ["Anuluj ulepszanie", () => {
                    if (!currentSelectedItemId) return;
                    setUpgradedItemId("");
                    message(`Anulowano ulepszanie przedmiotu ${item.name}`);
                    updateUI();
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

            const updatedMenu = [menuItem, ...menu];
            ogShowPopupMenu.call(this, updatedMenu, e);
        };
    };

    const getItemIdFromClassName = (className) => {
        if (!className) return null;
        const match = className.match(/item-id-(\d+)/);
        return match ? match[1] : null;
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
            const isAllowedRarity = (settings.use_common && rarity === 'common') || (settings.use_unique && rarity === 'unique');
            const itemSettingKey = ITEM_TYPE_SETTINGS_MAP[itemClass];
            const isAllowedType = itemSettingKey ? settings[itemSettingKey] : false;
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

            if (isAllowedType && isAllowedRarity && !isEventItem(item) && !isUpgraded && !isWorthless && (settings.allow_bound_items || !isBound) && !isPartOfBuild) {
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
                    
                    updateUI(); 
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

    // ==========================================
    // REJESTRACJA W BADDONZ API
    // ==========================================
    const BaddonzUpgraderModule = {
        name: 'Ulepszara',
        init: initializeScript,
        stop: stopScript
    };

    function registerWithBaddonz() {
        if (typeof window.BaddonzAPI !== 'undefined') {
            window.BaddonzAPI.registerAddon(ADDON_ID, BaddonzUpgraderModule);
        } else {
            // Jeśli Baddonz ładuje się z opóźnieniem, sprawdzamy cyklicznie
            setTimeout(registerWithBaddonz, 1000);
        }
    }

    registerWithBaddonz();
})();
