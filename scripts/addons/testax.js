// ==UserScript==
// @name          AutoX baddonz
// @version       05.08.2025
// @description   autox
// @author        besiak
// @match         https://*.margonem.pl/*
// @grant         none
// ==/UserScript==

(function() {
    'use strict';

    const ADDON_ID = "AX";
    
    // ZACHOWANE SPECJALNE STYLE TYLKO DLA AUTOX
    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.id = "autox-custom-styles";
    styleSheet.innerText = `
        #baddonz-ax-wnd { width:110px; min-width:110px; }
        #baddonz-ax-wnd-settings { width:250px; min-width:250px; }
        #baddonz-ax-wnd .baddonz-window-body { padding:0 5px 5px 5px; gap:5px; }
        #ax-s-walka-btn { width:100%; }
        .baddonz-setting-row.ax-main-row { gap:5px; margin: 0; }
        .baddonz-input.ax-small { width:100%; max-width:79px; font-size:11px; height:20px !important; line-height:18px; text-align:center; padding:1px 0px; }
        #baddonz-ax-wnd-settings .baddonz-input { text-align:center; height:26px !important; }
        .baddonz-input.ax-hotkey { width:100%; padding:1px 5px; font-size:14px; height:22px !important; line-height:20px; caret-color:transparent; }
        .baddonz-setting-row span { white-space:nowrap; font-size:11px; }
    `;
    if (!document.getElementById("autox-custom-styles")) document.head.appendChild(styleSheet);

    // BAZA USTAWIEŃ
    let currentSettings = {
        enabled: true,
        windowOpacity: 2,
        windowVisible: true,
        settingsWindowVisible: false,
        windowSettingsOpacity: 2,
        isExpanded: false,
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
    let BADDONZ_FAST_FIGHT_SENT = false;
    let BADDONZ_FAST_FIGHT_INTERVAL = null;
    let BADDONZ_TRACK_INTERVAL = null;
    let isEngineObserved = false;
    let isEndBattleHooked = false;
    let isAwaitingKey = false;
    let isKeyDownBound = false;
    let parsedLevelRange = { min: 0, max: 500 };

    class Emitter {
        constructor() { this.events = {}; }
        on(event, listener) { if (typeof this.events[event] !== 'object') this.events[event] = []; this.events[event].push(listener); return () => this.off(event, listener); }
        off(event, listener) { if (typeof this.events[event] === 'object') { const idx = this.events[event].indexOf(listener); if (idx > -1) this.events[event].splice(idx, 1); } }
        emit(event, ...args) { if (typeof this.events[event] === 'object') this.events[event].forEach(listener => listener.apply(this, args)); }
        observe(obj, key, callback) { const originalFunction = obj[key]; const originalContext = obj; obj[key] = (...args) => { callback.apply(this, args); return originalFunction.apply(originalContext, args); }; }
    }
    const emitter = new Emitter();

    // --- FUNKCJE POMOCNICZE I LOGIKA ---
    function loadSettings() {
        if (window.BaddonzAPI) currentSettings = { ...currentSettings, ...window.BaddonzAPI.getAddonSettings(ADDON_ID) };
        parsedLevelRange = parseLevelRange(currentSettings.levelRange) || { min: 0, max: 500 };
    }

    function saveSettings() {
        if (window.BaddonzAPI) window.BaddonzAPI.saveAddonSettings(ADDON_ID, currentSettings);
    }

    function parseLevelRange(str) {
        const match = str.match(/^(\d+)-(\d+)$/);
        if (!match) return null;
        const min = parseInt(match[1]), max = parseInt(match[2]);
        return min > max ? null : { min, max };
    }

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
        if (map.pvp === 2 || ['Mapa testerów'].includes(map.name)) return true;
        return false;
    }

    function isEnemy(other) {
        const map = Engine?.map?.d;
        if (!other || typeof other.relation !== 'number') return false;
        if (Engine.party?.d && Array.isArray(Engine.party.d) && Engine.party.d.some(p => p.id === other.id)) return false;

        const ignoreNicksList = currentSettings.ignoreNicks.split(',').map(s => s.trim()).filter(Boolean);
        if (currentSettings.enableNickOptions && ignoreNicksList.includes(other.nick)) return false;

        let otherClanId = other.clan && typeof other.clan === 'object' ? other.clan.id : null;
        let otherClanName = other.clan && (typeof other.clan === 'object' ? other.clan.name : other.clan);
        
        const ignoreClansList = currentSettings.ignoreClans.split(',').map(s => s.trim()).filter(Boolean);
        const alwaysAttackClansList = currentSettings.alwaysAttackClans.split(',').map(s => s.trim()).filter(Boolean);

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
        return getOthers().filter(other => isEnemy(other) && !other.inBattle && other.lvl >= parsedLevelRange.min && other.lvl <= parsedLevelRange.max && checkTargetProtection(other));
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

    let BADDONZ_LAST_ATTACK = 0;
    function attack(target, distance) {
        if (Date.now() - BADDONZ_LAST_ATTACK < 300) return false;
        if (distance <= 3) {
            _g('fight&a=attack&id=' + target.id);
            BADDONZ_LAST_ATTACK = Date.now();
            return true;
        }
        return false;
    }

    function hotkeyAttackAction() {
        if (!currentSettings.enabled || !notInBattle()) return;
        const map = Engine?.map?.d;
        if (!map || !isMapValidForAttack(map)) return;

        const closestTargetWithDistance = getClosestTarget();
        if (closestTargetWithDistance) {
            attack(closestTargetWithDistance.target, closestTargetWithDistance.distance);
        }
    }

    function handleAutoXLogic() {
        const map = Engine?.map?.d;
        if (!map || !isMapValidForAttack(map)) return;

        if (currentSettings.onlyHotkeyAttack) return; // Jeśli zaznaczone, auto atakowanie nic nie robi

        const closestTargetWithDistance = getClosestTarget();
        if (closestTargetWithDistance) {
            attack(closestTargetWithDistance.target, closestTargetWithDistance.distance);
        }
    }

    function handleFastFight() {
        if (Engine?.battle?.show && !Engine?.battle?.endBattle) {
            if (currentSettings.fastFight && !BADDONZ_FAST_FIGHT_SENT) {
                _g('fight&a=f');
                BADDONZ_FAST_FIGHT_SENT = true;
            }
        }
    }

    function handleKeyDown(event) {
        if (isAwaitingKey) {
            event.preventDefault(); event.stopPropagation();
            if (['control', 'shift', 'alt', 'meta', 'escape', 'enter', 'tab'].includes(event.key.toLowerCase())) return;
            const key = event.key.toLowerCase();
            currentSettings.hotkeyAttackKey = key;
            saveSettings();
            
            const axHotkeyInput = uiSettingsWindow.querySelector("#ax-hotkey-attack-input");
            if (axHotkeyInput) {
                axHotkeyInput.value = key.toUpperCase();
                axHotkeyInput.blur();
            }
            return;
        }
        if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
        if (currentSettings.enabled && currentSettings.enableAttackHotkey && event.key.toLowerCase() === currentSettings.hotkeyAttackKey.toLowerCase()) {
            hotkeyAttackAction();
            event.preventDefault();
        }
    }

    // --- BUDOWANIE INTERFEJSU (BADDONZ API) ---
    function buildUI() {
        // 1. GŁÓWNE OKNO (Małe)
        const mainBodyHtml = `
            <div class="baddonz-setting-row ax-main-row">
                <div class="baddonz-checkbox ${currentSettings.enabled ? 'active' : ''}" id="ax-enabled-checkbox"></div>
                <input type="text" class="baddonz-input ax-small" id="ax-level-range-input" value="${currentSettings.levelRange}">
            </div>
            <div id="ax-expanded-controls" style="display: ${currentSettings.isExpanded ? 'flex' : 'none'}; flex-direction: column; margin-top: 5px;">
                <button class="baddonz-button ${currentSettings.fastFight ? 'active' : ''}" id="ax-s-walka-btn">S.WALKA</button>
            </div>
        `;
        uiMainWindow = window.BaddonzAPI.createAddonWindow(ADDON_ID, "autox", mainBodyHtml, { width: '110px', customId: 'baddonz-ax-wnd' });

        // PRZEBUDOWA NAGŁÓWKA: Wstawiamy trybik ustawień i zwijanie zamiast domyślnego zamykania (X)
        const mainLeftControls = uiMainWindow.querySelector('.baddonz-window-controls.left');
        mainLeftControls.insertAdjacentHTML('beforeend', '<div class="baddonz-icon baddonz-settings-button" id="ax-settings-btn" title="Ustawienia"></div>');
        
        const mainRightControls = uiMainWindow.querySelector('.baddonz-window-controls.right');
        mainRightControls.innerHTML = '<div class="baddonz-icon baddonz-collapsed" id="ax-collapsed-btn" title="Zwiń/Rozwiń okno"></div>';

        // 2. OKNO USTAWIEŃ
        const settingsBodyHtml = `
            <div class="baddonz-scroll" style="display:flex; flex-direction:column; overflow-y:auto; overflow-x:hidden; max-height:300px; padding-right:5px;">
                <button class="baddonz-button" style="width:100%; margin-bottom: 5px;" id="ax-reset-pos-btn">Resetuj Pozycje Ustawień</button>
                
                <div class="baddonz-setting-row"><div class="baddonz-checkbox ${currentSettings.attackFriends ? 'active' : ''}" id="ax-attack-friends-checkbox"></div><span>Atakuj Przyjaciół</span></div>
                <div class="baddonz-setting-row"><div class="baddonz-checkbox ${currentSettings.attackClan ? 'active' : ''}" id="ax-attack-clan-checkbox"></div><span>Atakuj Klan/Sojusz</span></div>
                
                <hr style="width: 100%; border-color: #303030; margin: 5px 0;">
                <div class="baddonz-setting-row"><div class="baddonz-checkbox ${currentSettings.enableClanOptions ? 'active' : ''}" id="ax-enable-clan-options-checkbox"></div><span>Kryteria Klanowe</span></div>
                <div id="ax-clan-options" style="display: ${currentSettings.enableClanOptions ? 'flex' : 'none'}; flex-direction:column; gap:5px;">
                    <span class="baddonz-text" style="padding:0;">Nie atakuj klanów:</span>
                    <textarea class="baddonz-textarea" id="ax-ignore-clans-textarea" placeholder="Nazwa klanu, ID">${currentSettings.ignoreClans}</textarea>
                    <span class="baddonz-text" style="padding:0;">Zawsze atakuj klany:</span>
                    <textarea class="baddonz-textarea" id="ax-always-attack-clans-textarea" placeholder="Nazwa klanu, ID">${currentSettings.alwaysAttackClans}</textarea>
                </div>

                <hr style="width: 100%; border-color: #303030; margin: 5px 0;">
                <div class="baddonz-setting-row"><div class="baddonz-checkbox ${currentSettings.enableNickOptions ? 'active' : ''}" id="ax-enable-nick-options-checkbox"></div><span>Po nickach</span></div>
                <div id="ax-nick-options" style="display: ${currentSettings.enableNickOptions ? 'flex' : 'none'}; flex-direction:column; gap:5px;">
                    <span class="baddonz-text" style="padding:0;">Nie atakuj graczy:</span>
                    <textarea class="baddonz-textarea" id="ax-ignore-nicks-textarea" placeholder="Nick1, Nick2">${currentSettings.ignoreNicks}</textarea>
                </div>

                <hr style="width: 100%; border-color: #303030; margin: 5px 0;">
                <div class="baddonz-setting-row"><div class="baddonz-checkbox ${currentSettings.enableAttackHotkey ? 'active' : ''}" id="ax-enable-attack-hotkey-checkbox"></div><span>Skrót Ataku</span></div>
                <div id="ax-hotkey-options" style="display: ${currentSettings.enableAttackHotkey ? 'flex' : 'none'}; flex-direction:column; gap:5px;">
                    <input type="text" class="baddonz-input keybind ax-hotkey" id="ax-hotkey-attack-input" value="${currentSettings.hotkeyAttackKey.toUpperCase()}" placeholder="Klawisz">
                    <div class="baddonz-setting-row" style="margin-top:5px;">
                        <div class="baddonz-checkbox ${currentSettings.onlyHotkeyAttack ? 'active' : ''}" id="ax-only-hotkey-attack-checkbox"></div>
                        <span>Atakowanie tylko skrótem</span>
                    </div>
                </div>
            </div>
        `;
        uiSettingsWindow = window.BaddonzAPI.createAddonWindow(ADDON_ID, "AutoX Ustawienia", settingsBodyHtml, { width: '250px', customId: 'baddonz-ax-wnd-settings' });
        
        // Zabezpieczenie, żeby ustawienia nie reagowały na "pokaż/ukryj" z głównego Docka i miały własną widoczność
        uiSettingsWindow.removeAttribute('data-addon-id');
        uiSettingsWindow.style.display = currentSettings.settingsWindowVisible ? 'flex' : 'none';
        
        // Przywrócenie własnej (innej) przezroczystości dla okna ustawień (Jeśli nie ma zunifikowanej)
        const isUnified = localStorage.getItem('BaddonzData') && JSON.parse(localStorage.getItem('BaddonzData'))[window.BaddonzAPI.accountId]?.manager?.unifiedOpacityEnabled;
        if (!isUnified) {
            uiSettingsWindow.className = uiSettingsWindow.className.replace(/opacity-\d/, `opacity-${currentSettings.windowSettingsOpacity}`);
        }

        // === EVENTY GŁÓWNEGO OKNA ===
        const axEnabledCheckbox = uiMainWindow.querySelector("#ax-enabled-checkbox");
        const axLevelRangeInput = uiMainWindow.querySelector("#ax-level-range-input");
        const axCollapsedBtn = uiMainWindow.querySelector("#ax-collapsed-btn");
        const axSettingsBtn = uiMainWindow.querySelector("#ax-settings-btn");
        const axSWalkaBtn = uiMainWindow.querySelector("#ax-s-walka-btn");
        const axExpandedControls = uiMainWindow.querySelector("#ax-expanded-controls");

        axEnabledCheckbox.addEventListener('click', () => {
            currentSettings.enabled = axEnabledCheckbox.classList.toggle('active');
            saveSettings();
        });

        axLevelRangeInput.addEventListener('change', () => {
            const parsed = parseLevelRange(axLevelRangeInput.value);
            if (parsed) {
                currentSettings.levelRange = axLevelRangeInput.value;
                parsedLevelRange = parsed;
                saveSettings();
            } else {
                axLevelRangeInput.value = currentSettings.levelRange;
                if (window.message) message("Błędna wartość lvl. Format: min-max");
                else if (window._g) _g('message|Błędna wartość lvl. Format: min-max');
            }
        });

        axCollapsedBtn.addEventListener('click', () => {
            currentSettings.isExpanded = !currentSettings.isExpanded;
            axExpandedControls.style.display = currentSettings.isExpanded ? 'flex' : 'none';
            saveSettings();
        });

        axSettingsBtn.addEventListener('click', () => {
            const isVisible = uiSettingsWindow.style.display !== 'none';
            uiSettingsWindow.style.display = isVisible ? 'none' : 'flex';
            currentSettings.settingsWindowVisible = !isVisible;
            saveSettings();
        });

        axSWalkaBtn.addEventListener('click', () => {
            currentSettings.fastFight = axSWalkaBtn.classList.toggle('active');
            saveSettings();
        });

        // === EVENTY OKNA USTAWIEŃ ===
        uiSettingsWindow.querySelector('.baddonz-close-button').addEventListener('click', () => {
            currentSettings.settingsWindowVisible = false;
            saveSettings();
        });

        uiSettingsWindow.querySelector('.baddonz-opacity-button').addEventListener('click', () => {
            if (isUnified) return; // Zablokowane jeśli wymuszono jedną przezroczystość z baddonz
            uiSettingsWindow.classList.remove(`opacity-${currentSettings.windowSettingsOpacity}`);
            currentSettings.windowSettingsOpacity = (currentSettings.windowSettingsOpacity + 1) % 5;
            uiSettingsWindow.classList.add(`opacity-${currentSettings.windowSettingsOpacity}`);
            saveSettings();
        });

        uiSettingsWindow.querySelector("#ax-reset-pos-btn").addEventListener('click', () => {
            uiSettingsWindow.style.left = '0px'; 
            uiSettingsWindow.style.top = '0px';
            // Symulacja wymuszenia zapisu w globalnym menedżerze
            let data = JSON.parse(localStorage.getItem('BaddonzData')) || {};
            if(data[window.BaddonzAPI.accountId] && data[window.BaddonzAPI.accountId].manager) {
                data[window.BaddonzAPI.accountId].manager.positions['baddonz-ax-wnd-settings'] = { left: '0px', top: '0px' };
                localStorage.setItem('BaddonzData', JSON.stringify(data));
            }
        });

        const chbAttFriends = uiSettingsWindow.querySelector("#ax-attack-friends-checkbox");
        chbAttFriends.addEventListener('click', () => { currentSettings.attackFriends = chbAttFriends.classList.toggle('active'); saveSettings(); });

        const chbAttClan = uiSettingsWindow.querySelector("#ax-attack-clan-checkbox");
        chbAttClan.addEventListener('click', () => { currentSettings.attackClan = chbAttClan.classList.toggle('active'); saveSettings(); });

        const chbClanOpt = uiSettingsWindow.querySelector("#ax-enable-clan-options-checkbox");
        const divClanOpt = uiSettingsWindow.querySelector("#ax-clan-options");
        chbClanOpt.addEventListener('click', () => { currentSettings.enableClanOptions = chbClanOpt.classList.toggle('active'); divClanOpt.style.display = currentSettings.enableClanOptions ? 'flex' : 'none'; saveSettings(); });

        uiSettingsWindow.querySelector("#ax-ignore-clans-textarea").addEventListener('change', (e) => { currentSettings.ignoreClans = e.target.value; saveSettings(); });
        uiSettingsWindow.querySelector("#ax-always-attack-clans-textarea").addEventListener('change', (e) => { currentSettings.alwaysAttackClans = e.target.value; saveSettings(); });

        const chbNickOpt = uiSettingsWindow.querySelector("#ax-enable-nick-options-checkbox");
        const divNickOpt = uiSettingsWindow.querySelector("#ax-nick-options");
        chbNickOpt.addEventListener('click', () => { currentSettings.enableNickOptions = chbNickOpt.classList.toggle('active'); divNickOpt.style.display = currentSettings.enableNickOptions ? 'flex' : 'none'; saveSettings(); });

        uiSettingsWindow.querySelector("#ax-ignore-nicks-textarea").addEventListener('change', (e) => { currentSettings.ignoreNicks = e.target.value; saveSettings(); });

        const chbHotkeyOpt = uiSettingsWindow.querySelector("#ax-enable-attack-hotkey-checkbox");
        const divHotkeyOpt = uiSettingsWindow.querySelector("#ax-hotkey-options");
        chbHotkeyOpt.addEventListener('click', () => { currentSettings.enableAttackHotkey = chbHotkeyOpt.classList.toggle('active'); divHotkeyOpt.style.display = currentSettings.enableAttackHotkey ? 'flex' : 'none'; saveSettings(); });

        const axHotkeyInput = uiSettingsWindow.querySelector("#ax-hotkey-attack-input");
        axHotkeyInput.addEventListener('click', () => { isAwaitingKey = true; axHotkeyInput.classList.add('active-keybind-mode'); axHotkeyInput.focus(); });
        axHotkeyInput.addEventListener('blur', () => { isAwaitingKey = false; axHotkeyInput.classList.remove('active-keybind-mode'); });

        const chbOnlyHotkey = uiSettingsWindow.querySelector("#ax-only-hotkey-attack-checkbox");
        chbOnlyHotkey.addEventListener('click', () => { currentSettings.onlyHotkeyAttack = chbOnlyHotkey.classList.toggle('active'); saveSettings(); });
    }

    // --- CYKL ŻYCIA DODATKU ---
    function addonInit() {
        loadSettings();
        if (!uiMainWindow) buildUI();

        if (!isEngineObserved) {
            if (window.Engine && window.Engine.communication) {
                emitter.observe(window.Engine.communication, 'parseJSON', data => {
                    if (data && (data.o || data.h || data.f)) {
                        if (currentSettings.enabled && notInBattle()) handleAutoXLogic();
                    }
                });
                isEngineObserved = true;
            }
        }

        if (!isEndBattleHooked && typeof Engine?.battle?.setEndBattle === 'function') {
            const originalSetEndBattle = Engine.battle.setEndBattle.bind(Engine.battle);
            Engine.battle.setEndBattle = function() { originalSetEndBattle(); BADDONZ_FAST_FIGHT_SENT = false; };
            isEndBattleHooked = true;
        }

        if (!isKeyDownBound) {
            document.addEventListener('keydown', handleKeyDown);
            isKeyDownBound = true;
        }

        BADDONZ_FAST_FIGHT_INTERVAL = setInterval(() => { if (currentSettings.fastFight) handleFastFight(); }, 200);
        BADDONZ_TRACK_INTERVAL = setInterval(() => { if (currentSettings.enabled && notInBattle()) handleAutoXLogic(); }, 200);
    }

    function addonStop() {
        if (BADDONZ_FAST_FIGHT_INTERVAL) clearInterval(BADDONZ_FAST_FIGHT_INTERVAL);
        if (BADDONZ_TRACK_INTERVAL) clearInterval(BADDONZ_TRACK_INTERVAL);
        BADDONZ_FAST_FIGHT_INTERVAL = null;
        BADDONZ_TRACK_INTERVAL = null;

        if (isKeyDownBound) {
            document.removeEventListener('keydown', handleKeyDown);
            isKeyDownBound = false;
        }

        if (uiMainWindow) { uiMainWindow.remove(); uiMainWindow = null; }
        if (uiSettingsWindow) { uiSettingsWindow.remove(); uiSettingsWindow = null; }
    }

    function onStateToggle(isEnabled) {
        currentSettings.enabled = isEnabled;
        if (uiMainWindow) {
            const axEnabledCheckbox = uiMainWindow.querySelector("#ax-enabled-checkbox");
            if (axEnabledCheckbox) {
                if (isEnabled) axEnabledCheckbox.classList.add('active');
                else axEnabledCheckbox.classList.remove('active');
            }
        }
    }

    const checkApi = () => {
        if (!window.BaddonzAPI || !window.BaddonzAPI.registerAddon) {
            setTimeout(checkApi, 500); return;
        }
        window.BaddonzAPI.registerAddon(ADDON_ID, { init: addonInit, stop: addonStop, onStateToggle: onStateToggle });
    };
    checkApi();

})();
