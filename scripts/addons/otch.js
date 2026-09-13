// ==UserScript==
// @name          Auto Otchłań baddonz
// @namespace     http://tampermonkey.net/
// @version       3.1
// @author        besiak
// @match         https://*.margonem.pl/*
// @grant         none
// ==/UserScript==

(function() {
    'use strict';

    const ADDON_ID = "OTCH";
    const CHAR_SPECIFIC_KEYS = ['changeSets', 'profSets'];
    const ABYSS_END_HOUR = 21;
    const PENALTY_THRESHOLDS = {
        3: 60 * 1000,           // 3pkt = 1 minuta
        6: 15 * 60 * 1000,      // 6pkt = 15 minut
        9: 60 * 60 * 1000       // 9pkt = 60 minut
    };

    const DEFAULT_SETTINGS = {
        enabled: true,
        autoAbyss: false,
        collectChests: false,
        stopOnMaxStage: false,
        autoSwitch: false,
        autoF: true,
        lastFinishedChars: {},
        lastResetDate: '',
        charPenalties: {},
        changeSets: false,
        profSets: { h: '0', b: '0', m: '0', p: '0', w: '0', t: '0' }
    };

    let currentSettings = { ...DEFAULT_SETTINGS };
    let uiWindowElement = null;
    let isRunning = false;
    let wsHooked = false;
    let originalParseJSON = null;
    let pendingPenaltyPoints = null;

    const getAbyssEndTimestamp = () => {
        const now = new Date();
        const warsawNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Warsaw' }));
        const offsetMs = now.getTime() - warsawNow.getTime();
        const end = new Date(warsawNow);
        end.setHours(ABYSS_END_HOUR, 0, 0, 0);
        if (warsawNow.getHours() >= ABYSS_END_HOUR) end.setDate(end.getDate() + 1);
        return end.getTime() + offsetMs;
    };

    const isAbyssOpen = () => {
        const now = new Date();
        const warsawNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Warsaw' }));
        return warsawNow.getHours() < ABYSS_END_HOUR;
    };

    const parsePenaltyFromMsg = (msg, evSeconds) => {
        const match = msg.match(/kara\s*-\s*(\d{4}-\d{2}-\d{2})\s+(\d{2}):(\d{2})/);
        if (!match) return null;

        const [, datePart, hStr, mStr] = match;
        const [y, mo, d] = datePart.split('-').map(Number);
        const penaltyH = parseInt(hStr);
        const penaltyM = parseInt(mStr);

        const evMs = evSeconds * 1000;
        const evDate = new Date(evMs);
        const warsawEv = new Date(evDate.toLocaleString('en-US', { timeZone: 'Europe/Warsaw' }));
        const offsetMs = evDate.getTime() - warsawEv.getTime();

        const penaltyEndWarsaw = new Date(y, mo - 1, d, penaltyH, penaltyM, 0, 0);
        // +65s bo gra zaokrągla w dół do minut, więc "20:11" to max 20:11:59
        return penaltyEndWarsaw.getTime() + offsetMs + 65000;
    };

    const getCurrentCharId = () => window.Engine?.hero?.d?.id;

    const setPenaltyForChar = (charId, penaltyUntilTs) => {
        if (!charId) return;
        if (!currentSettings.charPenalties) currentSettings.charPenalties = {};
        currentSettings.charPenalties[charId] = penaltyUntilTs;
        saveSettings();
    };

    const getPenaltyForChar = (charId) => {
        const p = currentSettings.charPenalties?.[charId];
        if (!p) return null;
        if (Date.now() >= p) {
            delete currentSettings.charPenalties[charId];
            saveSettings();
            return null;
        }
        return p;
    };

    const charHasActivePenalty = (charId) => getPenaltyForChar(charId) !== null;

    const hookWS = () => {
        if (wsHooked) return;
        if (!window.Engine?.communication?.parseJSON) { setTimeout(hookWS, 500); return; }

        originalParseJSON = window.Engine.communication.parseJSON;
        window.Engine.communication.parseJSON = function(data) {
            const result = originalParseJSON.apply(this, arguments);
            try { onServerData(data); } catch (e) {}
            return result;
        };
        wsHooked = true;
    };

    const unhookWS = () => {
        if (!wsHooked || !originalParseJSON || !window.Engine?.communication) return;
        window.Engine.communication.parseJSON = originalParseJSON;
        originalParseJSON = null;
        wsHooked = false;
    };

    const onServerData = (data) => {
        if (!data) return;
        if (data.f?.poolTime?.penalty !== undefined) {
            pendingPenaltyPoints = data.f.poolTime.penalty;
        }
        if (data.msg && Array.isArray(data.msg)) {
            for (const msg of data.msg) {
                if (typeof msg === 'string' && msg.includes('Możesz zapisać się dopiero')) {
                    const ev = data.ev || (Date.now() / 1000);
                    const penaltyTs = parsePenaltyFromMsg(msg, ev);

                    if (penaltyTs) {
                        setPenaltyForChar(getCurrentCharId(), penaltyTs);
                    } else if (pendingPenaltyPoints !== null) {
                        const pts = pendingPenaltyPoints;
                        let fallbackMs = null;
                        if (pts >= 9) fallbackMs = PENALTY_THRESHOLDS[9];
                        else if (pts >= 6) fallbackMs = PENALTY_THRESHOLDS[6];
                        else if (pts >= 3) fallbackMs = PENALTY_THRESHOLDS[3];
                        if (fallbackMs) setPenaltyForChar(getCurrentCharId(), Date.now() + fallbackMs);
                    }

                    pendingPenaltyPoints = null;
                    onPenaltyDetected();
                }
            }
        }
    };

    const onPenaltyDetected = () => {
        if (!currentSettings.autoAbyss) return;
    };

    const markCharFinished = (charId) => {
        if (!charId) return;
        currentSettings.lastFinishedChars[charId] = new Date().toDateString();
        saveSettings();
    };

    const stopAutomation = () => {
        isRunning = false;
        const el = document.getElementById('autoAbyss');
        if (el) { updateAutoAbyssState(false, el); currentSettings.autoAbyss = false; saveSettings(); }
    };

    const wait = (ms) => new Promise(r => setTimeout(r, ms));

    function loadSettings() {
        if (!window.BaddonzAPI) return;
        const saved = window.BaddonzAPI.getAddonSettings(ADDON_ID);
        currentSettings = { ...DEFAULT_SETTINGS, ...saved };
        if (!currentSettings.profSets) currentSettings.profSets = { ...DEFAULT_SETTINGS.profSets };
        if (!currentSettings.charPenalties) currentSettings.charPenalties = {};
        if (!currentSettings.lastFinishedChars) currentSettings.lastFinishedChars = {};
    }

    function saveSettings() {
        if (!window.BaddonzAPI) return;
        window.BaddonzAPI.saveAddonSettings(ADDON_ID, { ...currentSettings }, CHAR_SPECIFIC_KEYS);
    }

    const fetchGameData = () => {
        if (!window.Engine?.changePlayer?.charlist || !window.Engine?.hero) return null;
        try {
            return {
                charList: window.Engine.changePlayer.charlist.list,
                world: window.Engine.worldConfig.getWorldName(),
                currentId: window.Engine.hero.d.id
            };
        } catch (e) { return null; }
    };

    const isCaptchaVisible = () => {
        const w = document.querySelector('.captcha-window');
        return w && w.offsetParent !== null && w.querySelector('.header-label .text')?.textContent === 'Zagadka';
    };

    const updateAutoAbyssState = (isActive, el) => {
        el.classList.toggle('active', isActive);
        el.classList.toggle('baddonz-state-button--active', isActive);
        if (typeof $ === 'function' && typeof $.fn.tip === 'function') {
            $(el).tip(isActive ? 'Włączony' : 'Wyłączony');
        }
    };

    const performDailyResetCheck = () => {
        const todayKey = new Date().toDateString();
        if (currentSettings.lastResetDate !== todayKey) {
            currentSettings.lastFinishedChars = {};
            currentSettings.charPenalties = {};
            currentSettings.lastResetDate = todayKey;
            saveSettings();
        }
    };
    const pickNextChar = () => {
        const d = fetchGameData();
        if (!d) return null;

        const todayKey = new Date().toDateString();
        const abyssEnd = getAbyssEndTimestamp();

        let chars = d.charList.filter(c => c.world === d.world);
        if (chars.length <= 1) return null;

        chars.sort((a, b) => b.lvl - a.lvl);
        const currentIdx = chars.findIndex(c => c.id === d.currentId);
        if (currentIdx === -1) return null;

        let penaltyWaitCandidate = null;

        for (let i = 1; i < chars.length; i++) {
            const c = chars[(currentIdx + i) % chars.length];
            if (c.id === d.currentId) continue;
            if (currentSettings.lastFinishedChars[c.id] === todayKey) continue;

            const penalty = getPenaltyForChar(c.id);

            if (!penalty) {
                return { charId: c.id, nick: c.nick || c.id, reason: 'normal' };
            }

            if (penalty < abyssEnd && !penaltyWaitCandidate) {
                penaltyWaitCandidate = { charId: c.id, nick: c.nick || c.id, penaltyUntil: penalty, reason: 'penalty_wait' };
            }
            // Kara po 21:00 - pomijamy
        }

        return penaltyWaitCandidate || null;
    };

    const switchToChar = async (charId) => {
        window.Engine.changePlayer.changePlayerRequest(charId);
        const prevId = getCurrentCharId();

        for (let i = 0; i < 3; i++) {
            await wait(6000);
            if (window.Engine?.hero?.d?.id === charId) {
                markCharFinished(prevId);
                return true;
            }
            window.Engine.changePlayer.changePlayerRequest(charId);
        }
        return false;
    };

    // Obsługuje przelogowanie po wykryciu kary lub ukończeniu postaci.
    // Wywołuje pickNextChar() i decyduje co robić - ta funkcja NIE jest wywoływana
    // w trakcie walki, tylko po jej zakończeniu (po fight&a=exit).
    const handleSwitchAfterFinish = async () => {
        if (!currentSettings.autoSwitch) return;

        const next = pickNextChar();
        if (!next) return;

        if (next.reason === 'penalty_wait') {
            const waitMs = next.penaltyUntil - Date.now();
            if (waitMs > 0) await wait(waitMs + 5000);
        }

        await switchToChar(next.charId);
    };

    const checkAbyssCompletion = async () => {
        const progressDiv = document.querySelector('.matchmaking-progress-stage');
        if (!progressDiv || progressDiv.offsetParent === null) return false;

        const stage = progressDiv.querySelector('.stage')?.textContent.trim();
        const ratio = progressDiv.querySelector('.ratio')?.textContent.trim();
        if (stage !== 'Etap IV' || ratio !== '15/15') return false;

        // Kolejność jest ważna: najpierw skrzynki, potem oznaczamy jako skończoną, potem przelogowujemy
        if (currentSettings.collectChests) {
            window._g('match&a=collect');
            await wait(1000);
        }

        markCharFinished(getCurrentCharId());

        if (currentSettings.stopOnMaxStage || !currentSettings.autoSwitch) {
            stopAutomation();
            return true;
        }

        await handleSwitchAfterFinish();
        return true;
    };

    const waitForOpponentAccept = async () => {
        for (let i = 0; i < 20; i++) {
            const el = document.querySelector('.choose-eq');
            if (el && el.offsetParent !== null) return true;
            await wait(250);
        }
        return false;
    };

    const waitForBattleToStart = async () => {
        while (isRunning && !window.Engine?.battle?.show) await wait(500);
    };

    const waitForBattleToFinish = async () => {
        while (isRunning && !window.Engine?.battle?.endBattle) await wait(500);
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
                const lr = infoDiv.querySelector('.level-rating');
                if (lr && profNameMap[lr.textContent.trim()]) return profNameMap[lr.textContent.trim()];
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

            if (!isAbyssOpen()) { stopAutomation(); return; }
            if (await checkAbyssCompletion()) { isRunning = false; return; }

            // Sprawdzamy karę aktualnej postaci
            const penalty = getPenaltyForChar(getCurrentCharId());
            if (penalty) {
                const abyssEnd = getAbyssEndTimestamp();

                if (penalty >= abyssEnd) {
                    // Kara minie po 21:00 - ta postać skreślona
                    markCharFinished(getCurrentCharId());
                    if (currentSettings.autoSwitch) {
                        const next = pickNextChar();
                        if (next) { await switchToChar(next.charId); continue; }
                    }
                    stopAutomation();
                    return;
                }

                // Kara minie przed 21:00
                if (currentSettings.autoSwitch) {
                    const next = pickNextChar();
                    if (next && next.reason === 'normal') {
                        // Jest inna postać bez kary - lecimy na nią
                        await switchToChar(next.charId);
                        continue;
                    }
                }

                // Czekamy na koniec kary (brak przelogowywania lub brak innej postaci)
                const waitMs = penalty - Date.now();
                if (waitMs > 0) await wait(waitMs + 5000);
                continue;
            }

            const opponentTimer = document.querySelector('#matchmaking-timer');
            const opponentPromptVisible = opponentTimer && opponentTimer.offsetParent !== null;

            if (opponentPromptVisible) {
                if (isCaptchaVisible()) {
                    while (isCaptchaVisible()) {
                        await wait(1000);
                        if (!autoAbyssEl.classList.contains('active') || !isRunning) { isRunning = false; return; }
                    }
                    await wait(500);
                    continue;
                }

                window._g('match&a=accept_opp&ans=1');

                if (!await waitForOpponentAccept()) {
                    await wait(1500);
                    continue;
                }

                const changeSetsEl = document.getElementById('changeSets');
                if (changeSetsEl?.classList.contains('active')) {
                    const profKey = await fetchOpponentProfessionKey();
                    if (profKey) {
                        const setId = currentSettings.profSets?.[profKey];
                        const buildsCommons = window.Engine?.buildsManager?.getBuildsCommons?.();
                        if (buildsCommons && setId && setId !== '0' && setId != buildsCommons.getCurrentId()) {
                            window._g(`builds&action=updateCurrent&id=${setId}`);
                            await wait(750);
                        }
                    }
                }

                window._g('match&a=prepared');
                await waitForBattleToStart();
                if (!isRunning) return;

                if (currentSettings.autoF) window._g('fight&a=f');

                await waitForBattleToFinish();
                if (!isRunning) return;

                window._g('fight&a=exit');
                await wait(250);

                if (await checkAbyssCompletion()) { isRunning = false; return; }
                await wait(2000);
                if (await checkAbyssCompletion()) { isRunning = false; return; }

                if (autoAbyssEl.classList.contains('active')) {
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

        const autoAbyssEl     = get('autoAbyss');
        const collectChestsEl = get('collectChests');
        const stopOnMaxEl     = get('stopOnMaxStage');
        const changeSetsEl    = get('changeSets');
        const setConfigEl     = get('set-change-config');
        const autoSwitchEl    = get('autoSwitch');
        const autoFEl         = get('autoF');

        const setSelects = {
            h: get('set-h'), b: get('set-b'), m: get('set-m'),
            p: get('set-p'), w: get('set-w'), t: get('set-t')
        };

        if (typeof $ === 'function' && typeof $.fn.tip === 'function') {
            $(collectChestsEl).tip('Automatyczne odbieranie skrzynek gdy Etap IV (15/15)');
            $(stopOnMaxEl).tip('Zatrzymuje dodatek po osiągnięciu Etapu IV (15/15)');
            $(changeSetsEl).tip('Zmieniaj zestawy w zależności od profesji przeciwnika');
            $(autoSwitchEl).tip('Automatyczne przelogowywanie postaci po ukończeniu Otchłani');
            $(autoFEl).tip('Automatyczny AutoF na początku walki');
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
        hookWS();
        if (currentSettings.autoAbyss && currentSettings.enabled) runAbyssAutomation();
    }

    function addonStop() {
        isRunning = false;
        unhookWS();
        if (populateInterval) { clearInterval(populateInterval); populateInterval = null; }
        if (uiWindowElement) { uiWindowElement.remove(); uiWindowElement = null; }
    }

    function onStateToggle(isEnabled) {
        currentSettings.enabled = isEnabled;
        if (!isEnabled) {
            isRunning = false;
            const el = document.getElementById('autoAbyss');
            if (el) { updateAutoAbyssState(false, el); currentSettings.autoAbyss = false; saveSettings(); }
        }
    }

    const checkApi = () => {
        if (!window.BaddonzAPI?.registerAddon) { setTimeout(checkApi, 500); return; }
        window.BaddonzAPI.registerAddon(ADDON_ID, { init: addonInit, stop: addonStop, onStateToggle });
    };

    checkApi();
})();
