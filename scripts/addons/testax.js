// ==UserScript==
// @name          AutoX baddonz
// @version       02.06.2026
// @description   autox
// @author        besiak
// @match         https://*.margonem.pl/*
// @grant         none
// ==/UserScript==

(function() {
    'use strict';

    const ADDON_ID = "AX";
    
    let currentSettings = {
        enabled: true,
        windowOpacity: 2,
        windowVisible: true,
        settingsWindowVisible: false,
        windowSettingsOpacity: 2,
        isExpanded: false,
        fastFight: false,
        attackFriends: false,
        attackClan: false,
        enableClanOptions: true,
        ignoreClans: "692,164,3,1517,256,58,1386,1504,1925,1757,758,2230,27,2141,10,1807,1029,2274,1459,1071,9,1829,516,2302,71,622,2761",
        alwaysAttackClans: "",
        levelRange: "0-500",
        enableNickOptions: false,
        ignoreNicks: "",
        alwaysAttackNicks: ""
    };

    let uiMainWindow = null;
    let uiSettingsWindow = null;
    let BADDONZ_FAST_FIGHT_SENT = false;
    let BADDONZ_FAST_FIGHT_INTERVAL = null;
    let BADDONZ_TRACK_INTERVAL = null;
    let isEngineObserved = false;
    let isEndBattleHooked = false;
    let parsedLevelRange = { min: 0, max: 500 };

    class Emitter {
        constructor() { this.events = {}; }
        on(event, listener) { if (typeof this.events[event] !== 'object') this.events[event] = []; this.events[event].push(listener); return () => this.off(event, listener); }
        off(event, listener) { if (typeof this.events[event] === 'object') { const idx = this.events[event].indexOf(listener); if (idx > -1) this.events[event].splice(idx, 1); } }
        emit(event, ...args) { if (typeof this.events[event] === 'object') this.events[event].forEach(listener => listener.apply(this, args)); }
        observe(obj, key, callback) { const originalFunction = obj[key]; const originalContext = obj; obj[key] = (...args) => { callback.apply(this, args); return originalFunction.apply(originalContext, args); }; }
    }
    const emitter = new Emitter();

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
        parsedLevelRange = parseLevelRange(currentSettings.levelRange) || { min: 0, max: 500 };
    }

    function saveSettings() {
        if (!window.BaddonzAPI) return;
        const accId = window.BaddonzAPI.accountId;

        const accKeys = ['enabled', 'windowOpacity', 'windowVisible', 'settingsWindowVisible', 'windowSettingsOpacity', 'isExpanded', 'fastFight', 'attackFriends', 'attackClan', 'enableClanOptions', 'ignoreClans', 'alwaysAttackClans'];
        const charKeys = ['levelRange', 'enableNickOptions', 'ignoreNicks', 'alwaysAttackNicks'];

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

    function parseLevelRange(str) {
        const match = str.match(/^(\d+)-(\d+)$/);
        if (!match) return null;
        const min = parseInt(match[1]), max = parseInt(match[2]);
        return min > max ? null : { min, max };
    }

    function notInBattle() { 
        return window.Engine && window.Engine.battle && !window.Engine.battle.show;
    }
    
    function getOthers() { 
        if (!window.Engine || !window.Engine.others) return [];
        return window.Engine.others.getDrawableList().map(o => o.d); 
    }

    function checkTargetProtection(other) {
        if (!window.Engine.others.getById(other.id)) return true;
        const otherObj = window.Engine.others.getById(other.id);
        const emoList = typeof otherObj.getOnSelfEmoList === 'function' ? otherObj.getOnSelfEmoList() : [];
        if (!emoList || emoList.length === 0) return true;
        return !emoList.some(e => e && ['battle', 'pvpprotected'].includes(e.name));
    }

    function checkSelfProtection() {
        const hero = window.Engine.hero;
        if (!hero) return false;
        const emoList = typeof hero.getOnSelfEmoList === 'function' ? hero.getOnSelfEmoList() : [];
        if (!emoList || emoList.length === 0) return false;
        return emoList.some(e => e && e.name === 'pvpprotected');
    }

    function isMapValidForAttack(map) {
        if (!map) return false;
        if (map.pvp === 2) return true; 
        if (['Mapa testerów', 'Polana ekwipunku'].includes(map.name)) return true;
        return false;
    }

    function isInParty(otherId) {
        if (!window.Engine || !window.Engine.party) return false;
        let members = null;
        if (typeof window.Engine.party.getMembers === 'function') {
            members = window.Engine.party.getMembers();
        } else if (window.Engine.party.d) {
            members = window.Engine.party.d;
        }

        if (!members) return false;
        if (members instanceof Map) {
            return members.has(otherId) || members.has(Number(otherId));
        } else if (Array.isArray(members)) {
            return members.some(p => p.id === otherId);
        } else if (typeof members === 'object') {
            return !!members[otherId];
        }
        return false;
    }

    function isEnemy(other) {
        if (!other || typeof other.relation !== 'number') return false;
        if (isInParty(other)) return false;

        const lowerNick = other.nick.toLowerCase();
        const alwaysAttackNicksList = currentSettings.alwaysAttackNicks.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
        const ignoreNicksList = currentSettings.ignoreNicks.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
        if (currentSettings.enableNickOptions) {
            if (alwaysAttackNicksList.includes(lowerNick)) return true;
            if (ignoreNicksList.includes(lowerNick)) return false;
        }

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

        if ([1, 3, 6, 8].includes(other.relation)) return true;
        if (other.relation === 2 && currentSettings.attackFriends) return true;
        if ([4, 5, 7].includes(other.relation) && currentSettings.attackClan) return true;

        return false;
    }

    function getValidTargets() {
        if (checkSelfProtection()) return [];
        const map = window.Engine?.map?.d;
        if (!map || !isMapValidForAttack(map)) return [];
        return getOthers()
            .filter(other => other && !other.inBattle)
            .filter(other => other.lvl >= parsedLevelRange.min && other.lvl <= parsedLevelRange.max)
            .filter(other => checkTargetProtection(other))
            .filter(other => isEnemy(other));
    }

    function getClosestTarget() {
        const hero = window.Engine.hero.d;
        const targets = getValidTargets();
        if (!targets.length) return null;

        const hx = typeof hero.rx !== 'undefined' ? hero.rx : hero.x;
        const hy = typeof hero.ry !== 'undefined' ? hero.ry : hero.y;
        const targetsWithDistance = targets.map(other => {
            const ox = typeof other.rx !== 'undefined' ? other.rx : other.x;
            const oy = typeof other.ry !== 'undefined' ? other.ry : other.y;
            return {
                target: other,
                distance: Math.hypot(hx - ox, hy - oy)
            };
        });
        targetsWithDistance.sort((a, b) => a.distance - b.distance);
        return targetsWithDistance[0]; 
    }

    let BADDONZ_LAST_ATTACK = 0;
    function attack(target, distance) {
        if (Date.now() - BADDONZ_LAST_ATTACK < 300) return false;
        if (distance <= 3.85) {
            window._g('fight&a=attack&id=' + target.id);
            BADDONZ_LAST_ATTACK = Date.now();
            return true;
        }
        return false;
    }

    function handleAutoXLogic() {
        const closestTargetWithDistance = getClosestTarget();
        if (closestTargetWithDistance) {
            attack(closestTargetWithDistance.target, closestTargetWithDistance.distance);
        }
    }

    function handleFastFight() {
        if (window.Engine?.battle?.show && !window.Engine?.battle?.endBattle) {
            if (currentSettings.fastFight && !BADDONZ_FAST_FIGHT_SENT) {
                window._g('fight&a=f');
                BADDONZ_FAST_FIGHT_SENT = true;
            }
        }
    }

    function buildUI() {
        const mainBodyHtml = `
            <div class="baddonz-setting-row ax-main-row">
                <div class="baddonz-checkbox ax-enabled-checkbox ${currentSettings.enabled ? 'active' : ''}"></div>
                <input type="text" class="baddonz-input ax-small ax-level-range-input" value="${currentSettings.levelRange}">
            </div>
            <div class="ax-expanded-controls" style="display: ${currentSettings.isExpanded ? 'flex' : 'none'}; flex-direction: column; margin-top: 2px;">
                <button class="baddonz-button ax-s-walka-btn ${currentSettings.fastFight ? 'active' : ''}">S.WALKA</button>
            </div>
        `;
        uiMainWindow = window.BaddonzAPI.createAddonWindow(ADDON_ID, "autox", mainBodyHtml, { 
            width: '110px', 
            customId: 'baddonz-ax-wnd',
            hasSettings: true,
            hasCollapse: true,
            hasClose: false
        });
        const settingsBodyHtml = `
            <button class="baddonz-button ax-reset-pos-btn" style="width:100%; margin-bottom: 5px;">Resetuj pozycje okienka</button>
            
            <div class="baddonz-setting-row"><div class="baddonz-checkbox ax-attack-friends-checkbox ${currentSettings.attackFriends ? 'active' : ''}"></div><span>Atakuj Przyjaciół</span></div>
            <div class="baddonz-setting-row"><div class="baddonz-checkbox ax-attack-clan-checkbox ${currentSettings.attackClan ? 'active' : ''}"></div><span>Atakuj Klan/Sojusz</span></div>
            
            <hr style="width: 100%; border-color: #303030; margin: 5px 0;">
            <div class="baddonz-setting-row"><div class="baddonz-checkbox ax-enable-clan-options-checkbox ${currentSettings.enableClanOptions ? 'active' : ''}"></div><span>Kryteria Klanowe</span></div>
            <div class="ax-clan-options" style="display: ${currentSettings.enableClanOptions ? 'flex' : 'none'}; flex-direction:column; gap:5px;">
                <span class="baddonz-text" style="padding:0;">Nigdy nie atakuj klanów:</span>
                <textarea class="baddonz-textarea baddonz-scroll ax-ignore-clans-textarea" placeholder="Nazwa klanu, ID">${currentSettings.ignoreClans}</textarea>
                <span class="baddonz-text" style="padding:0;">Zawsze atakuj klany:</span>
                <textarea class="baddonz-textarea baddonz-scroll ax-always-attack-clans-textarea" placeholder="Nazwa klanu, ID">${currentSettings.alwaysAttackClans}</textarea>
            </div>

            <hr style="width: 100%; border-color: #303030; margin: 5px 0;">
            <div class="baddonz-setting-row"><div class="baddonz-checkbox ax-enable-nick-options-checkbox ${currentSettings.enableNickOptions ? 'active' : ''}"></div><span>Po nickach</span></div>
            <div class="ax-nick-options" style="display: ${currentSettings.enableNickOptions ? 'flex' : 'none'}; flex-direction:column; gap:5px;">
                <span class="baddonz-text" style="padding:0;">Nigdy nie atakuj:</span>
                <textarea class="baddonz-textarea baddonz-scroll ax-ignore-nicks-textarea" placeholder="Nick1, Nick2">${currentSettings.ignoreNicks}</textarea>
                <span class="baddonz-text" style="padding:0;">Zawsze atakuj:</span>
                <textarea class="baddonz-textarea baddonz-scroll ax-always-attack-nicks-textarea" placeholder="Nick1, Nick2">${currentSettings.alwaysAttackNicks}</textarea>
            </div>
        `;
        uiSettingsWindow = window.BaddonzAPI.createAddonWindow(ADDON_ID, "AutoX Ustawienia", settingsBodyHtml, { width: '250px', customId: 'baddonz-ax-wnd-settings' });
        
        uiSettingsWindow.classList.add('settings-window');
        uiSettingsWindow.removeAttribute('data-addon-id');
        uiSettingsWindow.style.display = currentSettings.settingsWindowVisible ? 'flex' : 'none';
        
        const isUnified = localStorage.getItem('BaddonzData') && JSON.parse(localStorage.getItem('BaddonzData'))[window.BaddonzAPI.accountId]?.manager?.unifiedOpacityEnabled;
        if (!isUnified) {
            uiSettingsWindow.className = uiSettingsWindow.className.replace(/opacity-\d/, `opacity-${currentSettings.windowSettingsOpacity}`);
        }

        const axEnabledCheckbox = uiMainWindow.querySelector(".ax-enabled-checkbox");
        const axLevelRangeInput = uiMainWindow.querySelector(".ax-level-range-input");
        const axCollapsedBtn = uiMainWindow.querySelector(".baddonz-collapsed");
        const axSettingsBtn = uiMainWindow.querySelector(".baddonz-settings-button");
        const axSWalkaBtn = uiMainWindow.querySelector(".ax-s-walka-btn");
        const axExpandedControls = uiMainWindow.querySelector(".ax-expanded-controls");
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
                if (window.message) window.message("Błędna wartość lvl. Format: min-max");
                else if (window._g) window._g('message|Błędna wartość lvl. Format: min-max');
            }
        });
        if (axCollapsedBtn) {
            if (typeof $ === 'function' && typeof $.fn.tip === 'function') {
                $(axCollapsedBtn).tip(currentSettings.isExpanded ? "Zwiń" : "Rozwiń");
            }
            
            axCollapsedBtn.addEventListener('click', () => {
                currentSettings.isExpanded = !currentSettings.isExpanded;
                axExpandedControls.style.display = currentSettings.isExpanded ? 'flex' : 'none';
                
                if (typeof $ === 'function' && typeof $.fn.tip === 'function') {
                    $(axCollapsedBtn).tip(currentSettings.isExpanded ? "Zwiń" : "Rozwiń");
                }
                
                saveSettings();
            });
        }

        if (axSettingsBtn) {
            axSettingsBtn.addEventListener('click', () => {
                const isVisible = uiSettingsWindow.style.display !== 'none';
                uiSettingsWindow.style.display = isVisible ? 'none' : 'flex';
                currentSettings.settingsWindowVisible = !isVisible;
                saveSettings();
            });
        }

        axSWalkaBtn.addEventListener('click', () => {
            currentSettings.fastFight = axSWalkaBtn.classList.toggle('active');
            saveSettings();
        });
        uiSettingsWindow.querySelector('.baddonz-close-button').addEventListener('click', () => {
            currentSettings.settingsWindowVisible = false;
            saveSettings();
        });
        uiSettingsWindow.querySelector('.baddonz-opacity-button').addEventListener('click', () => {
            if (isUnified) return; 
            uiSettingsWindow.classList.remove(`opacity-${currentSettings.windowSettingsOpacity}`);
            currentSettings.windowSettingsOpacity = (currentSettings.windowSettingsOpacity + 1) % 5;
            uiSettingsWindow.classList.add(`opacity-${currentSettings.windowSettingsOpacity}`);
            saveSettings();
        });
        uiSettingsWindow.querySelector(".ax-reset-pos-btn").addEventListener('click', () => {
            if (uiMainWindow) {
                uiMainWindow.style.left = '0px'; 
                uiMainWindow.style.top = '0px';
            }
            let data = JSON.parse(localStorage.getItem('BaddonzData')) || {};
            if(data[window.BaddonzAPI.accountId] && data[window.BaddonzAPI.accountId].manager) {
                data[window.BaddonzAPI.accountId].manager.positions['baddonz-ax-wnd'] = { left: '0px', top: '0px' };
                localStorage.setItem('BaddonzData', JSON.stringify(data));
            }
        });
        const chbAttFriends = uiSettingsWindow.querySelector(".ax-attack-friends-checkbox");
        chbAttFriends.addEventListener('click', () => { currentSettings.attackFriends = chbAttFriends.classList.toggle('active'); saveSettings(); });

        const chbAttClan = uiSettingsWindow.querySelector(".ax-attack-clan-checkbox");
        chbAttClan.addEventListener('click', () => { currentSettings.attackClan = chbAttClan.classList.toggle('active'); saveSettings(); });

        const chbClanOpt = uiSettingsWindow.querySelector(".ax-enable-clan-options-checkbox");
        const divClanOpt = uiSettingsWindow.querySelector(".ax-clan-options");
        chbClanOpt.addEventListener('click', () => { currentSettings.enableClanOptions = chbClanOpt.classList.toggle('active'); divClanOpt.style.display = currentSettings.enableClanOptions ? 'flex' : 'none'; saveSettings(); });
        uiSettingsWindow.querySelector(".ax-ignore-clans-textarea").addEventListener('change', (e) => { currentSettings.ignoreClans = e.target.value; saveSettings(); });
        uiSettingsWindow.querySelector(".ax-always-attack-clans-textarea").addEventListener('change', (e) => { currentSettings.alwaysAttackClans = e.target.value; saveSettings(); });
        const chbNickOpt = uiSettingsWindow.querySelector(".ax-enable-nick-options-checkbox");
        const divNickOpt = uiSettingsWindow.querySelector(".ax-nick-options");
        chbNickOpt.addEventListener('click', () => { currentSettings.enableNickOptions = chbNickOpt.classList.toggle('active'); divNickOpt.style.display = currentSettings.enableNickOptions ? 'flex' : 'none'; saveSettings(); });
        uiSettingsWindow.querySelector(".ax-ignore-nicks-textarea").addEventListener('change', (e) => { currentSettings.ignoreNicks = e.target.value; saveSettings(); });
        uiSettingsWindow.querySelector(".ax-always-attack-nicks-textarea").addEventListener('change', (e) => { currentSettings.alwaysAttackNicks = e.target.value; saveSettings(); });
    }

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

        if (!isEndBattleHooked && typeof window.Engine?.battle?.setEndBattle === 'function') {
            const originalSetEndBattle = window.Engine.battle.setEndBattle.bind(window.Engine.battle);
            window.Engine.battle.setEndBattle = function() { originalSetEndBattle(); BADDONZ_FAST_FIGHT_SENT = false; };
            isEndBattleHooked = true;
        }

        BADDONZ_TRACK_INTERVAL = setInterval(() => { 
            if (currentSettings.enabled && notInBattle()) handleAutoXLogic(); 
        }, 100);
        BADDONZ_FAST_FIGHT_INTERVAL = setInterval(() => { 
            if (currentSettings.fastFight) handleFastFight(); 
        }, 200);
    }

    function addonStop() {
        if (BADDONZ_FAST_FIGHT_INTERVAL) clearInterval(BADDONZ_FAST_FIGHT_INTERVAL);
        if (BADDONZ_TRACK_INTERVAL) clearInterval(BADDONZ_TRACK_INTERVAL);
        BADDONZ_FAST_FIGHT_INTERVAL = null;
        BADDONZ_TRACK_INTERVAL = null;

        if (uiMainWindow) { uiMainWindow.remove(); uiMainWindow = null; }
        if (uiSettingsWindow) { uiSettingsWindow.remove(); uiSettingsWindow = null; }
    }

    function onStateToggle(isEnabled) {
        currentSettings.enabled = isEnabled;
        if (uiMainWindow) {
            const axEnabledCheckbox = uiMainWindow.querySelector(".ax-enabled-checkbox");
            if (axEnabledCheckbox) {
                if (isEnabled) axEnabledCheckbox.classList.add('active');
                else axEnabledCheckbox.classList.remove('active');
            }
        }
    }

    const checkApi = () => {
        if (!window.BaddonzAPI || !window.BaddonzAPI.registerAddon) {
            setTimeout(checkApi, 500);
            return;
        }
        window.BaddonzAPI.registerAddon(ADDON_ID, { init: addonInit, stop: addonStop, onStateToggle: onStateToggle });
    };
    checkApi();
})();
