// ==UserScript==
// @name          AutoX baddonz
// @version       08.07.2026
// @description   autox
// @author        besiak
// @match         https://*.margonem.pl/*
// @grant         none
// ==/UserScript==

(function() {
    'use strict';

    const ADDON_ID = "TESTAX";
    
    // Klucze, które będą zapisywane indywidualnie per-postać
    const CHAR_SPECIFIC_KEYS = ['levelRange'];

    let currentSettings = {
        enabled: true,
        windowOpacity: 2,
        windowVisible: true,
        settingsWindowVisible: false,
        windowSettingsOpacity: 2,
        isExpanded: false,
        fastFight: false,
        enableClanOptions: true,
        ignoreClans: "",
        alwaysAttackClans: "",
        levelRange: "0-500"
    };

    let uiMainWindow = null;
    let uiSettingsWindow = null;
    let BADDONZ_FAST_FIGHT_SENT = false;
    let BADDONZ_FAST_FIGHT_INTERVAL = null;
    let BADDONZ_TRACK_INTERVAL = null;
    let isEngineObserved = false;
    let isEndBattleHooked = false;
    let parsedLevelRange = { min: 0, max: 500 };

    // --- ZMIENNE DO OBSŁUGI MAP I OCHRONY (fail-safe) ---
    let BADDONZ_LAST_MAP_ID = null;
    let BADDONZ_MAP_LOADED_TIME = 0;

    // Silnik gry potrafi chwilowo wyczyścić listę emocji innych graczy zaraz po odebraniu
    // pakietu data.o (odświeżenie listy innych graczy), zanim ją odtworzy. Blokujemy ocenę
    // ochrony na krótką chwilę po takim pakiecie, zamiast wymagać wielu potwierdzeń w kółko
    // (bo pusta lista jest też NORMALNYM stanem gracza bez żadnego statusu - nie da się
    // tego odróżnić samym liczeniem powtórzeń).
    let BADDONZ_OTHERS_REFRESHED_TIME = 0;
    const BADDONZ_PROTECTION_LOCKOUT_MS = 400;

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
        const saved = window.BaddonzAPI.getAddonSettings(ADDON_ID);
        currentSettings = { ...currentSettings, ...saved };
        parsedLevelRange = parseLevelRange(currentSettings.levelRange) || { min: 0, max: 500 };
    }

    function saveSettings() {
        if (!window.BaddonzAPI) return;
        window.BaddonzAPI.saveAddonSettings(ADDON_ID, { ...currentSettings }, CHAR_SPECIFIC_KEYS);
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

    // Bohater martwy lub w trakcie dialogu z NPC -> AutoX ma stać z boku
    function isHeroActionable() {
        if (!window.Engine) return false;

        if (window.Engine.dead) {
            console.log(`[AutoX-Debug] Bohater jest martwy (Engine.dead=true). Wstrzymuję AutoX.`);
            return false;
        }

        if (window.Engine.dialogue) {
            console.log(`[AutoX-Debug] Otwarty dialog z NPC (Engine.dialogue=true). Wstrzymuję AutoX.`);
            return false;
        }

        return true;
    }
    
    function getOthers() { 
        if (!window.Engine || !window.Engine.others) return [];
        return window.Engine.others.getDrawableList().map(o => o.d); 
    }

    // --- FAIL-SAFE: krótki lockout po odświeżeniu listy innych graczy, poza nim ufamy odczytowi ---
    function checkTargetProtection(other) {
        if (!window.Engine.others.getById(other.id)) return false;
        const otherObj = window.Engine.others.getById(other.id);
        const emoList = typeof otherObj.getOnSelfEmoList === 'function' ? otherObj.getOnSelfEmoList() : [];

        console.log(`[AutoX-Debug] Sprawdzam gracza: ${other.nick} (ID: ${other.id}). Załadowane emocje:`, emoList.map(e => e?.name));

        // Krótko po pakiecie data.o (lub zmianie mapy) lista emocji bywa chwilowo pusta,
        // mimo że gracz w rzeczywistości MA ochronę - w tym oknie nie ufamy pustej liście.
        const sinceRefresh = Date.now() - BADDONZ_OTHERS_REFRESHED_TIME;
        if ((!emoList || emoList.length === 0) && sinceRefresh < BADDONZ_PROTECTION_LOCKOUT_MS) {
            console.warn(`[AutoX-Debug] ${other.nick} ma PUSTĄ listę emocji w oknie ${BADDONZ_PROTECTION_LOCKOUT_MS}ms po odświeżeniu danych (niepewny stan, ${sinceRefresh}ms temu). POMIJAM w tym ticku.`);
            return false;
        }

        // Poza oknem niepewności ufamy odczytowi wprost - pusta lista = naprawdę brak statusu.
        const hasProtection = emoList && emoList.some(e => e && ['battle', 'pvpprotected'].includes(e.name));
        if (hasProtection) {
            console.log(`[AutoX-Debug] Gracz ${other.nick} POMINIĘTY (posiada status walki lub ochronki).`);
            return false;
        }

        return true;
    }

    function checkSelfProtection() {
        const hero = window.Engine.hero;
        if (!hero) return false;
        const emoList = typeof hero.getOnSelfEmoList === 'function' ? hero.getOnSelfEmoList() : [];
        
        if (!emoList || emoList.length === 0) {
            console.warn(`[AutoX-Debug] TWÓJ BOHATER ma pustą listę emocji (brak ochrony w pamięci podręcznej).`);
            return false;
        }
        
        const myProtection = emoList.some(e => e && e.name === 'pvpprotected');
        if (myProtection) {
            console.log(`[AutoX-Debug] Atak zablokowany: Posiadasz ochronę PvP.`);
        }
        return myProtection;
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

    // --- UPROSZCZONA LOGIKA WROGA: tylko relacja + lista klanów (bez attackFriends/attackClan/nicków) ---
    function isEnemy(other) {
        if (!other || typeof other.relation !== 'number') return false;
        if (isInParty(other)) return false;

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

        // Domyślne relacje traktowane jako wróg: BRAK(1), WRÓG(3), WRÓG KLANU(6), WRÓG FRAKCJI(8)
        return [1, 3, 6, 8].includes(other.relation);
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

    // --- DYSTANS: rx/ry po OBU stronach (hero i cel), bo obie postacie mogą się ruszać ---
    // Wcześniej liczyliśmy hero.rx/ry vs cel.x/y - to naprawiało ruch bohatera, ale nie ruch celu
    // (cel.x/y "skacze" dopiero po dojściu do kratki, tak samo jak wcześniej hero.x/y).
    // rx/ry po obu stronach jest symetryczne: śledzi na bieżąco zarówno Ciebie jak i poruszający się cel.
    function getClosestTarget() {
        const hero = window.Engine.hero.d;
        const targets = getValidTargets();
        if (!targets.length) return null;

        const hrx = typeof hero.rx !== 'undefined' ? hero.rx : hero.x;
        const hry = typeof hero.ry !== 'undefined' ? hero.ry : hero.y;

        const targetsWithDistance = targets.map(other => {
            const orx = typeof other.rx !== 'undefined' ? other.rx : other.x;
            const ory = typeof other.ry !== 'undefined' ? other.ry : other.y;

            const mainDistance = Math.hypot(hrx - orx, hry - ory); // rx/ry obu stron - główna metryka

            // Metryki pomocnicze tylko do logu porównawczego
            const chebyshevTileDistance = Math.max(Math.abs(hero.x - other.x), Math.abs(hero.y - other.y));
            const heroRealTargetTileDistance = Math.hypot(hrx - other.x, hry - other.y); // poprzednia wersja (hero rx/ry vs cel x/y)

            return {
                target: other,
                distance: mainDistance,
                chebyshevDebug: chebyshevTileDistance,
                heroRealTargetTileDebug: heroRealTargetTileDistance
            };
        });
        targetsWithDistance.sort((a, b) => a.distance - b.distance);
        const closest = targetsWithDistance[0];
        if (closest.distance <= 6) {
            console.log(`[AutoX-Debug] Dystans do celu ${closest.target.nick}: Główna(rx/ry obu)=${closest.distance.toFixed(2)}, Chebyshev(kratki x/y obu)=${closest.chebyshevDebug}, hero.rx/ry vs cel.x/y=${closest.heroRealTargetTileDebug.toFixed(2)}`);
        }
        return closest;
    }

    let BADDONZ_LAST_ATTACK = 0;
    function attack(target, distance) {
        if (Date.now() - BADDONZ_LAST_ATTACK < 300) return false;
        if (distance <= 3) {
            // LOGOWANIE WYSYŁANEGO ATAKU
            console.log(`%c[AutoX-Debug] WYSYŁAM ATAK DO SERWERA -> Cel: ${target.nick} (ID: ${target.id}), Lvl: ${target.lvl}, Dystans: ${distance.toFixed(2)}`, "background: red; color: white; font-weight: bold; padding: 3px;");
            window._g('fight&a=attack&id=' + target.id);
            BADDONZ_LAST_ATTACK = Date.now();
            return true;
        }
        return false;
    }

    function handleAutoXLogic() {
        const map = window.Engine?.map?.d;
        
        // 1. Wykrywanie zmiany mapy w celu uniknięcia "wyścigu"
        if (map && map.id !== BADDONZ_LAST_MAP_ID) {
            console.log(`%c[AutoX-Debug] Zmiana mapy wykryta! Stara: ${BADDONZ_LAST_MAP_ID} -> Nowa: ${map.id} (${map.name}). Włączam blokadę 500ms na załadowanie ochronek.`, "background: #007acc; color: white; padding: 2px;");
            BADDONZ_LAST_MAP_ID = map.id;
            BADDONZ_MAP_LOADED_TIME = Date.now();
            BADDONZ_OTHERS_REFRESHED_TIME = Date.now(); // zmiana mapy też liczy się jako "odświeżenie" - włącz lockout
        }

        // 2. Blokada czasowa
        if (Date.now() - BADDONZ_MAP_LOADED_TIME < 500) {
            return; // Czekamy, aż minie bezpieczne pół sekundy
        }

        const closestTargetWithDistance = getClosestTarget();
        if (closestTargetWithDistance) {
            if (closestTargetWithDistance.distance <= 6) {
                console.log(`[AutoX-Debug] Wytypowano cel do ataku: ${closestTargetWithDistance.target.nick}`);
            }
            attack(closestTargetWithDistance.target, closestTargetWithDistance.distance);
        }
    }

    function handleFastFight() {
        if (window.Engine?.battle?.show && !window.Engine?.battle?.endBattle) {
            if (currentSettings.fastFight && !BADDONZ_FAST_FIGHT_SENT) {
                console.log(`[AutoX-Debug] WYSYŁAM SZYBKĄ WALKĘ (fight&a=f)`);
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

            <div class="baddonz-setting-row"><div class="baddonz-checkbox ax-enable-clan-options-checkbox ${currentSettings.enableClanOptions ? 'active' : ''}"></div><span>Kryteria Klanowe</span></div>
            <div class="ax-clan-options" style="display: ${currentSettings.enableClanOptions ? 'flex' : 'none'}; flex-direction:column; gap:5px;">
                <span class="baddonz-text" style="padding:0;">Nigdy nie atakuj klanów:</span>
                <textarea class="baddonz-textarea baddonz-scroll ax-ignore-clans-textarea" placeholder="Nazwa klanu, ID">${currentSettings.ignoreClans}</textarea>
        
                <span class="baddonz-text" style="padding:0;">Zawsze atakuj klany:</span>
                <textarea class="baddonz-textarea baddonz-scroll ax-always-attack-clans-textarea" placeholder="Nazwa klanu, ID">${currentSettings.alwaysAttackClans}</textarea>
            </div>
        `;
        
        uiSettingsWindow = window.BaddonzAPI.createAddonWindow(ADDON_ID, "AutoX Ustawienia", settingsBodyHtml, { width: '250px', customId: 'baddonz-ax-wnd-settings' });
        
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
                saveSettings();
            });
        }

        axSWalkaBtn.addEventListener('click', () => {
            currentSettings.fastFight = axSWalkaBtn.classList.toggle('active');
            saveSettings();
        });

        uiSettingsWindow.querySelector('.baddonz-close-button').addEventListener('click', () => {
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

        const chbClanOpt = uiSettingsWindow.querySelector(".ax-enable-clan-options-checkbox");
        const divClanOpt = uiSettingsWindow.querySelector(".ax-clan-options");
        chbClanOpt.addEventListener('click', () => { currentSettings.enableClanOptions = chbClanOpt.classList.toggle('active'); divClanOpt.style.display = currentSettings.enableClanOptions ? 'flex' : 'none'; saveSettings(); });

        uiSettingsWindow.querySelector(".ax-ignore-clans-textarea").addEventListener('change', (e) => { currentSettings.ignoreClans = e.target.value; saveSettings(); });
        uiSettingsWindow.querySelector(".ax-always-attack-clans-textarea").addEventListener('change', (e) => { currentSettings.alwaysAttackClans = e.target.value; saveSettings(); });
    }

    function addonInit() {
        loadSettings();
        if (!uiMainWindow) buildUI();

        if (uiMainWindow) {
            uiMainWindow.style.display = currentSettings.windowVisible ? '' : 'none';
            const obs1 = new MutationObserver(() => {
                const isVisible = uiMainWindow.style.display !== 'none';
                if (currentSettings.windowVisible !== isVisible) {
                    currentSettings.windowVisible = isVisible;
                    saveSettings();
                }
            });
            obs1.observe(uiMainWindow, { attributes: true, attributeFilter: ['style'] });
        }

        if (uiSettingsWindow) {
            uiSettingsWindow.style.display = currentSettings.settingsWindowVisible ? '' : 'none';
            const obs2 = new MutationObserver(() => {
                const isVisible = uiSettingsWindow.style.display !== 'none';
                if (currentSettings.settingsWindowVisible !== isVisible) {
                    currentSettings.settingsWindowVisible = isVisible;
                    saveSettings();
                }
            });
            obs2.observe(uiSettingsWindow, { attributes: true, attributeFilter: ['style'] });
        }

        // LOGOWANIE PAKIETÓW ZWROTNYCH Z SERWERA (ZAMIAST WYPRZEDZANIA SILNIKA)
        if (!isEngineObserved) {
            if (window.Engine && window.Engine.communication) {
                emitter.observe(window.Engine.communication, 'parseJSON', data => {
                    if (data) {
                        if (data.o) {
                            console.log(`[AutoX-Debug] [GRA ZWRÓCIŁA data.o - Inni Gracze]`, data.o);
                            BADDONZ_OTHERS_REFRESHED_TIME = Date.now();
                        }
                        if (data.h) console.log(`[AutoX-Debug] [GRA ZWRÓCIŁA data.h - Bohater]`, data.h);
                        if (data.f) console.log(`[AutoX-Debug] [GRA ZWRÓCIŁA data.f - Status Walki]`, data.f);
                        if (data.town) console.log(`[AutoX-Debug] [GRA ZWRÓCIŁA data.town - Pakiet Zmiany Mapy]`, data.town);

                        // Reagujemy NATYCHMIAST na każdy pakiet ruchu (data.o - inni gracze, data.h - bohater),
                        // zamiast czekać na najbliższy tick stałego interwału. Łapie to graczy, którzy
                        // przemykają przez zasięg ataku szybciej niż wynosi odstęp między tickami.
                        if ((data.o || data.h) && currentSettings.enabled && notInBattle() && isHeroActionable()) {
                            handleAutoXLogic();
                        }
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

        // Interwał zostaje jako zapasowa siatka bezpieczeństwa (np. gdy przez chwilę nie ma żadnych
        // pakietów ruchu), skrócony z 100ms do 60ms dla dodatkowej czułości.
        BADDONZ_TRACK_INTERVAL = setInterval(() => { 
            if (currentSettings.enabled && notInBattle() && isHeroActionable()) handleAutoXLogic(); 
        }, 60);

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
