// ==UserScript==
// @name          baddonz - ulepszator [UPG]
// @version       2.0.5
// @author        besiak
// @match         https://*.margonem.pl/
// @grant         none
// ==/UserScript==

(function () {
    'use strict';

    const ADDON_ID = "UPG";
    const MICC_BASE_URL = 'https://micc.garmory-cdn.cloud/obrazki/itemy/';

    const SETTINGS_KEY_ACCOUNT = `baddonz-settings-${ADDON_ID}-account`;
    const SETTINGS_KEY_CHARACTER = `baddonz-settings-${ADDON_ID}-char`;
    
    // Tylko ustawienia logiki (pozycje okien i opacity obsługuje teraz baddonz 2.0.5 main script)
    const DEFAULT_ACCOUNT_SETTINGS = {
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

    const DEFAULT_CHARACTER_SETTINGS = {
        upgradedItemId: "",
        dailyUpgradeCount: 0,
        dailyUpgradeLimit: 2000
    };

    let accountSettings = {};
    let charSettings = {};
    let isUpgrading = false;

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
        5: 'Pomocnicze', 6: 'Różdżki', 7: 'Orby', 8: 'Zbroje', 9: 'Heły',
        10: 'Buty', 11: 'Rękawice', 12: 'Pierki', 13: 'Naszyjniki',
        14: 'Tarcze', 29: 'Strzały',
    };

    function loadSettings() {
        const charId = window.Engine?.hero?.d?.id;
        
        // Zapis przez baddonzAPI jeśli dostępne, inaczej fallback do localStorage
        if (window.baddonzAPI && typeof window.baddonzAPI.loadSettings === 'function') {
            accountSettings = { ...DEFAULT_ACCOUNT_SETTINGS, ...window.baddonzAPI.loadSettings(ADDON_ID, 'account') };
            charSettings = { ...DEFAULT_CHARACTER_SETTINGS, ...(charId ? window.baddonzAPI.loadSettings(ADDON_ID, 'character') : {}) };
        } else {
            try {
                const storedAccSettings = JSON.parse(localStorage.getItem(SETTINGS_KEY_ACCOUNT));
                accountSettings = { ...DEFAULT_ACCOUNT_SETTINGS, ...storedAccSettings };
            } catch (e) { accountSettings = { ...DEFAULT_ACCOUNT_SETTINGS }; }

            if (charId) {
                try {
                    const storedCharSettings = JSON.parse(localStorage.getItem(`${SETTINGS_KEY_CHARACTER}-${charId}`));
                    charSettings = { ...DEFAULT_CHARACTER_SETTINGS, ...storedCharSettings };
                } catch (e) { charSettings = { ...DEFAULT_CHARACTER_SETTINGS }; }
            }
        }
    }

    function saveSettings(type = 'all') {
        const charId = window.Engine?.hero?.d?.id;
        
        if (window.baddonzAPI && typeof window.baddonzAPI.saveSettings === 'function') {
            if (type === 'account' || type === 'all') window.baddonzAPI.saveSettings(ADDON_ID, 'account', accountSettings);
            if (type === 'character' || type === 'all') if(charId) window.baddonzAPI.saveSettings(ADDON_ID, 'character', charSettings);
        } else {
            if (type === 'account' || type === 'all') {
                localStorage.setItem(SETTINGS_KEY_ACCOUNT, JSON.stringify(accountSettings));
            }
            if (type === 'character' || type === 'all') {
                if (charId) localStorage.setItem(`${SETTINGS_KEY_CHARACTER}-${charId}`, JSON.stringify(charSettings));
            }
        }
    }

    function saveProgress(itemId, progressText) {
        if (!itemId || !progressText || progressText === "Brak danych") return;
        charSettings[`progress_${itemId}`] = progressText;
        saveSettings('character');
    }

    function loadProgress(itemId) {
        return charSettings[`progress_${itemId}`] || null;
    }

    function setUpgradedItemId(itemId) {
        charSettings.upgradedItemId = itemId;
        saveSettings('character');
    }

    function getUpgradedItemId() {
        return charSettings.upgradedItemId || "";
    }

    const updateItemDisplay = (itemId) => {
        if (typeof $ === 'undefined' || typeof Engine === 'undefined' || !Engine.items) return;
        const item = Engine.items.getItemById(itemId);
        const $slotWrapper = $('#baddonz-upgrader-item-slot-wrapper');
        const nameEl = document.getElementById("baddonz-upgrader-item-name");
        const progressEl = document.getElementById("baddonz-upgrader-item-progress");

        if (!$slotWrapper.length) return;

        $slotWrapper.empty();
        if(nameEl) nameEl.textContent = "";
        if(progressEl) progressEl.textContent = "";

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
        if(nameEl) nameEl.textContent = item.name;

        const storedProgress = loadProgress(itemId);
        if (storedProgress && progressEl) {
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

        $clonedItem.css({
            'position': 'relative',
            'width': '32px',
            'height': '32px',
            'top': '0',
            'left': '0'
        });

        $clonedItem.find('canvas.icon, canvas.canvas-notice').remove();

        const iconSource = item.icon || (`${item.id}.png`);
        const gifName = iconSource.replace(/\.[^/.]+$/, '.gif');
        const imgUrl = MICC_BASE_URL + gifName;

        const $img = $('<img>')
            .attr('src', imgUrl)
            .attr('class', 'baddonz-upgrader-gif')
            .css({
                width: '32px',
                height: '32px',
                position: 'absolute',
                top: '0',
                left: '0',
                zIndex: '0'
            });

        $clonedItem.append($img);
        $slotContainer.find('.slot').append($clonedItem);
        $slotWrapper.append($slotContainer);
    };

    function updateUI() {
        const stateBtn = document.getElementById("baddonz-upgrader-state-button");
        if (stateBtn) {
            stateBtn.classList.toggle('baddonz-state-button--active', accountSettings.enabled);
            if (typeof $ === 'function' && typeof $.fn.tip === 'function') {
                $(stateBtn).tip(accountSettings.enabled ? 'Wyłącz' : 'Włącz');
            }
        }

        const upgradedItemId = getUpgradedItemId();
        updateItemDisplay(upgradedItemId);

        const dailyLimitEl = document.getElementById("baddonz-upgrader-daily-limit");
        if (dailyLimitEl) {
            dailyLimitEl.textContent = `Dzienny Limit: ${charSettings.dailyUpgradeCount}/${charSettings.dailyUpgradeLimit}`;
        }

        const settingsWnd = document.getElementById("wnd-ulepszara-settings");
        if (!settingsWnd) return;
        
        settingsWnd.querySelector("#baddonz-upgrader-hotkey-enabled").classList.toggle('active', accountSettings.hotkeyEnabled);
        settingsWnd.querySelector("#baddonz-upgrader-use-common").classList.toggle('active', accountSettings.use_common);
        settingsWnd.querySelector("#baddonz-upgrader-use-unique").classList.toggle('active', accountSettings.use_unique);
        settingsWnd.querySelector("#baddonz-upgrader-allow-bound").classList.toggle('active', accountSettings.allow_bound_items);
        settingsWnd.querySelector("#baddonz-upgrader-upgrade-endbattle-check").classList.toggle('active', accountSettings.upgrade_endbattle);
        settingsWnd.querySelector("#baddonz-upgrader-bags-upgrade-check").classList.toggle('active', accountSettings.bags_upgrade);

        settingsWnd.querySelector("#baddonz-upgrader-count-endbattle-input").value = accountSettings.count_endbattle;
        settingsWnd.querySelector("#baddonz-upgrader-count-bags-upgrade-input").value = accountSettings.count_bags_upgrade;
        
        const hotkeyInputWrapper = document.getElementById("baddonz-upgrader-hotkey-options");
        const hotkeyInput = settingsWnd.querySelector("#baddonz-upgrader-hotkey-input");
        if (document.activeElement !== hotkeyInput) {
            hotkeyInput.value = (accountSettings.hotkeyKey === ' ' ? 'SPACJA' : accountSettings.hotkeyKey.toUpperCase());
        }

        hotkeyInputWrapper.style.display = accountSettings.hotkeyEnabled ? 'flex' : 'none';
        document.getElementById("baddonz-upgrader-endbattle-options").style.display = accountSettings.upgrade_endbattle ? 'flex' : 'none';
        document.getElementById("baddonz-upgrader-bags-options").style.display = accountSettings.bags_upgrade ? 'flex' : 'none';

        const itemTypeFiltersContainer = document.getElementById("baddonz-upgrader-type-filters");
        if(itemTypeFiltersContainer) {
            itemTypeFiltersContainer.querySelectorAll('.baddonz-checkbox').forEach(cb => {
                const cl = cb.id.replace('baddonz-upgrader-cl-', '');
                const key = `cl${cl}`;
                cb.classList.toggle('active', accountSettings[key]);
            });
        }
    }

    function generateItemTypeFiltersHtml() {
        const ITEM_CL_MAP = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 29];
        let html = '';
        ITEM_CL_MAP.forEach(cl => {
            const key = `cl${cl}`;
            html += `
                <div class="baddonz-typ-wrapper" data-key="${key}" data-cl="${cl}">
                    <div class="baddonz-checkbox" id="baddonz-upgrader-cl-${cl}"></div>
                    <div class="baddonz-type-icon cl-${cl}"></div>
                </div>
            `;
        });
        return html;
    }

    function createUI() {
        const settings_wnd_html = `
            <div class="baddonz-window" id="wnd-ulepszara-settings" style="position: absolute; display: none;">
                <div class="baddonz-window-header">
                    <div class="baddonz-window-controls left">
                        <div class="baddonz-icon baddonz-opacity-button" id="baddonz-upgrader-settings-opacity-btn"></div>
                    </div>
                    <div class="baddonz-window-title">Ulepszara - Ustawienia</div>
                    <div class="baddonz-window-controls right">
                        <div class="baddonz-icon baddonz-close-button" id="baddonz-upgrader-settings-close-button"></div>
                    </div>
                </div>
                <div class="baddonz-window-body baddonz-flex column" style="gap: 2px; width: 250px;">
                    <div style="border-bottom: 1px solid #303030; padding-top: 1px;"></div>
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
                    <div style="border-bottom: 1px solid #303030; padding-top: 1px;"></div>
                    <div class="baddonz-text" style="text-align: center; border-bottom: 1px solid #303030; padding-bottom: 2px;">
                        Typy Itemów:
                    </div>
                    <div id="baddonz-upgrader-type-filters" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; margin-left: 5px;">
                        ${generateItemTypeFiltersHtml()}
                    </div>
                    <div style="border-bottom: 1px solid #303030; padding-top: 1px;"></div>
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
            </div>
        `;

        const main_wnd_html = `
            <div class="baddonz-window" id="wnd-ulepszara" style="position: absolute;">
                <div class="baddonz-window-header baddonz-flex" style="justify-content: space-between;">
                    <div class="baddonz-window-controls left baddonz-flex" style="width: 70px;">
                        <div class="baddonz-icon baddonz-opacity-button" id="baddonz-upgrader-main-opacity-btn"></div>
                        <div class="baddonz-icon baddonz-settings-button" id="baddonz-upgrader-main-settings-btn"></div>
                        <div class="baddonz-icon baddonz-state-button" id="baddonz-upgrader-state-button"></div>
                    </div>
                    <div class="baddonz-window-title" style="flex-grow: 1;">Ulepszara</div>
                    <div class="baddonz-window-controls right baddonz-flex" style="width: 50px;">
                       <div class="baddonz-icon baddonz-collapsed" id="baddonz-upgrader-main-collapse-btn"></div>
                       <div class="baddonz-icon baddonz-close-button" id="baddonz-upgrader-main-close-button"></div>
                    </div>
                </div>
                <div class="baddonz-window-body baddonz-flex column" style="gap: 0; padding-bottom: 0;">
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
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', main_wnd_html + settings_wnd_html);
        updateUI();
        setupListeners();
    }

    function setupListeners() {
        const settingsBtn = document.getElementById("baddonz-upgrader-main-settings-btn");
        const stateBtn = document.getElementById("baddonz-upgrader-state-button");
        const collapseBtn = document.getElementById("baddonz-upgrader-main-collapse-btn");
        const settingsWnd = document.getElementById("wnd-ulepszara-settings");
        const mainWnd = document.getElementById("wnd-ulepszara");

        // W Baddonz 2.0.5 drag, close i opacity zostawiamy dla skryptu bazowego. 
        // Tutaj obsługujemy tylko specyficzne rzeczy dodatku.

        collapseBtn.addEventListener('click', () => {
            const itemDetails = document.getElementById("baddonz-upgrader-item-details");
            const isCollapsed = mainWnd.classList.toggle("wnd-ulepszara-collapsed");
            itemDetails.style.display = isCollapsed ? 'none' : 'flex';
        });

        settingsBtn.addEventListener('click', () => {
            const isHidden = settingsWnd.style.display === 'none';
            settingsWnd.style.display = isHidden ? 'flex' : 'none';
        });

        stateBtn.addEventListener('click', () => {
            accountSettings.enabled = !accountSettings.enabled;
            saveSettings('account');
            updateUI();
        });

        const sWND_checkboxes = [
            { id: "baddonz-upgrader-hotkey-enabled", key: "hotkeyEnabled" },
            { id: "baddonz-upgrader-use-common", key: "use_common" },
            { id: "baddonz-upgrader-use-unique", key: "use_unique" },
            { id: "baddonz-upgrader-allow-bound", key: "allow_bound_items" },
            { id: "baddonz-upgrader-upgrade-endbattle-check", key: "upgrade_endbattle" },
            { id: "baddonz-upgrader-bags-upgrade-check", key: "bags_upgrade" },
        ];

        sWND_checkboxes.forEach(item => {
            document.getElementById(item.id).addEventListener('click', () => {
                accountSettings[item.key] = !accountSettings[item.key];
                saveSettings('account');
                updateUI();
            });
        });

        const countEndbattleInput = document.getElementById("baddonz-upgrader-count-endbattle-input");
        countEndbattleInput.addEventListener('change', () => {
            const val = Math.max(1, parseInt(countEndbattleInput.value) || 1);
            accountSettings.count_endbattle = val;
            countEndbattleInput.value = val;
            saveSettings('account');
        });

        const countBagsUpgradeInput = document.getElementById("baddonz-upgrader-count-bags-upgrade-input");
        countBagsUpgradeInput.addEventListener('change', () => {
            const val = Math.max(1, parseInt(countBagsUpgradeInput.value) || 1);
            accountSettings.count_bags_upgrade = val;
            countBagsUpgradeInput.value = val;
            saveSettings('account');
        });

        const hotkeyInput = document.getElementById("baddonz-upgrader-hotkey-input");
        const handleHotkeySetting = (e) => {
            if (['Tab', 'Enter', 'Escape', 'Shift', 'Control', 'Alt', 'Meta'].includes(e.key) || (e.key.length > 1 && e.key !== ' ')) {
                return;
            }
            e.preventDefault();
            e.stopPropagation();

            let newKey = e.key.toLowerCase().slice(0, 1);
            if (newKey) accountSettings.hotkeyKey = newKey;
            else if (e.key === ' ') accountSettings.hotkeyKey = ' ';

            hotkeyInput.removeEventListener('keydown', handleHotkeySetting);
            hotkeyInput.blur();
            saveSettings('account');
            updateUI();
        };

        hotkeyInput.addEventListener('focus', () => {
            hotkeyInput.value = (accountSettings.hotkeyKey === ' ' ? 'SPACJA' : accountSettings.hotkeyKey.toUpperCase());
            hotkeyInput.addEventListener('keydown', handleHotkeySetting);
        });

        hotkeyInput.addEventListener('blur', () => {
            hotkeyInput.removeEventListener('keydown', handleHotkeySetting);
            updateUI();
        });

        const itemTypeFiltersContainer = document.getElementById("baddonz-upgrader-type-filters");
        if (typeof $ === 'function' && typeof $.fn.tip === 'function') {
            const tip = (el, text) => $(el).tip(text);
            itemTypeFiltersContainer.querySelectorAll('.baddonz-typ-wrapper').forEach(wrapper => {
                const cl = parseInt(wrapper.getAttribute('data-cl'));
                if (cl && ITEM_CL_NAMES[cl]) tip(wrapper, ITEM_CL_NAMES[cl]);

                wrapper.addEventListener('click', () => {
                    const key = wrapper.getAttribute('data-key');
                    if (key) {
                        accountSettings[key] = !accountSettings[key];
                        saveSettings('account');
                        updateUI();
                    }
                });
            });

            tip(settingsBtn, 'Ustawienia');
            tip(settingsWnd.querySelector("#baddonz-upgrader-allow-bound"), 'Używasz na własną odpowiedzialność! Uwaga na itemy z kolosów');
            tip(settingsWnd.querySelector("#baddonz-upgrader-upgrade-endbattle-check"), 'Automatyczne ulepszanie po walce gdy mamy odpwidnią ilość składników');
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
                if (Array.isArray(bag) && bag.length >= 2) {
                    totalFreeSlots += Math.max(0, bag[0] - bag[1]);
                }
            });
        }
        return totalFreeSlots;
    };

    let windowEnabled = false;
    const initializeScript = () => {
        try {
            if (!window.Engine.allInit) {
                setTimeout(initializeScript, 500);
                return;
            }
        } catch (error) {
            setTimeout(initializeScript, 500);
            return;
        }

        loadSettings();
        createUI();
        setupDOMAndListeners();
        setupCommunicationHook();

        if (typeof Engine.battle.setEndBattle === 'function') {
            const originalSetEndBattle = Engine.battle.setEndBattle.bind(Engine.battle);
            Engine.battle.setEndBattle = function() {
                originalSetEndBattle();
                handleEndBattle();
            };
        }

        setTimeout(function bagLoop() {
            if (accountSettings.bags_upgrade && accountSettings.enabled) {
                handleBagCheck();
            }
            setTimeout(bagLoop, BAG_CHECK_INTERVAL);
        }, BAG_CHECK_INTERVAL);
    };

    const setupCommunicationHook = () => {
        if (typeof Engine.communication.parseJSON !== 'function') {
            setTimeout(setupCommunicationHook, 500);
            return;
        }

        const originalParseJSON = Engine.communication.parseJSON;
        Engine.communication.parseJSON = function (data) {
            if (data?.enhancement?.usages_preview?.count !== undefined) {
                charSettings.dailyUpgradeCount = data.enhancement.usages_preview.count;
                charSettings.dailyUpgradeLimit = data.enhancement.usages_preview.limit || charSettings.dailyUpgradeLimit;
                saveSettings('character');
                updateUI();
            }
            return originalParseJSON.call(this, data);
        };
    };

    const checkDailyLimit = () => {
        return charSettings.dailyUpgradeCount < charSettings.dailyUpgradeLimit;
    }

    function getEnhancementProgressText() {
        try {
            const currentProgressTextEl = Engine.crafting.window.wnd.$[0].querySelector('.enhance__progress-text--current');
            if (currentProgressTextEl) return currentProgressTextEl.textContent.trim();
        } catch (e) {}
        return "Brak danych";
    }

    const handleBagCheck = async () => {
        if (!accountSettings.enabled || !accountSettings.bags_upgrade || !checkDailyLimit() || isUpgrading) return;
        const upgradedItemId = getUpgradedItemId();
        const upgradedItem = Engine.items.getItemById(upgradedItemId);

        if (!upgradedItem) return;

        const reagents = getReagents();
        const freeSlots = getFreeSlots();
        if (reagents.length >= 1 && freeSlots <= accountSettings.count_bags_upgrade) {
            isUpgrading = true;
            message(`Wolne sloty: ${freeSlots}. Ulepszam! ${upgradedItem.name}.`);

            try {
                toggleEnhancementWindow();
                const progressInfo = await setEnhancedItem(upgradedItemId);

                if (progressInfo.isCompleted) {
                    message(`Maksymalny progres osiągnięty.`);
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
        if (!accountSettings.enabled || !accountSettings.upgrade_endbattle || !checkDailyLimit() || isUpgrading) return;
        const upgradedItemId = getUpgradedItemId();
        const upgradedItem = Engine.items.getItemById(upgradedItemId);

        if (!upgradedItem) return;

        const reagents = getReagents();
        if (reagents.length < accountSettings.count_endbattle) return;
        message(`Ulepszam! ${upgradedItem.name}.`);

        isUpgrading = true;

        try {
            toggleEnhancementWindow();
            const progressInfo = await setEnhancedItem(upgradedItemId);

            if (progressInfo.isCompleted) {
                message(`Maksymalny progres osiągnięty.`);
                return;
            }

            const chunks = chunkReagents(reagents);
            await processChunks(upgradedItemId, chunks);
        } finally {
            toggleEnhancementWindow();
            isUpgrading = false;
        }
    };

    const processChunks = async (upgradedItemId, chunks) => {
        for (const chunk of chunks) {
            if (!checkDailyLimit()) {
                message(`Przerwano ulepszanie. Limit ${charSettings.dailyUpgradeLimit} osiągnięty.`);
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
            #wnd-ulepszara.wnd-ulepszara-collapsed { height: auto !important; }
            #wnd-ulepszara .baddonz-window-title { text-align: center; }
            #wnd-ulepszara-settings .baddonz-window-body { gap: 2px !important; }
            #baddonz-upgrader-type-filters { gap: 2px !important; }
            .baddonz-label-wrapper { justify-content: flex-start !important; gap: 5px; }
            .baddonz-typ-wrapper { display: flex; align-items: center; justify-content: center; cursor: url("https://gordion.margonem.pl/img/gui/cursor/5n.png") 4 0, pointer; gap: 3px; padding: 3px; background: rgba(0, 0, 0, 0.3); border-radius: 3px; user-select: none; }
            .baddonz-typ-wrapper:hover { background: rgba(255, 255, 255, 0.1); }
            #baddonz-upgrader-hotkey-input { font-weight: bold; }
            .baddonz-upgrader-item-cursor { cursor: url("https://gordion.margonem.pl/img/gui/cursor/1n.png") 4 0, pointer !important; }
            #baddonz-upgrader-main-item-slot { margin: 0; }
            .baddonz-upgrader-daily-limit-wrapper { text-align: center; padding: 0; margin-top: 0; display: block; gap: 0; }
            .baddonz-upgrader-daily-limit-single-line { font-size: 11px; color: #fff; font-weight: normal; padding: 0; margin: 0; display: block; }
            .baddonz-upgrader-daily-limit-single-line--expanded { font-size: 9px !important; }
            #baddonz-upgrader-main-close-button { position: relative; top: -1px; }
        `;
        const style = document.createElement("style");
        style.appendChild(document.createTextNode(css));
        document.head.appendChild(style);
    };

    const setupDOMAndListeners = () => {
        setupCSS();
        setupKeydownHandler();
        initItemContextMenu();
    };

    const setupKeydownHandler = () => {
        window.document.addEventListener("keydown", async (event) => {
            const hotkey = accountSettings.hotkeyKey.toLowerCase();
            const isInputActive = ["TEXTAREA", "MAGIC_INPUT", "INPUT"].includes(document.activeElement.tagName);

            if (event.key.toLowerCase() !== hotkey || isInputActive) return;
            if (isUpgrading) {
                event.preventDefault();
                return;
            }

            if (accountSettings.enabled && accountSettings.hotkeyEnabled) {
                isUpgrading = true;

                try {
                    if (typeof Engine.battle.d !== 'undefined' && Engine.battle.d.id !== 0) {
                        message("Nie można ręcznie ulepszać podczas walki.");
                        return;
                    }

                    if (!checkDailyLimit()) {
                        message(`Osiągnięto dzienny limit ${charSettings.dailyUpgradeLimit} ulepszeń.`);
                        return;
                    }

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

                } finally {
                    isUpgrading = false;
                }
            }
        });
    };

    const initItemContextMenu = () => {
        const ogShowPopupMenu = Engine.interface.showPopupMenu;
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

            const isWorthless = (
                (cached && Object.prototype.hasOwnProperty.call(cached, 'artisan_worthless')) ||
                Object.prototype.hasOwnProperty.call(item, 'artisan_worthless')
            );

            const cursed_flag = (cached.cursed !== undefined ? cached.cursed : (item.cursed !== undefined ? item.cursed : false));
            const itemLevel = (item.lvl ?? item.level ?? cached.lvl ?? 0);
            const itemClass = item.cl;

            const isAllowedRarity = (accountSettings.use_common && rarity === 'common') || (accountSettings.use_unique && rarity === 'unique');
            const itemSettingKey = ITEM_TYPE_SETTINGS_MAP[itemClass];
            const isAllowedType = itemSettingKey ? accountSettings[itemSettingKey] : false;
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

            if (isAllowedType && isAllowedRarity && !isEventItem(item) && !isUpgraded && !isWorthless && (accountSettings.allow_bound_items || !isBound) && !isPartOfBuild) {
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
                    const progress = data.enhancement.progress;
                    current = progress.current;
                    max = progress.max;
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
        return new Promise((resolve) => _g(`enhancement&action=progress_preview&item=${itemId}&ingredients=${reagents}`, resolve));
    };

    const enhanceItem = (itemId, reagentIds) => {
        if (!itemId || !reagentIds) return;
        const reagents = reagentIds.join(",");
        return new Promise((resolve) => _g(`enhancement&action=progress&item=${itemId}&ingredients=${reagents}`, resolve));
    };

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    initializeScript();
})();
