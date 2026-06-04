// ==UserScript==
// @name          Ulepszara Baddonz 2.0
// @version       2.0.0
// @author        besiak & Gemini
// @match         https://*.margonem.pl/
// @grant         none
// ==/UserScript==

(function () {
    'use strict';

    const ADDON_ID = 'UPG';
    const MICC_BASE_URL = 'https://micc.garmory-cdn.cloud/obrazki/itemy/';
    const DAILY_COUNT_KEY = "baddonz-daily-upgrade-count";
    const PROGRESS_STORAGE_KEY = "baddonz-enhancement-progress-char";
    const BAG_CHECK_INTERVAL = 5000;
    const MAX_REAGENTS = 25;

    const DEFAULT_SETTINGS = {
        enabled: false,
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

    let settings = {};
    let dailyUpgradeCount = 0;
    let dailyUpgradeLimit = 2000;
    let isUpgrading = false;
    let bagIntervalId = null;

    const EVENT_KEYWORDS = [
        "Wakacje", "Urodziny Margonem", "Wielkanoc", "Noc Kupały",
        "Szabat Czarownic", "Halloween", "Gwiazdka", "Licytacja",
        "Licytacja eventowa"
    ];

    const ITEM_TYPE_SETTINGS_MAP = {
        1: 'cl1', 2: 'cl2', 3: 'cl3', 4: 'cl4', 5: 'cl5', 6: 'cl6',
        7: 'cl7', 8: 'cl8', 9: 'cl9', 10: 'cl10', 11: 'cl11', 12: 'cl12',
        13: 'cl13', 14: 'cl14', 29: 'cl29'
    };

    const ITEM_CL_NAMES = {
        1: 'Jednoręczne', 2: 'Dwuręczne', 3: 'Półtoraręczne', 4: 'Łuki',
        5: 'Pomocnicze', 6: 'Różdżki', 7: 'Orby', 8: 'Zbroje', 9: 'Hełmy',
        10: 'Buty', 11: 'Rękawice', 12: 'Pierścienie', 13: 'Naszyjniki',
        14: 'Tarcze', 29: 'Strzały'
    };

    // Integracja z API Baddonz 2.0.5 - bezpieczne pobieranie instancji
    function getAPI() {
        return window.BaddonzAPI || null;
    }

    function getCharId() {
        const API = getAPI();
        return API?.charId || window.Engine?.hero?.d?.id;
    }

    function loadSettings() {
        const API = getAPI();
        if (API && typeof API.getAddonSettings === 'function') {
            const stored = API.getAddonSettings(ADDON_ID, 'account');
            settings = { ...DEFAULT_SETTINGS, ...stored };
        } else {
            try {
                const stored = JSON.parse(localStorage.getItem(`baddonz-settings-${ADDON_ID}-account`));
                settings = { ...DEFAULT_SETTINGS, ...stored };
            } catch (e) {
                settings = { ...DEFAULT_SETTINGS };
            }
        }
        loadDailyUpgradeCount();
    }

    function saveSettings() {
        const API = getAPI();
        if (API && typeof API.saveAddonSettings === 'function') {
            API.saveAddonSettings(ADDON_ID, 'account', settings);
        } else {
            localStorage.setItem(`baddonz-settings-${ADDON_ID}-account`, JSON.stringify(settings));
        }
    }

    function getUpgradedItemId() {
        const charId = getCharId();
        if (!charId) return null;
        return localStorage.getItem(`baddonz-upg-item-char-${charId}`);
    }

    function setUpgradedItemId(itemId) {
        const charId = getCharId();
        if (!charId) return;
        if (itemId) {
            localStorage.setItem(`baddonz-upg-item-char-${charId}`, itemId);
        } else {
            localStorage.removeItem(`baddonz-upg-item-char-${charId}`);
        }
    }

    function loadProgress(itemId) {
        const charId = getCharId();
        if (!charId) return null;
        try {
            const allProgress = JSON.parse(localStorage.getItem(`${PROGRESS_STORAGE_KEY}-${charId}`)) || {};
            return allProgress[itemId] || null;
        } catch (e) { return null; }
    }

    function saveProgress(itemId, progressText) {
        const charId = getCharId();
        if (!itemId || !progressText || progressText === "Brak danych" || !charId) return;
        try {
            const storageKey = `${PROGRESS_STORAGE_KEY}-${charId}`;
            let allProgress = JSON.parse(localStorage.getItem(storageKey)) || {};
            allProgress[itemId] = progressText;
            
            if (getUpgradedItemId() !== itemId) {
                delete allProgress[itemId];
            }
            localStorage.setItem(storageKey, JSON.stringify(allProgress));
        } catch (e) {}
    }

    function loadDailyUpgradeCount() {
        const count = parseInt(localStorage.getItem(DAILY_COUNT_KEY));
        dailyUpgradeCount = !isNaN(count) ? count : 0;
    }

    function saveDailyUpgradeCount(count) {
        localStorage.setItem(DAILY_COUNT_KEY, count);
    }

    const updateItemDisplay = (itemId) => {
        if (typeof $ === 'undefined' || typeof Engine === 'undefined' || !Engine.items) return;
        const item = Engine.items.getItemById(itemId);
        const $slotWrapper = $('#baddonz-upgrader-item-slot-wrapper');
        const nameEl = document.getElementById("baddonz-upgrader-item-name");
        const progressEl = document.getElementById("baddonz-upgrader-item-progress");

        if (!$slotWrapper.length || !nameEl || !progressEl) return;

        $slotWrapper.empty();
        nameEl.textContent = "";
        progressEl.textContent = "";

        const $slotContainer = $(
            `<div class="enhance__item enhance__item--current interface-element-one-item-slot-decor" id="baddonz-upgrader-main-item-slot">
                <div class="slot"></div>
                <div class="lvl" data-lvl="0">
                    <div class="cl-icon icon-star-0"></div>
                </div>
              </div>`
        );

        if (!item) {
            $slotWrapper.append($slotContainer);
            return;
        }

        const upgradeLvl = item.upgrade_lvl || 0;
        $slotContainer.find('.lvl')
            .attr('data-lvl', upgradeLvl)
            .html(`<div class="cl-icon icon-star-${upgradeLvl}"></div>`);
        nameEl.textContent = item.name;

        const storedProgress = loadProgress(itemId);
        if (storedProgress) {
            progressEl.textContent = `Progres: ${storedProgress}`;
        }

        const $clonedItem = item.$.clone();
        $clonedItem.addClass('baddonz-upgrader-item-cursor');
        $clonedItem.on('click', () => {
            setUpgradedItemId("");
            message(`Anulowano ulepszanie przedmiotu ${item.name}`);
            updateUI();
        });
        $clonedItem.data('item', item);
        $clonedItem.css({ 'position': 'relative', 'width': '32px', 'height': '32px', 'top': '0', 'left': '0' });
        $clonedItem.find('canvas.icon, canvas.canvas-notice').remove();

        const iconSource = item.icon || (`${item.id}.png`);
        const gifName = iconSource.replace(/\.[^/.]+$/, '.gif');
        const imgUrl = MICC_BASE_URL + gifName;

        $('<img>').attr('src', imgUrl).css({
            width: '32px', height: '32px', position: 'absolute', top: '0', left: '0', zIndex: '0'
        }).appendTo($clonedItem);

        $slotContainer.find('.slot').append($clonedItem);
        $slotWrapper.append($slotContainer);
    };

    function updateUI() {
        const stateBtn = document.getElementById("baddonz-upgrader-state-button");
        if (!stateBtn) return;

        stateBtn.classList.toggle('baddonz-state-button--active', settings.enabled);
        if (typeof $ === 'function' && $.fn.tip) {
            $(stateBtn).tip(settings.enabled ? 'Wyłącz' : 'Włącz');
        }

        const upgradedItemId = getUpgradedItemId();
        updateItemDisplay(upgradedItemId);

        const dailyLimitEl = document.getElementById("baddonz-upgrader-daily-limit");
        if (dailyLimitEl) dailyLimitEl.textContent = `Dzienny Limit: ${dailyUpgradeCount}/${dailyUpgradeLimit}`;

        // Aktywacja checkboxów
        document.getElementById("baddonz-upgrader-hotkey-enabled").classList.toggle('active', settings.hotkeyEnabled);
        document.getElementById("baddonz-upgrader-use-common").classList.toggle('active', settings.use_common);
        document.getElementById("baddonz-upgrader-use-unique").classList.toggle('active', settings.use_unique);
        document.getElementById("baddonz-upgrader-allow-bound").classList.toggle('active', settings.allow_bound_items);
        document.getElementById("baddonz-upgrader-upgrade-endbattle-check").classList.toggle('active', settings.upgrade_endbattle);
        document.getElementById("baddonz-upgrader-bags-upgrade-check").classList.toggle('active', settings.bags_upgrade);

        // Wartości liczbowe i tekstowe
        document.getElementById("baddonz-upgrader-count-endbattle-input").value = settings.count_endbattle;
        document.getElementById("baddonz-upgrader-count-bags-upgrade-input").value = settings.count_bags_upgrade;
        
        const hotkeyInput = document.getElementById("baddonz-upgrader-hotkey-input");
        if (document.activeElement !== hotkeyInput) {
            hotkeyInput.value = (settings.hotkeyKey === ' ' ? 'SPACJA' : settings.hotkeyKey.toUpperCase());
        }

        // Widoczność sekcji zależnych
        document.getElementById("baddonz-upgrader-hotkey-options").style.display = settings.hotkeyEnabled ? 'flex' : 'none';
        document.getElementById("baddonz-upgrader-endbattle-options").style.display = settings.upgrade_endbattle ? 'flex' : 'none';
        document.getElementById("baddonz-upgrader-bags-options").style.display = settings.bags_upgrade ? 'flex' : 'none';

        // Filtry klas przedmiotów
        const typeFilters = document.getElementById("baddonz-upgrader-type-filters");
        if (typeFilters) {
            typeFilters.querySelectorAll('.baddonz-checkbox').forEach(cb => {
                const cl = cb.id.replace('baddonz-upgrader-cl-', '');
                cb.classList.toggle('active', settings[`cl${cl}`]);
            });
        }
    }

    function generateItemTypeFiltersHtml() {
        return Object.keys(ITEM_TYPE_SETTINGS_MAP).map(cl => `
            <div class="baddonz-typ-wrapper" data-key="cl${cl}" data-cl="${cl}" style="display:flex; align-items:center; justify-content:center; gap:3px; padding:3px; background:rgba(0,0,0,0.3); border-radius:3px; cursor:pointer;">
                <div class="baddonz-checkbox" id="baddonz-upgrader-cl-${cl}"></div>
                <div class="baddonz-type-icon cl-${cl}"></div>
            </div>
        `).join('');
    }

    function createUI() {
        // Nowoczesna struktura HTML przygotowana pod wewnętrzną treść dla createAddonWindow
        const contentHtml = `
            <div class="baddonz-window-body baddonz-flex column" style="gap: 5px; width: 250px; padding: 5px; user-select: none;">
                <!-- Panel kontrolny nagłówka dodatku -->
                <div class="baddonz-flex" style="justify-content: space-between; align-items: center; border-bottom: 1px solid #303030; padding-bottom: 4px;">
                    <div class="baddonz-text" style="font-weight: bold; color: #ffcc00; font-size: 11px;">Narzędzia:</div>
                    <div class="baddonz-flex" style="gap: 6px;">
                        <div class="baddonz-icon baddonz-state-button" id="baddonz-upgrader-state-button" style="cursor: pointer;"></div>
                        <div class="baddonz-icon baddonz-settings-button" id="baddonz-upgrader-main-settings-btn" style="cursor: pointer;"></div>
                        <div class="baddonz-icon baddonz-collapsed" id="baddonz-upgrader-main-collapse-btn" style="cursor: pointer;"></div>
                    </div>
                </div>

                <!-- Główny podgląd przedmiotu -->
                <div id="baddonz-upgrader-main-area" class="baddonz-flex column" style="gap: 2px;">
                    <div id="baddonz-upgrader-item-details" class="baddonz-flex column" style="align-items: center; border-bottom: 1px solid #303030; padding-bottom: 5px;">
                        <div id="baddonz-upgrader-item-display-container" class="baddonz-flex column" style="align-items: center; gap: 2px; margin-top: 5px; justify-content: center;">
                            <div id="baddonz-upgrader-item-slot-wrapper" class="baddonz-flex"></div>
                            <div class="baddonz-text" id="baddonz-upgrader-item-name" style="padding: 0; font-size: 11px; font-weight: bold; color: #ffcc00; text-shadow: 1px 1px #000;"></div>
                            <div class="baddonz-text" id="baddonz-upgrader-item-progress" style="padding: 0; font-size: 10px; color: #aaa; text-shadow: 1px 1px #000;"></div>
                        </div>
                    </div>
                    <div class="baddonz-text baddonz-upgrader-daily-limit-wrapper" style="text-align: center; padding-top: 4px;">
                        <div id="baddonz-upgrader-daily-limit" class="baddonz-upgrader-daily-limit-single-line" style="font-size: 11px; color:#fff;">Dzienny Limit: 0/2000</div>
                    </div>
                </div>

                <!-- Wysuwany zintegrowany panel ustawień dodatku -->
                <div id="baddonz-upgrader-settings-panel" class="baddonz-flex column" style="display: none; gap: 4px; border-top: 1px solid #303030; padding-top: 5px;">
                    <div class="baddonz-label-wrapper" style="display:flex; align-items:center; gap:5px;">
                        <div class="baddonz-checkbox" id="baddonz-upgrader-use-common"></div>
                        <div class="baddonz-text" style="font-size:11px;">Ulepszaj Zwyklakami</div>
                    </div>
                    <div class="baddonz-label-wrapper" style="display:flex; align-items:center; gap:5px;">
                        <div class="baddonz-checkbox" id="baddonz-upgrader-use-unique"></div>
                        <div class="baddonz-text" style="font-size:11px;">Ulepszaj Unikatami</div>
                    </div>
                    <div class="baddonz-label-wrapper" style="display:flex; align-items:center; gap:5px;">
                        <div class="baddonz-checkbox" id="baddonz-upgrader-allow-bound"></div>
                        <div class="baddonz-text" style="font-size:11px;">Ulepszaj Związanymi</div>
                    </div>
                    
                    <div style="border-bottom: 1px solid #303030; margin: 2px 0;"></div>
                    <div class="baddonz-text" style="text-align: center; font-weight: bold; font-size:11px;">Typy Itemów:</div>
                    <div id="baddonz-upgrader-type-filters" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px;">
                        ${generateItemTypeFiltersHtml()}
                    </div>
                    
                    <div style="border-bottom: 1px solid #303030; margin: 2px 0;"></div>
                    <div class="baddonz-label-wrapper" style="display:flex; align-items:center; gap:5px;">
                        <div class="baddonz-checkbox" id="baddonz-upgrader-hotkey-enabled"></div>
                        <div class="baddonz-text" style="font-size:11px;">Ulepszanie Klawiszem</div>
                    </div>
                    <div id="baddonz-upgrader-hotkey-options" class="baddonz-flex column" style="gap: 2px; padding-left:15px;">
                        <input type="text" class="baddonz-input" id="baddonz-upgrader-hotkey-input" maxlength="7" style="width: 100%; text-transform: uppercase; text-align: center; font-weight:bold;">
                    </div>

                    <div class="baddonz-label-wrapper" style="display:flex; align-items:center; gap:5px;">
                        <div class="baddonz-checkbox" id="baddonz-upgrader-upgrade-endbattle-check"></div>
                        <div class="baddonz-text" style="font-size:11px;">Ulepszaj po walce</div>
                    </div>
                    <div id="baddonz-upgrader-endbattle-options" class="baddonz-flex column" style="gap: 2px; padding-left:15px;">
                        <div class="baddonz-text" style="font-size: 9px; color:#aaa;">Min. Liczba Reagentów:</div>
                        <input type="number" class="baddonz-input" id="baddonz-upgrader-count-endbattle-input" min="1" max="50" style="text-align: center;">
                    </div>

                    <div class="baddonz-label-wrapper" style="display:flex; align-items:center; gap:5px;">
                        <div class="baddonz-checkbox" id="baddonz-upgrader-bags-upgrade-check"></div>
                        <div class="baddonz-text" style="font-size:11px;">Ulepszanie wolną torbą</div>
                    </div>
                    <div id="baddonz-upgrader-bags-options" class="baddonz-flex column" style="gap: 2px; padding-left:15px;">
                        <div class="baddonz-text" style="font-size: 9px; color:#aaa;">Max. Wolnych Slotów:</div>
                        <input type="number" class="baddonz-input" id="baddonz-upgrader-count-bags-upgrade-input" min="1" max="100" style="text-align: center;">
                    </div>
                </div>
            </div>
        `;

        const API = getAPI();
        if (API && typeof API.createAddonWindow === 'function') {
            // Wywołanie zunifikowanego kreatora z rdzenia Baddonz 2.0.5
            API.createAddonWindow(ADDON_ID, {
                title: 'Ulepszara',
                html: contentHtml
            });
        } else {
            // Awaryjny fallback (gdyby rdzeń jeszcze się nie załadował)
            const fallbackWnd = document.createElement('div');
            fallbackWnd.id = `wnd-addon-${ADDON_ID}`;
            fallbackWnd.className = 'baddonz-window';
            fallbackWnd.style.position = 'absolute';
            fallbackWnd.style.top = '20%';
            fallbackWnd.style.left = '20%';
            fallbackWnd.innerHTML = `<div class="baddonz-window-header"><div class="baddonz-window-title">Ulepszara (Standalone)</div></div>` + contentHtml;
            document.body.appendChild(fallbackWnd);
        }

        updateUI();
        setupListeners();
    }

    function setupListeners() {
        const collapseBtn = document.getElementById("baddonz-upgrader-main-collapse-btn");
        const settingsBtn = document.getElementById("baddonz-upgrader-main-settings-btn");
        const stateBtn = document.getElementById("baddonz-upgrader-state-button");
        const mainArea = document.getElementById("baddonz-upgrader-main-area");
        const settingsPanel = document.getElementById("baddonz-upgrader-settings-panel");

        if (collapseBtn && mainArea) {
            collapseBtn.addEventListener('click', () => {
                const isHidden = mainArea.style.display === 'none';
                mainArea.style.display = isHidden ? 'block' : 'none';
                collapseBtn.classList.toggle('baddonz-collapsed', !isHidden);
                if (typeof $ === 'function' && $.fn.tip) $(collapseBtn).tip(isHidden ? 'Zwiń' : 'Rozwiń');
            });
        }

        if (settingsBtn && settingsPanel) {
            settingsBtn.addEventListener('click', () => {
                const isHidden = settingsPanel.style.display === 'none';
                settingsPanel.style.display = isHidden ? 'flex' : 'none';
            });
        }

        if (stateBtn) {
            stateBtn.addEventListener('click', () => {
                settings.enabled = !settings.enabled;
                saveSettings();
                updateUI();
                manageBagLoop();
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
                    manageBagLoop();
                });
            }
        });

        const countEndbattleInput = document.getElementById("baddonz-upgrader-count-endbattle-input");
        if (countEndbattleInput) {
            countEndbattleInput.addEventListener('change', () => {
                const val = Math.max(1, parseInt(countEndbattleInput.value) || 1);
                settings.count_endbattle = val;
                countEndbattleInput.value = val;
                saveSettings();
            });
        }

        const countBagsUpgradeInput = document.getElementById("baddonz-upgrader-count-bags-upgrade-input");
        if (countBagsUpgradeInput) {
            countBagsUpgradeInput.addEventListener('change', () => {
                const val = Math.max(1, parseInt(countBagsUpgradeInput.value) || 1);
                settings.count_bags_upgrade = val;
                countBagsUpgradeInput.value = val;
                saveSettings();
            });
        }

        const hotkeyInput = document.getElementById("baddonz-upgrader-hotkey-input");
        if (hotkeyInput) {
            const handleHotkeySetting = (e) => {
                if (['Tab', 'Enter', 'Escape', 'Shift', 'Control', 'Alt', 'Meta'].includes(e.key) || (e.key.length > 1 && e.key !== ' ')) {
                    return;
                }
                e.preventDefault();
                e.stopPropagation();

                let newKey = e.key.toLowerCase().slice(0, 1);
                settings.hotkeyKey = newKey || ' ';

                hotkeyInput.removeEventListener('keydown', handleHotkeySetting);
                hotkeyInput.blur();
                saveSettings();
                updateUI();
            };

            hotkeyInput.addEventListener('focus', () => {
                hotkeyInput.addEventListener('keydown', handleHotkeySetting);
            });
            hotkeyInput.addEventListener('blur', () => {
                hotkeyInput.removeEventListener('keydown', handleHotkeySetting);
                updateUI();
            });
        }

        const itemTypeFiltersContainer = document.getElementById("baddonz-upgrader-type-filters");
        if (itemTypeFiltersContainer && typeof $ === 'function' && $.fn.tip) {
            itemTypeFiltersContainer.querySelectorAll('.baddonz-typ-wrapper').forEach(wrapper => {
                const cl = parseInt(wrapper.getAttribute('data-cl'));
                if (cl && ITEM_CL_NAMES[cl]) $(wrapper).tip(ITEM_CL_NAMES[cl]);

                wrapper.addEventListener('click', () => {
                    const key = wrapper.getAttribute('data-key');
                    if (key) {
                        settings[key] = !settings[key];
                        saveSettings();
                        updateUI();
                    }
                });
            });

            $(settingsBtn).tip('Ustawienia');
            $(document.getElementById("baddonz-upgrader-allow-bound")).tip('Używasz na własną odpowiedzialność! Uwaga na itemy z kolosów');
            $(document.getElementById("baddonz-upgrader-upgrade-endbattle-check")).tip('Automatyczne ulepszanie po walce');
        }
    }

    function isEventItem(item) {
        if (!item || !item.getTipContent) return false;
        const tip = item.getTipContent();
        if (!tip) return false;
        return EVENT_KEYWORDS.some(keyword => tip.replace(/<[^>]+>/g, '').includes(keyword));
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

    const checkDailyLimit = () => dailyUpgradeCount < dailyUpgradeLimit;

    function getEnhancementProgressText() {
        try {
            const currentProgressTextEl = Engine.crafting.window.wnd.$[0].querySelector('.enhance__progress-text--current');
            if (currentProgressTextEl) return currentProgressTextEl.textContent.trim();
        } catch (e) {}
        return "Brak danych";
    }

    const manageBagLoop = () => {
        if (settings.bags_upgrade && settings.enabled) {
            if (!bagIntervalId) {
                bagIntervalId = setInterval(handleBagCheck, BAG_CHECK_INTERVAL);
            }
        } else {
            if (bagIntervalId) {
                clearInterval(bagIntervalId);
                bagIntervalId = null;
            }
        }
    };

    const handleBagCheck = async () => {
        if (!settings.enabled || !settings.bags_upgrade || !checkDailyLimit() || isUpgrading) return;
        const upgradedItemId = getUpgradedItemId();
        const upgradedItem = Engine.items.getItemById(upgradedItemId);
        if (!upgradedItem) return;

        const reagents = getReagents();
        const freeSlots = getFreeSlots();
        if (reagents.length >= 1 && freeSlots <= settings.count_bags_upgrade) {
            isUpgrading = true;
            message(`Wolne sloty: ${freeSlots}. Automatyczne ulepszanie przedmiotu: ${upgradedItem.name}.`);
            await performUpgradeProcess(upgradedItemId, reagents);
            isUpgrading = false;
        }
    };

    const handleEndBattle = async () => {
        if (!settings.enabled || !settings.upgrade_endbattle || !checkDailyLimit() || isUpgrading) return;
        const upgradedItemId = getUpgradedItemId();
        const upgradedItem = Engine.items.getItemById(upgradedItemId);
        if (!upgradedItem) return;

        const reagents = getReagents();
        if (reagents.length < settings.count_endbattle) return;

        isUpgrading = true;
        message(`Ulepszam po walce przedmiotu: ${upgradedItem.name}.`);
        await performUpgradeProcess(upgradedItemId, reagents);
        isUpgrading = false;
    };

    const performUpgradeProcess = async (upgradedItemId, reagents) => {
        let windowEnabled = false;
        const toggleEnhancementWindow = () => {
            if (windowEnabled) {
                Engine.crafting.window.wnd.$.removeClass("upgrader-crafting-window");
                Engine.interface.clickCrafting();
                windowEnabled = false;
            } else {
                Engine.crafting.window.wnd.$.addClass("upgrader-crafting-window");
                Engine.interface.clickCrafting();
                windowEnabled = true;
            }
        };

        try {
            toggleEnhancementWindow();
            const progressInfo = await setEnhancedItem(upgradedItemId);
            if (progressInfo.isCompleted) {
                message(`Maksymalny postęp ulepszania został już osiągnięty.`);
                return;
            }

            const chunks = chunkReagents(reagents);
            for (const chunk of chunks) {
                if (!checkDailyLimit()) {
                    message(`Przerwano ulepszanie. Osiągnięto dzienny limit ${dailyUpgradeLimit}.`);
                    break;
                }

                await setReagents(upgradedItemId, chunk);
                await enhanceItem(upgradedItemId, chunk);
                await sleep(200);

                const nextProgress = await setEnhancedItem(upgradedItemId);
                await sleep(100);

                const progressText = getEnhancementProgressText();
                if (nextProgress.isCompleted) {
                    message(`Ulepszono! Progres: ${progressText}. (MAX)`);
                    break;
                }
                message(`Ulepszono! Progres: ${progressText}`);
                await sleep(300);
            }
        } finally {
            if (windowEnabled) toggleEnhancementWindow();
        }
    };

    const getReagents = () => {
        return Engine.items.fetchLocationItems("g").reduce((acc, item) => {
            if (!item) return acc;

            const cached = item._cachedStats || {};
            const rarity = cached.rarity || item.rarity;
            const enhancement_upgrade_lvl = cached.enhancement_upgrade_lvl !== undefined ? cached.enhancement_upgrade_lvl : item.enhancement_upgrade_lvl;

            const isWorthless = Object.prototype.hasOwnProperty.call(cached, 'artisan_worthless') || Object.prototype.hasOwnProperty.call(item, 'artisan_worthless');
            const cursed_flag = cached.cursed !== undefined ? cached.cursed : (item.cursed !== undefined ? item.cursed : false);
            const itemLevel = item.lvl ?? item.level ?? cached.lvl ?? 0;
            const itemClass = item.cl;

            if (itemLevel < 20 || cursed_flag || isWorthless) return acc;

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
            } catch (e) {}

            if (isAllowedType && isAllowedRarity && !isEventItem(item) && !isUpgraded && (settings.allow_bound_items || !isBound) && !isPartOfBuild) {
                acc.push(item.id);
            }
            return acc;
        }, []);
    };

    const chunkReagents = (reagents) => {
        const chunks = [];
        for (let i = 0; i < reagents.length; i += MAX_REAGENTS) {
            chunks.push(reagents.slice(i, i + MAX_REAGENTS));
        }
        return chunks;
    };

    const setEnhancedItem = (itemId) => {
        return new Promise((resolve) => {
            _g(`enhancement&action=status&item=${itemId}`, (data) => {
                let current = 0, max = 0, isCompleted = false;
                if (data?.enhancement?.progress) {
                    current = data.enhancement.progress.current;
                    max = data.enhancement.progress.max;
                    if (current > 0 && current === max) isCompleted = true;
                }

                setTimeout(() => {
                    const progressText = getEnhancementProgressText();
                    if (progressText !== "Brak danych") {
                        saveProgress(itemId, progressText);
                    } else if (isCompleted) {
                        saveProgress(itemId, `${max}/${max}`);
                    }
                    updateUI();
                    resolve({ current, max, isCompleted });
                }, 300);
            });
        });
    };

    const setReagents = (itemId, reagentIds) => {
        return new Promise((resolve) => {
            _g(`enhancement&action=progress_preview&item=${itemId}&ingredients=${reagentIds.join(",")}`, (data) => resolve(data));
        });
    };

    const enhanceItem = (itemId, reagentIds) => {
        return new Promise((resolve) => {
            _g(`enhancement&action=progress&item=${itemId}&ingredients=${reagentIds.join(",")}`, (data) => resolve(data));
        });
    };

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const setupKeydownHandler = () => {
        window.document.addEventListener("keydown", async (event) => {
            const hotkey = settings.hotkeyKey.toLowerCase();
            const isInputActive = ["TEXTAREA", "MAGIC_INPUT", "INPUT"].includes(document.activeElement.tagName);

            if (event.key.toLowerCase() !== hotkey || isInputActive || isUpgrading) return;

            if (settings.enabled && settings.hotkeyEnabled) {
                if (typeof Engine.battle.d !== 'undefined' && Engine.battle.d.id !== 0) {
                    message("Nie można ręcznie ulepszać podczas walki.");
                    return;
                }
                if (!checkDailyLimit()) {
                    message(`Osiągnięto dzienny limit ulepszeń.`);
                    return;
                }

                const upgradedItemId = getUpgradedItemId();
                const reagents = getReagents();

                if (!upgradedItemId) { message("Nie wybrano przedmiotu do ulepszania."); return; }
                if (reagents.length === 0) { message("Brak odpowiednich reagentów w plecaku."); return; }

                event.preventDefault();
                isUpgrading = true;
                await performUpgradeProcess(upgradedItemId, reagents);
                isUpgrading = false;
            }
        });
    };

    const initItemContextMenu = () => {
        const ogShowPopupMenu = Engine.interface.showPopupMenu;
        Engine.interface.showPopupMenu = function (menu, e) {
            if (!e.currentTarget?.className) return ogShowPopupMenu.call(this, menu, e);
            const match = e.currentTarget.className.match(/item-id-(\d+)/);
            const itemId = match ? match[1] : null;
            const item = Engine.items.getItemById(itemId);
            const currentSelectedItemId = getUpgradedItemId();

            if (!itemId || !ITEM_TYPE_SETTINGS_MAP.hasOwnProperty(item?.cl)) {
                return ogShowPopupMenu.call(this, menu, e);
            }

            let menuItem;
            if (itemId === currentSelectedItemId) {
                menuItem = ["Anuluj ulepszanie", () => {
                    setUpgradedItemId("");
                    message(`Anulowano ulepszanie przedmiotu ${item.name}`);
                    updateUI();
                }, { button: { cls: "menu-item--red" } }];
            } else {
                menuItem = ["Ulepsz ten przedmiot", async () => {
                    setUpgradedItemId(itemId);
                    message(`Wybrano przedmiot do ulepszania: ${item.name}`);
                    updateUI();
                }, { button: { cls: "menu-item--green" } }];
            }

            ogShowPopupMenu.call(this, [menuItem, ...menu], e);
        };
    };

    const setupCommunicationHook = () => {
        if (typeof Engine.communication.parseJSON !== 'function') {
            setTimeout(setupCommunicationHook, 500);
            return;
        }
        const originalParseJSON = Engine.communication.parseJSON;
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

    const setupCSS = () => {
        const css = `
            .upgrader-crafting-window { display: none !important; }
            .menu-item--yellow { background: rgb(57, 100, 17) !important; color: #fff !important; border-radius: 5px !important; padding: 5px !important; }
            .baddonz-typ-wrapper:hover { background: rgba(255, 255, 255, 0.1) !important; }
            .baddonz-upgrader-item-cursor { cursor: pointer !important; }
            #baddonz-upgrader-main-item-slot { margin: 0 auto; }
        `;
        const style = document.createElement("style");
        style.appendChild(document.createTextNode(css));
        document.head.appendChild(style);
    };

    const initializeScript = () => {
        if (!window.Engine?.allInit) {
            setTimeout(initializeScript, 500);
            return;
        }

        loadSettings();
        setupCSS();
        createUI();
        setupKeydownHandler();
        initItemContextMenu();
        setupCommunicationHook();
        manageBagLoop();

        // Podpięcie pod wydarzenie końca walki w silniku
        if (typeof Engine.battle.setEndBattle === 'function') {
            const originalSetEndBattle = Engine.battle.setEndBattle.bind(Engine.battle);
            Engine.battle.setEndBattle = function() {
                originalSetEndBattle();
                handleEndBattle();
            };
        }
    };

    // Cykl życia i rejestracja w API Baddonz 2.0.5
    const apiInstance = getAPI();
    if (apiInstance && typeof apiInstance.registerAddon === 'function') {
        apiInstance.registerAddon(ADDON_ID, {
            init: initializeScript,
            stop: () => {
                if (bagIntervalId) clearInterval(bagIntervalId);
            }
        });
    } else {
        initializeScript();
    }
})();
