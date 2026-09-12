// ==UserScript==
// @name          Auto Otchłań baddonz
// @namespace     http://tampermonkey.net/
// @version       2.0
// @author        besiak
// @match         https://*.margonem.pl/*
// @grant         none
// ==/UserScript==

(function() {
    'use strict';

    const ADDON_ID = "OTCH";
    const CHAR_SPECIFIC_KEYS = ['changeSets', 'profSets'];

    const DEFAULT_SETTINGS = {
        enabled: true,
        autoAbyss: false,
        collectChests: false,
        stopOnMaxStage: false,
        autoSwitch: false,
        autoF: true,
        lastFinishedChars: {},
        lastResetDate: '',
        changeSets: false,
        profSets: { h: '0', b: '0', m: '0', p: '0', w: '0', t: '0' }
    };

    let currentSettings = { ...DEFAULT_SETTINGS };
    let uiWindowElement = null;
    let isRunning = false;

    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    const log = (...args) => console.log('%c[Auto Otchłań]', 'color:#4CAF50;font-weight:bold;', ...args);

    const closeWarningAlert = () => {
        try {
            const list = window.Engine?.windowManager?.getList?.();
            const name = window.Engine?.windowsData?.name?.ALERT_WND;
            if (!list || !name || !list[name]) return false;
            for (const id in list[name]) {
                const wnd = list[name][id];
                if (wnd && typeof wnd.close === 'function' && wnd.isShow?.()) {
                    wnd.close();
                    return true;
                }
            }
        } catch (e) {}
        return false;
    };

    const isWarningAlertVisible = () => {
        const els = document.querySelectorAll('.mAlert .inner-content');
        for (const el of els) {
            if (el.offsetParent !== null && el.textContent.includes('Punkt ostrzeżenia dodany!')) {
                return true;
            }
        }
        return false;
    };

    function loadSettings() {
        if (!window.BaddonzAPI) return;
        const saved = window.BaddonzAPI.getAddonSettings(ADDON_ID);
        currentSettings = { ...DEFAULT_SETTINGS, ...saved };
        if (!currentSettings.profSets) currentSettings.profSets = { ...DEFAULT_SETTINGS.profSets };
    }

    function saveSettings() {
        if (!window.BaddonzAPI) return;
        window.BaddonzAPI.saveAddonSettings(ADDON_ID, { ...currentSettings }, CHAR_SPECIFIC_KEYS);
    }

    const fetchGameData = () => {
        if (!window.Engine || !window.Engine.changePlayer || !window.Engine.hero) return null;
        try {
            return {
                charList: window.Engine.changePlayer.charlist.list,
                world: window.Engine.worldConfig.getWorldName(),
                currentId: window.Engine.hero.d.id,
                currentAccount: window.Engine.hero.d.account
            };
        } catch (e) {
            return null;
        }
    };

    const isCaptchaVisible = () => {
        const w = document.querySelector('.captcha-window');
        return w && w.offsetParent !== null && w.querySelector('.header-label .text')?.textContent === 'Zagadka';
    };

    const updateAutoAbyssState = (isActive, autoAbyssEl) => {
        autoAbyssEl.classList.toggle('active', isActive);
        autoAbyssEl.classList.toggle('baddonz-state-button--active', isActive);
        if (typeof $ === 'function' && typeof $.fn.tip === 'function') {
            $(autoAbyssEl).tip(isActive ? 'Włączony' : 'Wyłączony');
        }
    };

    const performDailyResetCheck = () => {
        const todayKey = new Date().toDateString();
        if (currentSettings.lastResetDate !== todayKey) {
            currentSettings.lastFinishedChars = {};
            currentSettings.lastResetDate = todayKey;
            saveSettings();
        }
    };

    const startCharacterSwitch = async () => {
        performDailyResetCheck();
        const d = fetchGameData();
        if (!d || !currentSettings.autoSwitch) return;

        let chars = d.charList.filter(c => c.world === d.world);
        if (chars.length <= 1) return;

        chars.sort((a, b) => b.lvl - a.lvl);
        log('Wykryte postacie na koncie:', chars.map(c => `${c.nick || c.id} (lvl ${c.lvl})`));
        log('Kolejność przelogowywania:', chars.map(c => c.nick || c.id));

        const currentIdx = chars.findIndex(c => c.id === d.currentId);
        if (currentIdx === -1) return;

        const todayKey = new Date().toDateString();
        let nextChar = null;

        for (let i = 1; i < chars.length; i++) {
            const c = chars[(currentIdx + i) % chars.length];
            if (c.id !== d.currentId && currentSettings.lastFinishedChars[c.id] !== todayKey) {
                nextChar = c;
                break;
            }
        }

        if (!nextChar) {
            log('Brak dostępnej postaci do przełączenia (wszystkie już skończone na dziś).');
            return;
        }

        const nextId = nextChar.id;
        const prevId = d.currentId;
        log(`Przełączam na: ${nextChar.nick || nextId}`);

        window.Engine.changePlayer.changePlayerRequest(nextId);

        let switched = false;
        for (let i = 0; i < 3; i++) {
            await wait(6000);
            const heroId = window.Engine?.hero?.d?.id;
            if (heroId === nextId) {
                switched = true;
                currentSettings.lastFinishedChars[prevId] = todayKey;
                saveSettings();
                log(`Przełączono pomyślnie na ${nextId}.`);
                break;
            }
            window.Engine.changePlayer.changePlayerRequest(nextId);
        }

        if (!switched) log('Nie udało się przełączyć postaci.');
    };

    const checkAbyssCompletion = async () => {
        const autoAbyssEl = document.getElementById('autoAbyss');
        if (!autoAbyssEl) return false;

        const progressDiv = document.querySelector('.matchmaking-progress-stage');
        if (!progressDiv || progressDiv.offsetParent === null) return false;

        const stage = progressDiv.querySelector('.stage')?.textContent.trim();
        const ratio = progressDiv.querySelector('.ratio')?.textContent.trim();
        if (stage !== 'Etap IV' || ratio !== '15/15') return false;

        log('Osiągnięto maksymalny etap (Etap IV, 15/15).');

        if (currentSettings.collectChests) {
            log('Odbieram skrzynki.');
            window._g('match&a=collect');
            await wait(1000);
        }

        if (currentSettings.stopOnMaxStage) {
            log('Zatrzymuję - wyłączam Auto Otchłań.');
            updateAutoAbyssState(false, autoAbyssEl);
            currentSettings.autoAbyss = false;
            saveSettings();
            if (currentSettings.autoSwitch) startCharacterSwitch();
        } else if (currentSettings.autoSwitch) {
            log('Przelogowywanie aktywne.');
            startCharacterSwitch();
        } else {
            updateAutoAbyssState(false, autoAbyssEl);
            currentSettings.autoAbyss = false;
            saveSettings();
        }

        return true;
    };

    const handleWarningAlert = async () => {
        if (!isWarningAlertVisible()) return false;
        log('Wykryto "Punkt ostrzeżenia dodany!" - zamykam okno i czekam 60 sekund.');
        closeWarningAlert();
        await wait(60000);
        log('Minęła minuta kary - wznawiam.');
        return true;
    };

    const waitForOpponentAccept = async () => {
        const max = 5000;
        let elapsed = 0;
        while (elapsed < max) {
            const el = document.querySelector('.choose-eq');
            if (el && el.offsetParent !== null) return true;
            await wait(250);
            elapsed += 250;
        }
        return false;
    };

    const waitForBattleToStart = async () => {
        while (isRunning && (!window.Engine?.battle?.show)) await wait(500);
    };

    const waitForBattleToFinish = async () => {
        while (isRunning && (!window.Engine?.battle?.endBattle)) await wait(500);
    };

    const fetchOpponentProfessionKey = async () => {
        const profClassMap = {
            'hidden-prof--h': 'h', 'hidden-prof--b': 'b', 'hidden-prof--m': 'm',
            'hidden-prof--p': 'p', 'hidden-prof--w': 'w', 'hidden-prof--t': 't'
        };
        const profNameMap = {
            'Łowca': 'h', 'Tancerz Ostrzy': 'b', 'Mag': 'm',
            'Paladyn': 'p', 'Wojownik': 'w', 'Tropiciel': 't'
        };

        for (let i = 0; i < 30; i++) {
            const infoDiv = document.querySelector('.opponent-info');
            if (infoDiv && infoDiv.offsetParent !== null) {
                const avatar = infoDiv.querySelector('.avatar-icon');
                if (avatar) {
                    for (const cls in profClassMap) {
                        if (avatar.classList.contains(cls)) return profClassMap[cls];
                    }
                }
                const lvlRating = infoDiv.querySelector('.level-rating');
                if (lvlRating) {
                    const key = profNameMap[lvlRating.textContent.trim()];
                    if (key) return key;
                }
            }
            await wait(250);
        }
        return null;
    };

    async function runAbyssAutomation() {
        const autoAbyssEl = document.getElementById('autoAbyss');
        if (!autoAbyssEl || !currentSettings.enabled) return;

        isRunning = true;

        while (autoAbyssEl.classList.contains('active') && isRunning) {
            await wait(250);

            if (await checkAbyssCompletion()) { isRunning = false; return; }
            if (await handleWarningAlert()) continue;

            const opponentTimer = document.querySelector('#matchmaking-timer');
            const opponentPromptVisible = opponentTimer && opponentTimer.offsetParent !== null;

            if (opponentPromptVisible) {
                if (isCaptchaVisible()) {
                    log('Captcha - czekam.');
                    while (isCaptchaVisible()) {
                        await wait(1000);
                        if (!autoAbyssEl.classList.contains('active') || !isRunning) { isRunning = false; return; }
                    }
                    await wait(500);
                    continue;
                }

                log('Znalazłem przeciwnika - akceptuję.');
                window._g('match&a=accept_opp&ans=1');

                if (!await waitForOpponentAccept()) {
                    log('Okno wyboru EQ nie pojawiło się - ponawiam.');
                    await wait(1500);
                    continue;
                }

                const changeSetsEl = document.getElementById('changeSets');
                if (changeSetsEl?.classList.contains('active')) {
                    const profKey = await fetchOpponentProfessionKey();
                    if (profKey) {
                        log(`Profesja przeciwnika: ${profKey}`);
                        const setId = currentSettings.profSets?.[profKey];
                        const buildsCommons = window.Engine?.buildsManager?.getBuildsCommons?.();
                        if (buildsCommons && setId && setId !== '0' && setId != buildsCommons.getCurrentId()) {
                            log(`Zmieniam zestaw na: ${setId}`);
                            window._g(`builds&action=updateCurrent&id=${setId}`);
                            await wait(750);
                        }
                    } else {
                        log('Nie wykryto profesji przeciwnika.');
                    }
                }

                window._g('match&a=prepared');
                await waitForBattleToStart();
                if (!isRunning) return;
                log('Jestem w walce.');

                if (currentSettings.autoF) window._g('fight&a=f');

                await waitForBattleToFinish();
                if (!isRunning) return;
                log('Skończyłem walkę.');

                window._g('fight&a=exit');
                await wait(250);

                if (await checkAbyssCompletion()) { isRunning = false; return; }
                await wait(2000);
                if (await checkAbyssCompletion()) { isRunning = false; return; }

                if (autoAbyssEl.classList.contains('active')) {
                    log('Zapisuję się ponownie do kolejki.');
                    window._g('fight&a=nextmatch');
                    await wait(500);
                } else {
                    isRunning = false;
                    return;
                }

            } else {
                const inQueue = document.querySelector('.matchmaking-timer')?.offsetParent !== null;
                if (!inQueue && !isCaptchaVisible()) {
                    if (await checkAbyssCompletion()) { isRunning = false; return; }
                    await wait(2000);
                    if (autoAbyssEl.classList.contains('active')) {
                        log('Zapisuję się do kolejki.');
                        window._g('match&a=signin');
                        await wait(500);
                    } else {
                        isRunning = false;
                        return;
                    }
                } else {
                    await wait(1000);
                }
            }
        }

        isRunning = false;
    }

    const populateBuilds = async (setSelects) => {
        let buildsCommons = null;
        for (let i = 0; i < 10; i++) {
            buildsCommons = window.Engine?.buildsManager?.getBuildsCommons?.();
            if (buildsCommons) break;
            await wait(500);
        }
        if (!buildsCommons) return;

        const allBuilds = buildsCommons.getBuildsName();
        const opts = ['<option value="0">Brak</option>'];
        for (const id in allBuilds) {
            const b = allBuilds[id];
            const name = b?.name?.startsWith('[SET.') ? id : (b?.name || `[Zestaw ${id}]`);
            opts.push(`<option value="${id}">${name}</option>`);
        }
        const html = opts.join('');

        for (const profKey in setSelects) {
            const sel = setSelects[profKey];
            if (!sel) continue;
            sel.innerHTML = html;
            const saved = currentSettings.profSets?.[profKey] || '0';
            sel.value = Array.from(sel.options).some(o => o.value === saved) ? saved : '0';
            currentSettings.profSets[profKey] = sel.value;
        }
        saveSettings();
    };

    let populateInterval = null;

    function buildUI() {
        const bodyHtml = `
            <div class="baddonz-setting-row" style="margin-bottom:4px;display:flex;align-items:center;">
                <div class="baddonz-state-button ${currentSettings.autoAbyss ? 'active baddonz-state-button--active' : ''}" id="autoAbyss"></div>
                <span class="baddonz-text" style="padding:0;margin-left:5px;">Auto Otchłań</span>
            </div>
            <div class="baddonz-setting-row">
                <div class="baddonz-checkbox ${currentSettings.collectChests ? 'active' : ''}" id="collectChests"></div>
                <span class="baddonz-text" style="padding:0;">Odbieraj skrzynki</span>
            </div>
            <div class="baddonz-setting-row">
                <div class="baddonz-checkbox ${currentSettings.stopOnMaxStage ? 'active' : ''}" id="stopOnMaxStage"></div>
                <span class="baddonz-text" style="padding:0;">Zatrzymuj na Etapie IV</span>
            </div>
            <div class="baddonz-setting-row">
                <div class="baddonz-checkbox ${currentSettings.autoSwitch ? 'active' : ''}" id="autoSwitch"></div>
                <span class="baddonz-text" style="padding:0;">Przelogowywanie</span>
            </div>
            <div class="baddonz-setting-row">
                <div class="baddonz-checkbox ${currentSettings.autoF ? 'active' : ''}" id="autoF"></div>
                <span class="baddonz-text" style="padding:0;">AutoF</span>
            </div>
            <hr style="width:100%;border-color:#303030;margin:5px 0;">
            <div class="baddonz-setting-row">
                <div class="baddonz-checkbox ${currentSettings.changeSets ? 'active' : ''}" id="changeSets"></div>
                <span class="baddonz-text" style="padding:0;">Zmieniaj Zestawy</span>
            </div>
            <div id="set-change-config" class="baddonz-flex column" style="gap:3px;display:${currentSettings.changeSets ? 'flex' : 'none'};padding:0 5px;">
                ${['h:Łowca','b:Tancerz Ostrzy','m:Mag','p:Paladyn','w:Wojownik','t:Tropiciel'].map(s => {
                    const [key, label] = s.split(':');
                    return `<div class="baddonz-label-wrapper" style="justify-content:space-between;align-items:center;">
                        <div class="baddonz-text" style="padding:0;min-width:90px;">${label}</div>
                        <select class="baddonz-input baddonz-select" id="set-${key}" style="flex-grow:1;"></select>
                    </div>`;
                }).join('')}
            </div>
        `;

        uiWindowElement = window.BaddonzAPI.createAddonWindow(ADDON_ID, 'Auto Otchłań', bodyHtml, {
            width: '210px',
            customId: 'baddonz-otch-wnd',
            hasSettings: false,
            hasCollapse: false
        });

        const get = (id) => uiWindowElement.querySelector(`#${id}`);

        const autoAbyssEl    = get('autoAbyss');
        const collectChestsEl = get('collectChests');
        const stopOnMaxEl    = get('stopOnMaxStage');
        const changeSetsEl   = get('changeSets');
        const setConfigEl    = get('set-change-config');
        const autoSwitchEl   = get('autoSwitch');
        const autoFEl        = get('autoF');

        const setSelects = { h: get('set-h'), b: get('set-b'), m: get('set-m'), p: get('set-p'), w: get('set-w'), t: get('set-t') };

        if (typeof $ === 'function' && typeof $.fn.tip === 'function') {
            $(collectChestsEl).tip('Automatyczne odbieranie skrzynek gdy Etap IV (15/15)');
            $(stopOnMaxEl).tip('Zatrzymuje dodatek po osiągnięciu Etapu IV (15/15)');
            $(changeSetsEl).tip('Zmieniaj zestawy w zależności od profesji przeciwnika');
            $(autoSwitchEl).tip('Automatyczne przelogowywanie postaci po ukończeniu Otchłani');
        }

        updateAutoAbyssState(currentSettings.autoAbyss, autoAbyssEl);

        autoAbyssEl.addEventListener('click', () => {
            if (!currentSettings.enabled) return;
            const newState = !autoAbyssEl.classList.contains('active');
            updateAutoAbyssState(newState, autoAbyssEl);
            currentSettings.autoAbyss = newState;
            saveSettings();
            if (newState) runAbyssAutomation();
            else isRunning = false;
        });

        collectChestsEl.addEventListener('click', () => { currentSettings.collectChests = collectChestsEl.classList.toggle('active'); saveSettings(); });
        stopOnMaxEl.addEventListener('click', () => { currentSettings.stopOnMaxStage = stopOnMaxEl.classList.toggle('active'); saveSettings(); });
        autoSwitchEl.addEventListener('click', () => { currentSettings.autoSwitch = autoSwitchEl.classList.toggle('active'); saveSettings(); });
        autoFEl.addEventListener('click', () => { currentSettings.autoF = autoFEl.classList.toggle('active'); saveSettings(); });

        changeSetsEl.addEventListener('click', () => {
            currentSettings.changeSets = changeSetsEl.classList.toggle('active');
            setConfigEl.style.display = currentSettings.changeSets ? 'flex' : 'none';
            saveSettings();
        });

        for (const profKey in setSelects) {
            const sel = setSelects[profKey];
            if (sel) sel.addEventListener('change', () => { currentSettings.profSets[profKey] = sel.value; saveSettings(); });
        }

        populateBuilds(setSelects);
        if (populateInterval) clearInterval(populateInterval);
        populateInterval = setInterval(() => populateBuilds(setSelects), 5000);
    }

    function addonInit() {
        loadSettings();
        if (!uiWindowElement) buildUI();
        performDailyResetCheck();
        if (currentSettings.autoAbyss && currentSettings.enabled) runAbyssAutomation();
    }

    function addonStop() {
        isRunning = false;
        if (populateInterval) { clearInterval(populateInterval); populateInterval = null; }
        if (uiWindowElement) { uiWindowElement.remove(); uiWindowElement = null; }
    }

    function onStateToggle(isEnabled) {
        currentSettings.enabled = isEnabled;
        if (!isEnabled) {
            isRunning = false;
            const autoAbyssEl = document.getElementById('autoAbyss');
            if (autoAbyssEl) { updateAutoAbyssState(false, autoAbyssEl); currentSettings.autoAbyss = false; saveSettings(); }
        }
    }

    const checkApi = () => {
        if (!window.BaddonzAPI?.registerAddon) { setTimeout(checkApi, 500); return; }
        window.BaddonzAPI.registerAddon(ADDON_ID, { init: addonInit, stop: addonStop, onStateToggle });
    };

    checkApi();
})();
