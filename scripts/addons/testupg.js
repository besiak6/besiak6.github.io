// ==UserScript==
// @name          Baddonz Addon - Ulepszara
// @version       1.0.0
// @author        besiak & Baddonz Team
// @match         https://*.margonem.pl/
// @grant         none
// ==/UserScript==

(function () {
    'use strict';

    const MICC_BASE_URL = 'https://micc.garmory-cdn.cloud/obrazki/itemy/';
    const PROGRESS_STORAGE_KEY = "baddonz-enhancement-progress-char";
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

    const ITEM_CL_NAMES = {
        1: 'Jednoręczne', 2: 'Dwuręczne', 3: 'Półtoraręczne', 4: 'Łuki',
        5: 'Pomocnicze', 6: 'Różdżki', 7: 'Orby', 8: 'Zbroje', 9: 'Hełmy',
        10: 'Buty', 11: 'Rękawice', 12: 'Pierki', 13: 'Naszyjniki',
        14: 'Tarcze', 29: 'Strzały',
    };

    const ITEM_CL_MAP = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 29];

    // Rejestracja dodatku w głównym API Baddonz
    BaddonzAPI.registerAddon({
        id: 'ulepszara',
        name: 'Ulepszara',
        version: '1.0.0',
        defaults: {
            account: {
                wnd_pos: { left: '300px', top: '200px' },
                wnd_opacity: 2,
                wnd_vsb: true,
                wnd_clp: false,
                wnd_settings_pos: { left: '350px', top: '250px' },
                wnd_settings_vsb: false,
                wnd_settings_opacity: 2,
                hotkeyKey: "j",
            },
            character: {
                enabled: false,
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
            }
        },

        // Zmienne wewnętrzne modułu
        dailyUpgradeCount: 0,
        dailyUpgradeLimit: 2000,
        isUpgrading: false,
        bagLoopActive: false,

        onInit() {
            this.loadDailyUpgradeCount();
            this.createUI();
            this.setupCommunicationHook();
            this.setupBattleHook();
            this.startBagCheckLoop();
        },

        loadProgress(itemId) {
            const charId = window.Engine.hero?.d?.id;
            if (!charId) return null;
            const storageKey = `${PROGRESS_STORAGE_KEY}-${charId}`;
            try {
                const allProgress = JSON.parse(localStorage.getItem(storageKey)) || {};
                return allProgress[itemId] || null;
            } catch (e) {
                return null;
            }
        },

        saveProgress(itemId, progressText) {
            const charId = window.Engine.hero?.d?.id;
            if (!itemId || !progressText || progressText === "Brak danych" || !charId) return;

            const storageKey = `${PROGRESS_STORAGE_KEY}-${charId}`;
            let allProgress = {};
            try {
                allProgress = JSON.parse(localStorage.getItem(storageKey)) || {};
            } catch (e) {}

            allProgress[itemId] = progressText;

            const upgradedItemId = this.getUpgradedItemId();
            if (!upgradedItemId || upgradedItemId !== itemId) {
                 delete allProgress[itemId];
            }

            localStorage.setItem(storageKey, JSON.stringify(allProgress));
        },

        saveDailyUpgradeCount(count) {
            localStorage.setItem("baddonz-daily-upgrade-count", count);
        },

        loadDailyUpgradeCount() {
            const count = parseInt(localStorage.getItem("baddonz-daily-upgrade-count"));
            this.dailyUpgradeCount = !isNaN(count) ? count : 0;
        },

        setUpgradedItemId(itemId) {
            if (!window.Engine || !Engine.hero || !Engine.hero.d) return;
            window.localStorage.setItem(`baddonz-upgrader-charId-${Engine.hero.d.id}`, itemId);
        },

        getUpgradedItemId() {
            try {
                return window.localStorage.getItem(`baddonz-upgrader-charId-${Engine.hero.d.id}`);
            } catch (e) { return null; }
        },

        updateItemDisplay(itemId) {
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

            const storedProgress = this.loadProgress(itemId);
            if (storedProgress) {
                progressEl.textContent = `Progres: ${storedProgress}`;
            }

            const $clonedItem = item.$.clone();
            $clonedItem.addClass('baddonz-upgrader-item-cursor');
            $clonedItem.on('click', () => {
                this.setUpgradedItemId("");
                BaddonzAPI.message(`Anulowano ulepszanie przedmiotu ${item.name}`);
                this.onUpdateUI();
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
        },

        createUI() {
            const acc = this.settings.account;
            const char = this.settings.character;

            let filterHtml = '';
            ITEM_CL_MAP.forEach(cl => {
                filterHtml += `
                    <div class="baddonz-typ-wrapper" data-key="cl${cl}" data-cl="${cl}">
                        <div class="baddonz-checkbox" id="baddonz-upgrader-cl-${cl}"></div>
                        <div class="baddonz-type-icon cl-${cl}"></div>
                    </div>
                `;
            });

            const settings_wnd_html = `
                <div class="baddonz-window" id="wnd-ulepszara-settings" style="position: absolute; display: ${acc.wnd_settings_vsb ? 'flex' : 'none'}; left: ${acc.wnd_settings_pos.left}; top: ${acc.wnd_settings_pos.top};">
                    <div class="baddonz-window-header">
                        <div class="baddonz-window-controls left">
                            <div class="baddonz-icon baddonz-opacity-button" id="baddonz-upgrader-settings-opacity-btn"></div>
                        </div>
                        <div class="baddonz-window-title">Ulepszara - Ustawienia</div>
                        <div class="baddonz-window-controls right">
                            <div class="baddonz-icon baddonz-close-button" id="baddonz-upgrader-settings-close-button"></div>
                        </div>
                    </div>
                    <div class="baddonz-window-body baddonz-flex column" style="gap: 4px; width: 250px;">
                        <div class="baddonz-setting-row baddonz-flex between centered">
                            <div class="baddonz-text">Ulepszaj Zwyklakami</div>
                            <div class="baddonz-checkbox" id="baddonz-upgrader-use-common"></div>
                        </div>
                        <div class="baddonz-setting-row baddonz-flex between centered">
                            <div class="baddonz-text">Ulepszaj Unikatami</div>
                            <div class="baddonz-checkbox" id="baddonz-upgrader-use-unique"></div>
                        </div>
                        <div class="baddonz-setting-row baddonz-flex between centered">
                            <div class="baddonz-text">Ulepszaj Związanymi</div>
                            <div class="baddonz-checkbox" id="baddonz-upgrader-allow-bound"></div>
                        </div>
                        <div class="baddonz-text" style="text-align: center; margin: 4px 0; border-bottom: 1px solid #303030; padding-bottom: 2px;">Typy Itemów:</div>
                        <div id="baddonz-upgrader-type-filters" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; justify-items: center;">
                            ${filterHtml}
                        </div>
                        <div class="baddonz-setting-row baddonz-flex between centered" style="margin-top: 6px;">
                            <div class="baddonz-text">Ulepszanie Klawiszem</div>
                            <div class="baddonz-checkbox" id="baddonz-upgrader-hotkey-enabled"></div>
                        </div>
                        <div id="baddonz-upgrader-hotkey-options" class="baddonz-flex column" style="gap: 2px;">
                            <div class="baddonz-text" style="font-size: 10px;">Klawisz skrótu:</div>
                            <input type="text" class="baddonz-input" id="baddonz-upgrader-hotkey-input" maxlength="7" style="width: 100%; text-transform: uppercase; text-align: center;">
                        </div>
                        <div class="baddonz-setting-row baddonz-flex between centered">
                            <div class="baddonz-text">Ulepszaj po walce</div>
                            <div class="baddonz-checkbox" id="baddonz-upgrader-upgrade-endbattle-check"></div>
                        </div>
                        <div id="baddonz-upgrader-endbattle-options" class="baddonz-flex column" style="gap: 2px;">
                            <div class="baddonz-text" style="font-size: 10px;">Min. Liczba Reagentów:</div>
                            <input type="number" class="baddonz-input" id="baddonz-upgrader-count-endbattle-input" min="1" max="50" style="width: 100%; text-align: center;">
                        </div>
                        <div class="baddonz-setting-row baddonz-flex between centered">
                            <div class="baddonz-text">Torba (wolne miejsca)</div>
                            <div class="baddonz-checkbox" id="baddonz-upgrader-bags-upgrade-check"></div>
                        </div>
                        <div id="baddonz-upgrader-bags-options" class="baddonz-flex column" style="gap: 2px;">
                            <div class="baddonz-text" style="font-size: 10px;">Max. Wolnych Slotów:</div>
                            <input type="number" class="baddonz-input" id="baddonz-upgrader-count-bags-upgrade-input" min="1" max="100" style="width: 100%; text-align: center;">
                        </div>
                    </div>
                </div>
            `;

            const main_wnd_html = `
                <div class="baddonz-window" id="wnd-ulepszara" style="position: absolute; display: ${acc.wnd_vsb ? 'flex' : 'none'}; left: ${acc.wnd_pos.left}; top: ${acc.wnd_pos.top};">
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
                    <div class="baddonz-window-body baddonz-flex column" style="gap: 0; padding-bottom: 4px; width: 160px;">
                        <div id="baddonz-upgrader-item-details" class="baddonz-flex column" style="align-items: center; width: 100%;">
                            <div id="baddonz-upgrader-item-display-container" class="baddonz-flex column" style="align-items: center; gap: 4px; margin-top: 5px; justify-content: center; width: 100%;">
                                <div id="baddonz-upgrader-item-slot-wrapper" class="baddonz-flex"></div>
                                <div class="baddonz-text" id="baddonz-upgrader-item-name" style="padding: 0; font-size: 11px; font-weight: bold; color: #ffcc00; text-shadow: 1px 1px #000; text-align: center;"></div>
                                <div class="baddonz-text" id="baddonz-upgrader-item-progress" style="padding: 0; font-size: 10px; color: #aaa; text-shadow: 1px 1px #000;"></div>
                            </div>
                        </div>
                        <div class="baddonz-text baddonz-upgrader-daily-limit-wrapper" style="padding-top: 4px; text-align: center; width: 100%;">
                            <div id="baddonz-upgrader-daily-limit" class="baddonz-upgrader-daily-limit-single-line">0/2000</div>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', main_wnd_html + settings_wnd_html);

            BaddonzAPI.setupWindowDrag("wnd-ulepszara", this.id, 'wnd_pos');
            BaddonzAPI.setupWindowDrag("wnd-ulepszara-settings", this.id, 'wnd_settings_pos');

            this.setupListeners();
            this.onUpdateUI();
        },

        setupListeners() {
            const mainWnd = document.getElementById("wnd-ulepszara");
            const settingsWnd = document.getElementById("wnd-ulepszara-settings");

            document.getElementById("baddonz-upgrader-main-collapse-btn").addEventListener('click', () => {
                this.settings.account.wnd_clp = !this.settings.account.wnd_clp;
                BaddonzAPI.saveSettings();
                this.onUpdateUI();
            });

            document.getElementById("baddonz-upgrader-main-settings-btn").addEventListener('click', () => {
                this.settings.account.wnd_settings_vsb = !this.settings.account.wnd_settings_vsb;
                settingsWnd.style.display = this.settings.account.wnd_settings_vsb ? 'flex' : 'none';
                BaddonzAPI.saveSettings();
                this.onUpdateUI();
            });

            document.getElementById("baddonz-upgrader-main-opacity-btn").addEventListener('click', () => {
                BaddonzAPI.handleOpacityClick("wnd-ulepszara", this.id, "wnd_opacity");
            });

            document.getElementById("baddonz-upgrader-settings-opacity-btn").addEventListener('click', () => {
                BaddonzAPI.handleOpacityClick("wnd-ulepszara-settings", this.id, "wnd_settings_opacity");
            });

            document.getElementById("baddonz-upgrader-state-button").addEventListener('click', () => {
                this.settings.character.enabled = !this.settings.character.enabled;
                BaddonzAPI.saveSettings();
                this.onUpdateUI();
            });

            document.getElementById("baddonz-upgrader-main-close-button").addEventListener('click', () => {
                this.settings.account.wnd_vsb = false;
                mainWnd.style.display = 'none';
                BaddonzAPI.saveSettings();
            });

            document.getElementById("baddonz-upgrader-settings-close-button").addEventListener('click', () => {
                this.settings.account.wnd_settings_vsb = false;
                settingsWnd.style.display = 'none';
                BaddonzAPI.saveSettings();
            });

            const checkboxes = [
                { id: "baddonz-upgrader-hotkey-enabled", key: "hotkeyEnabled" },
                { id: "baddonz-upgrader-use-common", key: "use_common" },
                { id: "baddonz-upgrader-use-unique", key: "use_unique" },
                { id: "baddonz-upgrader-allow-bound", key: "allow_bound_items" },
                { id: "baddonz-upgrader-upgrade-endbattle-check", key: "upgrade_endbattle" },
                { id: "baddonz-upgrader-bags-upgrade-check", key: "bags_upgrade" },
            ];

            checkboxes.forEach(item => {
                document.getElementById(item.id).addEventListener('click', () => {
                    this.settings.character[item.key] = !this.settings.character[item.key];
                    BaddonzAPI.saveSettings();
                    this.onUpdateUI();
                });
            });

            const endbattleInput = document.getElementById("baddonz-upgrader-count-endbattle-input");
            endbattleInput.addEventListener('change', () => {
                const val = Math.max(1, parseInt(endbattleInput.value) || 1);
                this.settings.character.count_endbattle = val;
                endbattleInput.value = val;
                BaddonzAPI.saveSettings();
            });

            const bagsInput = document.getElementById("baddonz-upgrader-count-bags-upgrade-input");
            bagsInput.addEventListener('change', () => {
                const val = Math.max(1, parseInt(bagsInput.value) || 1);
                this.settings.character.count_bags_upgrade = val;
                bagsInput.value = val;
                BaddonzAPI.saveSettings();
            });

            const hotkeyInput = document.getElementById("baddonz-upgrader-hotkey-input");
            const handleHotkeySetting = (e) => {
                if (['Tab', 'Enter', 'Escape', 'Shift', 'Control', 'Alt', 'Meta'].includes(e.key) || (e.key.length > 1 && e.key !== ' ')) {
                    return;
                }
                e.preventDefault();
                e.stopPropagation();
                let newKey = e.key.toLowerCase().slice(0, 1);
                if (newKey) {
                    this.settings.account.hotkeyKey = newKey;
                } else if (e.key === ' '){
                    this.settings.account.hotkeyKey = ' ';
                }
                hotkeyInput.removeEventListener('keydown', handleHotkeySetting);
                hotkeyInput.blur();
                BaddonzAPI.saveSettings();
                this.onUpdateUI();
            };

            hotkeyInput.addEventListener('focus', () => {
                hotkeyInput.value = (this.settings.account.hotkeyKey === ' ' ? 'SPACJA' : this.settings.account.hotkeyKey.toUpperCase());
                hotkeyInput.addEventListener('keydown', handleHotkeySetting);
            });

            hotkeyInput.addEventListener('blur', () => {
                hotkeyInput.removeEventListener('keydown', handleHotkeySetting);
                this.onUpdateUI();
            });

            document.querySelectorAll('#baddonz-upgrader-type-filters .baddonz-typ-wrapper').forEach(wrapper => {
                const cl = parseInt(wrapper.getAttribute('data-cl'));
                const key = wrapper.getAttribute('data-key');
                
                if (typeof $ === 'function' && $.fn.tip && ITEM_CL_NAMES[cl]) {
                    $(wrapper).tip(ITEM_CL_NAMES[cl]);
                }

                wrapper.addEventListener('click', () => {
                    this.settings.character[key] = !this.settings.character[key];
                    BaddonzAPI.saveSettings();
                    this.onUpdateUI();
                });
            });

            if (typeof $ === 'function' && $.fn.tip) {
                $("#baddonz-upgrader-main-close-button").tip('Zamknij');
                $("#baddonz-upgrader-settings-close-button").tip('Zamknij');
                $("#baddonz-upgrader-main-settings-btn").tip('Ustawienia');
                $("#baddonz-upgrader-main-opacity-btn").tip('Zmień przezroczystość');
                $("#baddonz-upgrader-settings-opacity-btn").tip('Zmień przezroczystość');
                $("#baddonz-upgrader-allow-bound").parent().tip('Używasz na własną odpowiedzialność!');
            }

            // Hook na klawisze gry dla ulepszania skrótem
            document.addEventListener('keydown', (e) => {
                if (!this.settings.character.enabled || !this.settings.character.hotkeyEnabled) return;
                if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

                if (e.key.toLowerCase() === this.settings.account.hotkeyKey.toLowerCase()) {
                    e.preventDefault();
                    this.runUpgradeProcess();
                }
            });
        },

        onUpdateUI() {
            const mainWnd = document.getElementById("wnd-ulepszara");
            const settingsWnd = document.getElementById("wnd-ulepszara-settings");
            if (!mainWnd || !settingsWnd) return;

            const acc = this.settings.account;
            const char = this.settings.character;

            BaddonzAPI.syncOpacity("wnd-ulepszara", this.id, "wnd_opacity");
            BaddonzAPI.syncOpacity("wnd-ulepszara-settings", this.id, "wnd_settings_opacity");

            document.getElementById("baddonz-upgrader-state-button").classList.toggle('baddonz-state-button--active', char.enabled);
            if (typeof $ === 'function' && $.fn.tip) {
                $(document.getElementById("baddonz-upgrader-state-button")).tip(char.enabled ? 'Wyłącz' : 'Włącz');
                $(document.getElementById("baddonz-upgrader-main-collapse-btn")).tip(acc.wnd_clp ? 'Rozwiń' : 'Zwiń');
            }

            const itemDetails = document.getElementById("baddonz-upgrader-item-details");
            if (acc.wnd_clp) {
                mainWnd.classList.add("wnd-ulepszara-collapsed");
                itemDetails.style.display = 'none';
            } else {
                mainWnd.classList.remove("wnd-ulepszara-collapsed");
                itemDetails.style.display = 'flex';
            }

            this.updateItemDisplay(this.getUpgradedItemId());

            document.getElementById("baddonz-upgrader-daily-limit").textContent = `Limit: ${this.dailyUpgradeCount}/${this.dailyUpgradeLimit}`;

            settingsWnd.querySelector("#baddonz-upgrader-hotkey-enabled").classList.toggle('active', char.hotkeyEnabled);
            settingsWnd.querySelector("#baddonz-upgrader-use-common").classList.toggle('active', char.use_common);
            settingsWnd.querySelector("#baddonz-upgrader-use-unique").classList.toggle('active', char.use_unique);
            settingsWnd.querySelector("#baddonz-upgrader-allow-bound").classList.toggle('active', char.allow_bound_items);
            settingsWnd.querySelector("#baddonz-upgrader-upgrade-endbattle-check").classList.toggle('active', char.upgrade_endbattle);
            settingsWnd.querySelector("#baddonz-upgrader-bags-upgrade-check").classList.toggle('active', char.bags_upgrade);

            settingsWnd.querySelector("#baddonz-upgrader-count-endbattle-input").value = char.count_endbattle;
            settingsWnd.querySelector("#baddonz-upgrader-count-bags-upgrade-input").value = char.count_bags_upgrade;

            const hotkeyInput = settingsWnd.querySelector("#baddonz-upgrader-hotkey-input");
            if (document.activeElement !== hotkeyInput) {
                hotkeyInput.value = (acc.hotkeyKey === ' ' ? 'SPACJA' : acc.hotkeyKey.toUpperCase());
            }

            document.getElementById("baddonz-upgrader-hotkey-options").style.display = char.hotkeyEnabled ? 'flex' : 'none';
            document.getElementById("baddonz-upgrader-endbattle-options").style.display = char.upgrade_endbattle ? 'flex' : 'none';
            document.getElementById("baddonz-upgrader-bags-options").style.display = char.bags_upgrade ? 'flex' : 'none';

            document.querySelectorAll('#baddonz-upgrader-type-filters .baddonz-checkbox').forEach(cb => {
                const cl = cb.id.replace('baddonz-upgrader-cl-', '');
                cb.classList.toggle('active', char[`cl${cl}`]);
            });
        },

        isEventItem(item) {
            if (!item || !item.getTipContent) return false;
            const tip = item.getTipContent();
            if (!tip) return false;
            const plainText = tip.replace(/<[^>]+>/g, '');
            return EVENT_KEYWORDS.some(keyword => plainText.includes(keyword));
        },

        getFreeSlots() {
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
        },

        setupCommunicationHook() {
            if (typeof Engine.communication.parseJSON !== 'function') {
                setTimeout(() => this.setupCommunicationHook(), 500);
                return;
            }
            const originalParseJSON = Engine.communication.parseJSON;
            const self = this;
            Engine.communication.parseJSON = function (data) {
                if (data?.enhancement?.usages_preview?.count !== undefined) {
                    self.dailyUpgradeCount = data.enhancement.usages_preview.count;
                    self.dailyUpgradeLimit = data.enhancement.usages_preview.limit || self.dailyUpgradeLimit;
                    self.saveDailyUpgradeCount(self.dailyUpgradeCount);
                    self.onUpdateUI();
                }
                return originalParseJSON.call(this, data);
            };
        },

        setupBattleHook() {
            if (typeof Engine.battle.setEndBattle !== 'function') {
                setTimeout(() => this.setupBattleHook(), 500);
                return;
            }
            const originalSetEndBattle = Engine.battle.setEndBattle.bind(Engine.battle);
            const self = this;
            Engine.battle.setEndBattle = function() {
                originalSetEndBattle();
                self.handleEndBattle();
            };
        },

        startBagCheckLoop() {
            if (this.bagLoopActive) return;
            this.bagLoopActive = true;
            const self = this;
            setTimeout(function bagLoop() {
                if (self.settings.character.enabled && self.settings.character.bags_upgrade) {
                    self.handleBagCheck();
                }
                setTimeout(bagLoop, BAG_CHECK_INTERVAL);
            }, BAG_CHECK_INTERVAL);
        },

        checkDailyLimit() {
            return this.dailyUpgradeCount < this.dailyUpgradeLimit;
        },

        getEnhancementProgressText() {
            try {
                const currentProgressTextEl = Engine.crafting.window.wnd.$[0].querySelector('.enhance__progress-text--current');
                if (currentProgressTextEl) {
                    return currentProgressTextEl.textContent.trim();
                }
            } catch (e) {}
            return "Brak danych";
        },

        isProgressCompleted() {
            try {
                const currentText = this.getEnhancementProgressText();
                if (currentText === "Brak danych") return false;
                const parts = currentText.split('/');
                const currentVal = parseInt(parts[0]?.trim());
                const maxVal = parseInt(parts[1]?.trim());
                return currentVal === maxVal && currentVal !== 0;
            } catch (e) {}
            return false;
        },

        async handleBagCheck() {
            if (!this.settings.character.enabled || !this.settings.character.bags_upgrade || !this.checkDailyLimit() || this.isUpgrading) return;
            const upgradedItemId = this.getUpgradedItemId();
            const upgradedItem = Engine.items.getItemById(upgradedItemId);
            if (!upgradedItem) return;

            const reagents = this.getReagents();
            const freeSlots = this.getFreeSlots();

            if (reagents.length >= 1 && freeSlots <= this.settings.character.count_bags_upgrade) {
                this.isUpgrading = true;
                BaddonzAPI.message(`Wolne sloty: ${freeSlots}. Ulepszam: ${upgradedItem.name}.`);
                try {
                    await this.runUpgradeProcess();
                } catch (e) {
                    console.error(e);
                } finally {
                    this.isUpgrading = false;
                }
            }
        },

        async handleEndBattle() {
            if (!this.settings.character.enabled || !this.settings.character.upgrade_endbattle || !this.checkDailyLimit() || this.isUpgrading) return;
            const upgradedItemId = this.getUpgradedItemId();
            const upgradedItem = Engine.items.getItemById(upgradedItemId);
            if (!upgradedItem) return;

            const reagents = this.getReagents();
            if (reagents.length >= this.settings.character.count_endbattle) {
                this.isUpgrading = true;
                BaddonzAPI.message(`Koniec walki, ulepszam: ${upgradedItem.name}!`);
                try {
                    await this.runUpgradeProcess();
                } catch (e) {
                    console.error(e);
                } finally {
                    this.isUpgrading = false;
                }
            }
        },

        getReagents() {
            if (!window.Engine || !Engine.items) return [];
            const char = this.settings.character;
            return Engine.items.getStoryItems().filter(item => {
                if (!item || item.loc !== 'g') return false;
                if (this.isEventItem(item)) return false;

                const isCommon = item.rarity === 'common' && char.use_common;
                const isUnique = item.rarity === 'unique' && char.use_unique;
                if (!isCommon && !isUnique) return false;

                const isBound = item.stat && item.stat.includes('bound');
                if (isBound && !char.allow_bound_items) return false;

                const filterKey = `cl${item.cl}`;
                return !!char[filterKey];
            }).map(item => item.id);
        },

        toggleEnhancementWindow() {
            return new Promise((resolve) => {
                const isOpen = Engine.crafting && Engine.crafting.window && document.querySelector('.wnd-enhancement');
                if (isOpen) {
                    resolve();
                } else {
                    _g('enhancement&action=open', () => {
                        const checkExist = setInterval(() => {
                            if (document.querySelector('.wnd-enhancement')) {
                                clearInterval(checkExist);
                                resolve();
                            }
                        }, 50);
                    });
                }
            });
        },

        closeEnhancementWindow() {
            if (Engine.crafting && Engine.crafting.window) {
                Engine.crafting.window.close();
            }
        },

        previewProgress(itemId, reagentIds) {
            if (!itemId || !reagentIds) return Promise.resolve(null);
            const reagents = reagentIds.join(",");
            return new Promise((resolve) => {
                _g(`enhancement&action=progress_preview&item=${itemId}&ingredients=${reagents}`, (data) => {
                    if (!data || data.ok === 0) {
                        resolve(null);
                        return;
                    }
                    const current = data.progress?.current || 0;
                    const max = data.progress?.max || 0;
                    let isCompleted = current === max && current !== 0;

                    if (data.progress_preview && Array.isArray(data.progress_preview)) {
                        const nextStep = data.progress_preview[0];
                        if (nextStep && nextStep.current === nextStep.max) {
                            isCompleted = true;
                        }
                    }

                    setTimeout(() => {
                        const progressText = this.getEnhancementProgressText();
                        if (progressText !== "Brak danych") {
                            this.saveProgress(itemId, progressText);
                        } else if (isCompleted) {
                            this.saveProgress(itemId, `${max}/${max}`);
                        }
                        this.onUpdateUI();
                        resolve({ current, max, isCompleted });
                    }, 300);
                });
            });
        },

        setReagents(itemId, reagentIds) {
            const reagents = reagentIds.join(",");
            return new Promise((resolve) => {
                _g(`enhancement&action=progress_preview&item=${itemId}&ingredients=${reagents}`, (data) => resolve(data));
            });
        },

        enhanceItem(itemId, reagentIds) {
            if (!itemId || !reagentIds) return Promise.resolve(null);
            const reagents = reagentIds.join(",");
            return new Promise((resolve) => {
                _g(`enhancement&action=progress&item=${itemId}&ingredients=${reagents}`, (data) => resolve(data));
            });
        },

        sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); },

        async runUpgradeProcess() {
            if (this.isUpgrading) return;
            this.isUpgrading = true;

            const itemId = this.getUpgradedItemId();
            if (!itemId) {
                BaddonzAPI.message("Nie wybrano przedmiotu do ulepszania.");
                this.isUpgrading = false;
                return;
            }

            if (!this.checkDailyLimit()) {
                BaddonzAPI.message("Osiągnięto dzienny limit ulepszeń.");
                this.isUpgrading = false;
                return;
            }

            let reagents = this.getReagents();
            if (reagents.length === 0) {
                BaddonzAPI.message("Brak odpowiednich składników do ulepszania.");
                this.isUpgrading = false;
                return;
            }

            BaddonzAPI.message("Rozpoczynam proces ulepszania...");
            await this.toggleEnhancementWindow();

            while (reagents.length > 0 && this.checkDailyLimit() && this.settings.character.enabled) {
                const currentBatch = reagents.slice(0, MAX_REAGENTS);
                
                const preview = await this.previewProgress(itemId, currentBatch);
                await this.sleep(150);

                await this.setReagents(itemId, currentBatch);
                await this.sleep(150);

                await this.enhanceItem(itemId, currentBatch);
                await this.sleep(400);

                if (preview && preview.isCompleted) {
                    BaddonzAPI.message("Przedmiot został pomyślnie ulepszony na kolejny poziom!");
                    this.setUpgradedItemId("");
                    break;
                }

                reagents = this.getReagents();
                if (reagents.length === 0) break;
            }

            this.closeEnhancementWindow();
            this.onUpdateUI();
            this.isUpgrading = false;
        }
    });

})();
