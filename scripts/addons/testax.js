// ==UserScript==
// @name          AutoX
// @version       2.0.0
// @author        besiak
// @match         https://*.margonem.pl/*
// @grant         none
// ==/UserScript==

(function() {
    'use strict';

    const ADDON_ID = "AX";
    const SPECIAL_MAPS = ['Mapa testerów'];

    let currentSettings = {
        enabled: true,
        windowVisible: true,
        settingsWindowVisible: false,
        windowOpacity: 2,
        levelRange: "0-500",
        fastFight: false,
        attackFriends: false,
        attackClan: false,
        enableClanOptions: true,
        ignoreClans: "692,164,3,1517,256,58,1386,1504,1925,1757,758,2230,27,2141,10,1807,1029,2274,1459,1071,9,1829,516,2302,71,622,2761",
        alwaysAttackClans: "",
        enableNickOptions: false,
        ignoreNicks: "",
        enableAttackHotkey: false,
        hotkeyAttackKey: "z",
        onlyHotkeyAttack: false
    };

    let uiMainWindow = null;
    let uiSettingsWindow = null;
    let trackInterval = null;
    let fastFightInterval = null;

    let isAwaitingKey = false;
    let fastFightSent = false;
    let lastAttackTime = 0;
    
    // Zmienne z listami do szybkiego sprawdzania
    let ignoreClansList = [];
    let alwaysAttackClansList = [];
    let ignoreNicksList = [];

    // --- OBSŁUGA ZDARZEŃ SILNIKA (Emitter) ---
    class Emitter {
        constructor() { this.events = {}; }
        observe(obj, key, callback) {
            const originalFunction = obj[key];
            const originalContext = obj;
            obj[key] = (...args) => {
                callback.apply(this, args);
                return originalFunction.apply(originalContext, args);
            };
        }
    }
    const emitter = new Emitter();

    // --- ŁADOWANIE I ZAPIS USTAWIEŃ ---
    function loadSettings() {
        if (window.BaddonzAPI) currentSettings = { ...currentSettings, ...window.BaddonzAPI.getAddonSettings(ADDON_ID) };
        parseAllLists();
    }

    function saveSettings() {
        if (window.BaddonzAPI) window.BaddonzAPI.saveAddonSettings(ADDON_ID, currentSettings);
    }

    function parseAllLists() {
        ignoreClansList = currentSettings.ignoreClans.split(',').map(s => s.trim()).filter(Boolean);
        alwaysAttackClansList = currentSettings.alwaysAttackClans.split(',').map(s => s.trim()).filter(Boolean);
        ignoreNicksList = currentSettings.ignoreNicks.split(',').map(s => s.trim()).filter(Boolean);
    }

    function parseLevelRange(str) {
        const match = str.match(/^(\d+)-(\d+)$/);
        if (!match) return null;
        const min = parseInt(match[1]);
        const max = parseInt(match[2]);
        if (min > max) return null;
        return { min, max };
    }

    // --- LOGIKA WALKI ---
    function notInBattle() { return !Engine.battle.show; }
    function getOthers() { return Engine.others.getDrawableList().map(o => o.d); }
    function getHero() { return Engine.hero; }

    function checkTargetProtection(other) {
        if (!Engine.others.getById(other.id)) return true;
        const emoList = Engine.others.getById(other.id).getOnSelfEmoList();
        if (!emoList || emoList.length === 0) return true;
        return !emoList.some(e => ['battle', 'pvpprotected'].includes(e.name));
    }

    function checkSelfProtection() {
        const hero = Engine.hero;
        if (!hero) return false;
        const emoList = hero.getOnSelfEmoList();
        if (!emoList || emoList.length === 0) return false;
        return emoList.some(e => e.name === 'pvpprotected');
    }

    function isMapValidForAttack(map) {
        if (!map) return false;
        if (map.pvp === 2) return true;
        if (SPECIAL_MAPS.includes(map.name)) return true;
        return false;
    }

    function isEnemy(other) {
        const map = Engine?.map?.d;
        if (!other || typeof other.relation !== 'number') return false;
        
        if (Engine.party?.d && Array.isArray(Engine.party.d) && Engine.party.d.some(p => p.id === other.id)) return false;
        if (currentSettings.enableNickOptions && ignoreNicksList.includes(other.nick)) return false;

        let otherClanId = other.clan && typeof other.clan === 'object' ? other.clan.id : null;
        let otherClanName = other.clan && (typeof other.clan === 'object' ? other.clan.name : other.clan);
        
        const isClanIgnored = (id, name) => (id && ignoreClansList.includes(id.toString())) || (name && ignoreClansList.includes(name));
        const isClanAlwaysAttacked = (id, name) => (id && alwaysAttackClansList.includes(id.toString())) || (name && alwaysAttackClansList.includes(name));

        if (currentSettings.enableClanOptions) {
            if ((otherClanId || otherClanName) && isClanAlwaysAttacked(otherClanId, otherClanName)) return true;
            if ((otherClanId || otherClanName) && isClanIgnored(otherClanId, otherClanName)) return false;
        }

        if (other.relation === 2) return currentSettings.attackFriends;
        if ([4, 7].includes(other.relation)) return currentSettings.attackClan;

        if (map && isMapValidForAttack(map)) {
            if ([1, 3, 6].includes(other.relation)) return true;
            if ([4, 7].includes(other.relation) && currentSettings.attackClan) return true;
            if (other.relation === 2 && currentSettings.attackFriends) return true;
        }
        return false;
    }

    function getValidTargets() {
        if (checkSelfProtection()) return [];
        const lvlRange = parseLevelRange(currentSettings.levelRange) || { min: 0, max: 500 };
        return getOthers().filter(other =>
            isEnemy(other) && !other.inBattle &&
            other.lvl >= lvlRange.min && other.lvl <= lvlRange.max &&
            checkTargetProtection(other)
        );
    }

    function getClosestTarget() {
        const hero = getHero().d;
        const targets = getValidTargets();
        if (!targets.length) return null;

        const targetsWithDistance = targets.map(other => ({
            target: other,
            distance: Math.hypot(hero.x - other.x, hero.y - other.y)
        }));
        targetsWithDistance.sort((a, b) => a.distance - b.distance);
        return targetsWithDistance[0];
    }

    function attack(target, distance) {
        if (Date.now() - lastAttackTime < 300) return false;
        if (distance <= 3) {
            _g('fight&a=attack&id=' + target.id);
            lastAttackTime = Date.now();
            return true;
        }
        return false;
    }

    function hotkeyAttackAction() {
        if (!currentSettings.enabled || !notInBattle()) return;
        const map = Engine?.map?.d;
        if (!map || !isMapValidForAttack(map)) return;
        
        const closest = getClosestTarget();
        if (closest) attack(closest.target, closest.distance);
    }

    function handleAutoXLogic() {
        const map = Engine?.map?.d;
        if (!map || !isMapValidForAttack(map)) return;

        const closest = getClosestTarget();
        if (currentSettings.onlyHotkeyAttack) return;
        
        if (closest) attack(closest.target, closest.distance);
    }

    function handleFastFight() {
        if (Engine?.battle?.show && !Engine?.battle?.endBattle) {
            if (currentSettings.fastFight && !fastFightSent) {
                _g('fight&a=f');
                fastFightSent = true;
            }
        }
    }

    // --- ZDARZENIA KLAWIATURY ---
    function handleKeyDown(event) {
        if (!isAwaitingKey) {
            if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
            if (currentSettings.enabled && currentSettings.enableAttackHotkey && event.key.toLowerCase() === currentSettings.hotkeyAttackKey.toLowerCase()) {
                hotkeyAttackAction();
                event.preventDefault();
            }
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        const key = event.key.toLowerCase();
        
        const inputElement = document.getElementById('ax-hotkey-input');
        if (inputElement) {
            inputElement.value = key.toUpperCase();
            currentSettings.hotkeyAttackKey = key;
            saveSettings();
            inputElement.classList.remove('active-keybind-mode');
            inputElement.blur();
        }
        isAwaitingKey = false;
    }

    // --- BUDOWANIE INTERFEJSU (BADDONZ API 2.0) ---
    function buildUI() {
        
        // 1. BUDOWA GŁÓWNEGO OKNA
        const mainHtml = `
            <div class="baddonz-label-wrapper" style="justify-content: flex-start;">
                <div class="baddonz-checkbox ${currentSettings.enabled ? 'active' : ''}" id="ax-enabled-checkbox"></div>
                <div class="baddonz-text" style="padding: 0;">AutoX</div>
            </div>
            <div class="baddonz-label-wrapper" style="justify-content: flex-start; margin-top: 5px;">
                <div class="baddonz-text" style="padding: 0;">Lvl:</div>
                <input type="text" class="baddonz-input compact" id="ax-level-range-input" value="${currentSettings.levelRange}" style="width: 80px;">
            </div>
            <div class="baddonz-label-wrapper" style="justify-content: flex-start; margin-top: 5px;">
                <div class="baddonz-checkbox ${currentSettings.fastFight ? 'active' : ''}" id="ax-fastfight-checkbox"></div>
                <div class="baddonz-text" style="padding: 0;">Szybka Walka</div>
            </div>
        `;
        uiMainWindow = window.BaddonzAPI.createAddonWindow(ADDON_ID, "AutoX", mainHtml, { width: '150px' });

        // 2. BUDOWA OKNA USTAWIEŃ
        const settingsHtml = `
            <div class="baddonz-scroll" style="max-height: 250px; padding-right: 5px;">
                <div class="baddonz-setting-row">
                    <div class="baddonz-checkbox ${currentSettings.attackFriends ? 'active' : ''}" id="ax-attack-friends"></div>
                    <span class="baddonz-label baddonz-text">Atakuj Przyjaciół</span>
                </div>
                <div class="baddonz-setting-row">
                    <div class="baddonz-checkbox ${currentSettings.attackClan ? 'active' : ''}" id="ax-attack-clan"></div>
                    <span class="baddonz-label baddonz-text">Atakuj Klan/Sojusz</span>
                </div>
                <hr style="width: 100%; border-color: #303030; margin: 5px 0;">
                
                <div class="baddonz-setting-row">
                    <div class="baddonz-checkbox ${currentSettings.enableClanOptions ? 'active' : ''}" id="ax-enable-clan-opts"></div>
                    <span class="baddonz-label baddonz-text">Filtry Klanowe</span>
                </div>
                <div id="ax-clan-options" class="baddonz-flex column" style="gap: 5px; display: ${currentSettings.enableClanOptions ? 'flex' : 'none'};">
                    <div class="baddonz-text" style="padding:0;">Nie atakuj klanów (ID, Nazwa):</div>
                    <textarea class="baddonz-textarea baddonz-scroll" id="ax-ignore-clans">${currentSettings.ignoreClans}</textarea>
                    <div class="baddonz-text" style="padding:0;">Zawsze atakuj klany:</div>
                    <textarea class="baddonz-textarea baddonz-scroll" id="ax-always-clans">${currentSettings.alwaysAttackClans}</textarea>
                </div>
                
                <hr style="width: 100%; border-color: #303030; margin: 5px 0;">
                <div class="baddonz-setting-row">
                    <div class="baddonz-checkbox ${currentSettings.enableNickOptions ? 'active' : ''}" id="ax-enable-nick-opts"></div>
                    <span class="baddonz-label baddonz-text">Filtry Nicków</span>
                </div>
                <div id="ax-nick-options" class="baddonz-flex column" style="gap: 5px; display: ${currentSettings.enableNickOptions ? 'flex' : 'none'};">
                    <div class="baddonz-text" style="padding:0;">Nie atakuj graczy:</div>
                    <textarea class="baddonz-textarea baddonz-scroll" id="ax-ignore-nicks">${currentSettings.ignoreNicks}</textarea>
                </div>

                <hr style="width: 100%; border-color: #303030; margin: 5px 0;">
                <div class="baddonz-setting-row">
                    <div class="baddonz-checkbox ${currentSettings.enableAttackHotkey ? 'active' : ''}" id="ax-enable-hotkey"></div>
                    <span class="baddonz-label baddonz-text">Skrót Ataku</span>
                </div>
                <div id="ax-hotkey-options" class="baddonz-flex column" style="gap: 5px; display: ${currentSettings.enableAttackHotkey ? 'flex' : 'none'};">
                    <input type="text" class="baddonz-input keybind" id="ax-hotkey-input" value="${currentSettings.hotkeyAttackKey.toUpperCase()}" placeholder="Klawisz">
                    <div class="baddonz-setting-row" style="margin-top: 5px;">
                        <div class="baddonz-checkbox ${currentSettings.onlyHotkeyAttack ? 'active' : ''}" id="ax-only-hotkey"></div>
                        <span class="baddonz-label baddonz-text">Atakowanie TYLKO skrótem</span>
                    </div>
                </div>
            </div>
        `;
        
        uiSettingsWindow = window.BaddonzAPI.createAddonWindow(ADDON_ID, "AutoX Ustawienia", settingsHtml, { customId: 'baddonz-ax-wnd-settings', width: '230px' });
        // Bezpieczne odpięcie ID, by kliknięcie 'X' w ustawieniach nie wyłączyło głównego okna AutoX w menedżerze
        uiSettingsWindow.dataset.addonId = "AX_SETTINGS";
        uiSettingsWindow.style.display = currentSettings.settingsWindowVisible ? 'flex' : 'none';

        // --- PODPINANIE EVENTÓW GŁÓWNYCH ---
        const axEnabledCheckbox = uiMainWindow.querySelector("#ax-enabled-checkbox");
        const axLevelRangeInput = uiMainWindow.querySelector("#ax-level-range-input");
        const axFastfightCheckbox = uiMainWindow.querySelector("#ax-fastfight-checkbox");

        axEnabledCheckbox.addEventListener('click', () => {
            currentSettings.enabled = axEnabledCheckbox.classList.toggle('active');
            saveSettings();
        });

        axLevelRangeInput.addEventListener('change', () => {
            if (parseLevelRange(axLevelRangeInput.value)) {
                currentSettings.levelRange = axLevelRangeInput.value;
                saveSettings();
            } else {
                axLevelRangeInput.value = currentSettings.levelRange;
                if (window.message) message("Błędna wartość. Format: min-max");
            }
        });

        axFastfightCheckbox.addEventListener('click', () => {
            currentSettings.fastFight = axFastfightCheckbox.classList.toggle('active');
            saveSettings();
        });

        // --- PODPINANIE EVENTÓW USTAWIEŃ ---
        const bindCheck = (id, key, toggleDiv = null) => {
            const cb = uiSettingsWindow.querySelector(id);
            if (!cb) return;
            cb.addEventListener('click', () => {
                currentSettings[key] = cb.classList.toggle('active');
                if (toggleDiv) uiSettingsWindow.querySelector(toggleDiv).style.display = currentSettings[key] ? 'flex' : 'none';
                saveSettings();
            });
        };

        bindCheck("#ax-attack-friends", "attackFriends");
        bindCheck("#ax-attack-clan", "attackClan");
        bindCheck("#ax-enable-clan-opts", "enableClanOptions", "#ax-clan-options");
        bindCheck("#ax-enable-nick-opts", "enableNickOptions", "#ax-nick-options");
        bindCheck("#ax-enable-hotkey", "enableAttackHotkey", "#ax-hotkey-options");
        bindCheck("#ax-only-hotkey", "onlyHotkeyAttack");

        const bindText = (id, key) => {
            const ta = uiSettingsWindow.querySelector(id);
            if (!ta) return;
            ta.addEventListener('change', () => {
                currentSettings[key] = ta.value;
                saveSettings();
                parseAllLists();
            });
        };

        bindText("#ax-ignore-clans", "ignoreClans");
        bindText("#ax-always-clans", "alwaysAttackClans");
        bindText("#ax-ignore-nicks", "ignoreNicks");

        const hotkeyInput = uiSettingsWindow.querySelector("#ax-hotkey-input");
        hotkeyInput.addEventListener('click', () => {
            isAwaitingKey = true;
            hotkeyInput.classList.add('active-keybind-mode');
            hotkeyInput.focus();
        });

        // Specjalne ukrywanie okna ustawień (aby zapamiętać jego stan)
        uiSettingsWindow.querySelector('.baddonz-close-button').addEventListener('click', () => {
            currentSettings.settingsWindowVisible = false;
            saveSettings();
        });
    }

    // --- CYKL ŻYCIA DODATKU ---
    function addonInit() {
        loadSettings();
        
        if (typeof Engine.battle.setEndBattle === 'function' && !Engine.battle.__axPatched) {
            const originalSetEndBattle = Engine.battle.setEndBattle.bind(Engine.battle);
            Engine.battle.setEndBattle = function() {
                originalSetEndBattle();
                fastFightSent = false;
            };
            Engine.battle.__axPatched = true;
        }

        if (!uiMainWindow) {
            buildUI();
            document.addEventListener('keydown', handleKeyDown);
            
            emitter.observe(window.Engine.communication, 'parseJSON', data => {
                if (data && (data.o || data.h || data.f)) {
                    if (currentSettings.enabled && notInBattle()) handleAutoXLogic();
                }
            });
        }
        
        trackInterval = setInterval(() => { if (currentSettings.enabled && notInBattle()) handleAutoXLogic(); }, 200);
        fastFightInterval = setInterval(() => handleFastFight(), 200);
    }

    function addonStop() {
        if (trackInterval) clearInterval(trackInterval);
        if (fastFightInterval) clearInterval(fastFightInterval);
        trackInterval = null;
        fastFightInterval = null;

        if (uiMainWindow) { uiMainWindow.remove(); uiMainWindow = null; }
        if (uiSettingsWindow) { uiSettingsWindow.remove(); uiSettingsWindow = null; }
        document.removeEventListener('keydown', handleKeyDown);
    }

    function onStateToggle(isEnabled) {
        currentSettings.enabled = isEnabled;
        if (uiMainWindow) {
            const cb = uiMainWindow.querySelector("#ax-enabled-checkbox");
            if (cb) isEnabled ? cb.classList.add('active') : cb.classList.remove('active');
        }
    }

    const checkApi = () => {
        if (!window.BaddonzAPI || !window.BaddonzAPI.registerAddon) {
            setTimeout(checkApi, 500); return;
        }
        window.BaddonzAPI.registerAddon(ADDON_ID, { 
            init: addonInit, 
            stop: addonStop,
            onStateToggle: onStateToggle
        });
    };
    
    checkApi();

})();
