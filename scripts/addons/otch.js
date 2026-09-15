// ==UserScript==
// @name          Auto Otchłań baddonz
// @namespace     http://tampermonkey.net/
// @version       3.4
// @author        besiak
// @match         https://*.margonem.pl/*
// @grant         none
// ==/UserScript==

(function() {
    'use strict';

    const ADDON_ID = "OTCH";
    const CHAR_SPECIFIC_KEYS = ['changeSets', 'profSets'];
    const ABYSS_END_HOUR = 21;
    const ABYSS_END_BUFFER_MS = 15000;

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
        charProgress: {},
        changeSets: false,
        profSets: { h: '0', b: '0', m: '0', p: '0', w: '0', t: '0' }
    };

    let currentSettings = { ...DEFAULT_SETTINGS };
    let uiWindowElement = null;
    let isRunning = false;
    let wsHooked = false;
    let originalParseJSON = null;
    let pendingPenaltyPoints = null;
    let charListTimerInterval = null;

    const getWarsawNow = () => {
        const now = new Date();
        return new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Warsaw' }));
    };

    const getAbyssEndTimestamp = () => {
        const now = new Date();
        const warsawNow = getWarsawNow();
        const offsetMs = now.getTime() - warsawNow.getTime();
        const end = new Date(warsawNow);
        end.setHours(ABYSS_END_HOUR, 0, 0, 0);
        if (warsawNow.getHours() >= ABYSS_END_HOUR) end.setDate(end.getDate() + 1);
        return end.getTime() + offsetMs;
    };

    const isAbyssOpen = () => getWarsawNow().getHours() < ABYSS_END_HOUR;

    const isAbyssStillPlayable = () => getAbyssEndTimestamp() - Date.now() > ABYSS_END_BUFFER_MS;

    const parsePenaltyFromMsg = (msg, evSeconds) => {
        const match = msg.match(/kara\s*-\s*(\d{4}-\d{2}-\d{2})\s+(\d{2}):(\d{2})/);
        if (!match) return null;
        const [, datePart, hStr, mStr] = match;
        const [y, mo, d] = datePart.split('-').map(Number);
        const evMs = evSeconds * 1000;
        const evDate = new Date(evMs);
        const warsawEv = new Date(evDate.toLocaleString('en-US', { timeZone: 'Europe/Warsaw' }));
        const offsetMs = evDate.getTime() - warsawEv.getTime();
        const penaltyEndWarsaw = new Date(y, mo - 1, d, parseInt(hStr), parseInt(mStr), 0, 0);
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

    const saveCharProgress = (charId) => {
        if (!charId) return;
        if (!currentSettings.charProgress) currentSettings.charProgress = {};
        const allStages = document.querySelectorAll('.matchmaking-progress-stage');
        if (!allStages.length) return;

        let currentStage = 'Etap I';
        let currentRatio = '0/6';

        for (const el of allStages) {
            const stageText = el.querySelector('.stage')?.textContent.trim();
            const ratioText = el.querySelector('.ratio')?.textContent.trim();
            if (!stageText || !ratioText) continue;
            const wins = parseInt(ratioText.split('/')[0]) || 0;
            if (wins > 0 || stageText === 'Etap I') {
                currentStage = stageText;
                currentRatio = ratioText;
            }
        }

        currentSettings.charProgress[charId] = {
            stage: currentStage,
            ratio: currentRatio,
            updatedAt: new Date().toISOString()
        };
        saveSettings();
        renderCharList();
    };

    const getCharProgress = (charId) => currentSettings.charProgress?.[charId] || null;

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
                    } else {
                        console.warn('[OTCH] Nie udało się sparsować czasu kary z msg:', msg);
                    }
                    pendingPenaltyPoints = null;
                }
            }
        }
    };

    const markCharFinished = (charId) => {
        if (!charId) return;
        currentSettings.lastFinishedChars[charId] = new Date().toDateString();
        saveSettings();
    };

    const stopAutomation = () => {
        isRunning = false;
        const el = document.getElementById('otch-auto-btn');
        if (el) {
            el.classList.remove('active', 'baddonz-state-button--active');
            currentSettings.autoAbyss = false;
            saveSettings();
        }
    };

    const wait = (ms) => new Promise(r => setTimeout(r, ms));

    function loadSettings() {
        if (!window.BaddonzAPI) return;
        const saved = window.BaddonzAPI.getAddonSettings(ADDON_ID);
        currentSettings = { ...DEFAULT_SETTINGS, ...saved };
        if (!currentSettings.profSets) currentSettings.profSets = { ...DEFAULT_SETTINGS.profSets };
        if (!currentSettings.charPenalties) currentSettings.charPenalties = {};
        if (!currentSettings.lastFinishedChars) currentSettings.lastFinishedChars = {};
        if (!currentSettings.charProgress) currentSettings.charProgress = {};
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

    const performDailyResetCheck = () => {
        const todayKey = new Date().toDateString();
        if (currentSettings.lastResetDate !== todayKey) {
            currentSettings.lastFinishedChars = {};
            currentSettings.charPenalties = {};
            currentSettings.charProgress = {};
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
        let penaltyWaitCandidate = null;
        for (const c of chars) {
            if (c.id === d.currentId) continue;
            if (currentSettings.lastFinishedChars[c.id] === todayKey) continue;
            const penalty = getPenaltyForChar(c.id);
            if (!penalty) return { charId: c.id, nick: c.nick || c.id, reason: 'normal' };
            if (penalty < abyssEnd && !penaltyWaitCandidate) {
                penaltyWaitCandidate = { charId: c.id, nick: c.nick || c.id, penaltyUntil: penalty, reason: 'penalty_wait' };
            }
        }
        return penaltyWaitCandidate || null;
    };

    const allCharsFinished = () => {
        const d = fetchGameData();
        if (!d) return false;
        const todayKey = new Date().toDateString();
        const chars = d.charList.filter(c => c.world === d.world);
        for (const c of chars) {
            if (currentSettings.lastFinishedChars[c.id] !== todayKey) {
                const penalty = getPenaltyForChar(c.id);
                if (!penalty || penalty < getAbyssEndTimestamp()) return false;
            }
        }
        return true;
    };

    const switchToChar = async (charId, markPrev = true) => {
        const prevId = getCurrentCharId();
        window.Engine.changePlayer.changePlayerRequest(charId);
        for (let i = 0; i < 3; i++) {
            await wait(6000);
            if (window.Engine?.hero?.d?.id === charId) {
                if (markPrev) markCharFinished(prevId);
                return true;
            }
            window.Engine.changePlayer.changePlayerRequest(charId);
        }
        return false;
    };

    const handleSwitchAfterFinish = async () => {
        if (!currentSettings.autoSwitch) return false;
        const next = pickNextChar();
        if (!next) return false;
        if (next.reason === 'penalty_wait') {
            const waitMs = next.penaltyUntil - Date.now();
            if (waitMs > 0) await wait(waitMs + 5000);
        }
        return await switchToChar(next.charId, true);
    };

    const checkAbyssCompletion = async () => {
        const allStages = document.querySelectorAll('.matchmaking-progress-stage');
        if (!allStages.length) return false;
        const charId = getCurrentCharId();
        if (charId) saveCharProgress(charId);
        let stage4El = null;
        for (const el of allStages) {
            const stageText = el.querySelector('.stage')?.textContent.trim();
            if (stageText === 'Etap IV') { stage4El = el; break; }
        }
        if (!stage4El || stage4El.offsetParent === null) return false;
        const ratio = stage4El.querySelector('.ratio')?.textContent.trim();
        if (ratio !== '15/15') return false;
        if (currentSettings.collectChests) {
            window._g('match&a=collect');
            await wait(1000);
        }
        markCharFinished(getCurrentCharId());
        if (currentSettings.stopOnMaxStage) { stopAutomation(); return true; }
        if (currentSettings.autoSwitch) {
            const switched = await handleSwitchAfterFinish();
            if (!switched && allCharsFinished()) { stopAutomation(); return true; }
            return true;
        }
        stopAutomation();
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
        const autoAbyssEl = document.getElementById('otch-auto-btn');
        if (!autoAbyssEl || !currentSettings.enabled) return;
        isRunning = true;

        while (autoAbyssEl.classList.contains('active') && isRunning) {
            await wait(250);
            if (await checkAbyssCompletion()) { isRunning = false; return; }

            const penalty = getPenaltyForChar(getCurrentCharId());
            if (penalty) {
                const abyssEnd = getAbyssEndTimestamp();
                if (penalty >= abyssEnd) {
                    markCharFinished(getCurrentCharId());
                    if (currentSettings.autoSwitch) {
                        const next = pickNextChar();
                        if (next) { await switchToChar(next.charId, false); continue; }
                    }
                    stopAutomation();
                    return;
                }
                if (currentSettings.autoSwitch) {
                    const next = pickNextChar();
                    if (next && next.reason === 'normal') { await switchToChar(next.charId, false); continue; }
                }
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
                if (!await waitForOpponentAccept()) { await wait(1500); continue; }

                const changeSetsEl = document.getElementById('otch-changesets-btn');
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
                    if (!isAbyssStillPlayable()) { stopAutomation(); return; }
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

    const formatTimer = (ms) => {
        if (ms <= 0) return null;
        const totalSec = Math.ceil(ms / 1000);
        const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
        const s = (totalSec % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const renderCharList = () => {
        if (!uiWindowElement) return;
        const container = uiWindowElement.querySelector('#otch-char-list');
        if (!container) return;

        const d = fetchGameData();
        if (!d) { container.innerHTML = ''; return; }

        const todayKey = new Date().toDateString();
        let chars = d.charList.filter(c => c.world === d.world);
        chars.sort((a, b) => b.lvl - a.lvl);

        let html = '';
        for (const c of chars) {
            const isCurrent = c.id === d.currentId;
            const progress = getCharProgress(c.id);
            const penalty = getPenaltyForChar(c.id);
            const finished = currentSettings.lastFinishedChars[c.id] === todayKey;

            let progressText = progress ? `${progress.stage} ${progress.ratio}` : 'brak danych';
            if (finished && progress?.ratio === '15/15') progressText = `${progress.stage} ${progress.ratio}`;

            let penaltyHtml = '';
            if (penalty) {
                const remaining = penalty - Date.now();
                const timerStr = formatTimer(remaining);
                if (timerStr) {
                    penaltyHtml = `, <span class="otch-penalty-timer" data-penalty-ts="${penalty}" style="color:#e05050;">Kara: ${timerStr}</span>`;
                }
            }

            const nickStyle = isCurrent ? 'color:#f0c040;font-weight:bold;' : 'color:#ccc;';
            html += `<div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">` +
                `<span style="${nickStyle}max-width:80px;display:inline-block;overflow:hidden;text-overflow:ellipsis;vertical-align:bottom;">${c.nick || c.id}</span>` +
                ` <span style="color:#888;">- ${progressText}</span>${penaltyHtml}` +
                `</div>`;
        }

        container.innerHTML = html;
    };

    const startCharListTimer = () => {
        if (charListTimerInterval) clearInterval(charListTimerInterval);
        charListTimerInterval = setInterval(() => {
            if (!uiWindowElement) return;
            const timers = uiWindowElement.querySelectorAll('.otch-penalty-timer');
            let needsRender = false;
            for (const el of timers) {
                const ts = parseInt(el.dataset.penaltyTs);
                const remaining = ts - Date.now();
                const timerStr = formatTimer(remaining);
                if (!timerStr) {
                    needsRender = true;
                    break;
                }
                el.textContent = `Kara: ${timerStr}`;
            }
            if (needsRender) renderCharList();
        }, 1000);
    };

    let populateInterval = null;

    function buildUI() {
        const bodyHtml = `
            <div class="baddonz-setting-row">
                <div class="baddonz-checkbox ${currentSettings.collectChests ? 'active' : ''}" id="otch-collect-chests"></div>
                <span class="baddonz-text" style="padding:0;">Odbieraj skrzynki</span>
            </div>
            <div class="baddonz-setting-row">
                <div class="baddonz-checkbox ${currentSettings.stopOnMaxStage ? 'active' : ''}" id="otch-stop-max"></div>
                <span class="baddonz-text" style="padding:0;">Zatrzymuj na Etapie IV</span>
            </div>
            <div class="baddonz-setting-row">
                <div class="baddonz-checkbox ${currentSettings.autoSwitch ? 'active' : ''}" id="otch-auto-switch"></div>
                <span class="baddonz-text" style="padding:0;">Przelogowywanie</span>
            </div>
            <div class="baddonz-setting-row">
                <div class="baddonz-checkbox ${currentSettings.autoF ? 'active' : ''}" id="otch-auto-f"></div>
                <span class="baddonz-text" style="padding:0;">AutoF</span>
            </div>
            <hr style="width:100%;border-color:#303030;margin:5px 0;">
            <div class="baddonz-setting-row">
                <div class="baddonz-checkbox ${currentSettings.changeSets ? 'active' : ''}" id="otch-changesets-btn"></div>
                <span class="baddonz-text" style="padding:0;">Zmieniaj Zestawy</span>
            </div>
            <div id="otch-set-config" class="baddonz-flex column" style="gap:3px;display:${currentSettings.changeSets ? 'flex' : 'none'};padding:0 5px;">
                ${['h:Łowca','b:Tancerz Ostrzy','m:Mag','p:Paladyn','w:Wojownik','t:Tropiciel'].map(s => {
                    const [key, label] = s.split(':');
                    return `<div class="baddonz-label-wrapper" style="justify-content:space-between;align-items:center;">
                        <div class="baddonz-text" style="padding:0;min-width:90px;">${label}</div>
                        <select class="baddonz-input baddonz-select" id="otch-set-${key}" style="flex-grow:1;"></select>
                    </div>`;
                }).join('')}
            </div>
            <hr style="width:100%;border-color:#303030;margin:5px 0;">
            <div id="otch-char-list" style="font-size:10px;line-height:1.6;"></div>
        `;

        uiWindowElement = window.BaddonzAPI.createAddonWindow(ADDON_ID, 'Auto Otchłań', bodyHtml, {
            width: '240px',
            customId: 'baddonz-otch-wnd',
            hasSettings: false,
            hasCollapse: false
        });

        const leftControls = uiWindowElement.querySelector('.baddonz-window-controls.left');
        if (leftControls) {
            const autoBtn = document.createElement('div');
            autoBtn.id = 'otch-auto-btn';
            autoBtn.className = 'baddonz-state-button';
            if (currentSettings.autoAbyss) autoBtn.classList.add('active', 'baddonz-state-button--active');
            if (typeof $ === 'function' && typeof $.fn.tip === 'function') {
                $(autoBtn).tip(currentSettings.autoAbyss ? 'Włączony' : 'Wyłączony');
            }
            leftControls.appendChild(autoBtn);

            autoBtn.addEventListener('click', () => {
                if (!currentSettings.enabled) return;
                const newState = !autoBtn.classList.contains('active');
                autoBtn.classList.toggle('active', newState);
                autoBtn.classList.toggle('baddonz-state-button--active', newState);
                if (typeof $ === 'function' && typeof $.fn.tip === 'function') {
                    $(autoBtn).tip(newState ? 'Włączony' : 'Wyłączony');
                }
                currentSettings.autoAbyss = newState;
                saveSettings();
                if (newState) runAbyssAutomation();
                else isRunning = false;
            });
        }

        const get = (id) => uiWindowElement.querySelector(`#${id}`);

        const collectChestsEl = get('otch-collect-chests');
        const stopOnMaxEl     = get('otch-stop-max');
        const changeSetsEl    = get('otch-changesets-btn');
        const setConfigEl     = get('otch-set-config');
        const autoSwitchEl    = get('otch-auto-switch');
        const autoFEl         = get('otch-auto-f');

        const setSelects = {
            h: get('otch-set-h'), b: get('otch-set-b'), m: get('otch-set-m'),
            p: get('otch-set-p'), w: get('otch-set-w'), t: get('otch-set-t')
        };

        if (typeof $ === 'function' && typeof $.fn.tip === 'function') {
            $(collectChestsEl).tip('Automatyczne odbieranie skrzynek');
            $(stopOnMaxEl).tip('Zatrzymuje dodatek gdy skończy Etap IV');
            $(autoSwitchEl).tip('Przelogowywanie postaci po skończeniu Etapu IV');
        }

        collectChestsEl.addEventListener('click', () => { currentSettings.collectChests = collectChestsEl.classList.toggle('active'); saveSettings(); });
        stopOnMaxEl.addEventListener('click',     () => { currentSettings.stopOnMaxStage = stopOnMaxEl.classList.toggle('active'); saveSettings(); });
        autoSwitchEl.addEventListener('click',    () => { currentSettings.autoSwitch = autoSwitchEl.classList.toggle('active'); saveSettings(); });
        autoFEl.addEventListener('click',         () => { currentSettings.autoF = autoFEl.classList.toggle('active'); saveSettings(); });

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

        renderCharList();
        startCharListTimer();
        setInterval(() => renderCharList(), 15000);
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
        if (charListTimerInterval) { clearInterval(charListTimerInterval); charListTimerInterval = null; }
        if (uiWindowElement) { uiWindowElement.remove(); uiWindowElement = null; }
    }

    function onStateToggle(isEnabled) {
        currentSettings.enabled = isEnabled;
        if (!isEnabled) {
            isRunning = false;
            const el = document.getElementById('otch-auto-btn');
            if (el) {
                el.classList.remove('active', 'baddonz-state-button--active');
                currentSettings.autoAbyss = false;
                saveSettings();
            }
        }
    }

    const checkApi = () => {
        if (!window.BaddonzAPI?.registerAddon) { setTimeout(checkApi, 500); return; }
        window.BaddonzAPI.registerAddon(ADDON_ID, { init: addonInit, stop: addonStop, onStateToggle });
    };

    checkApi();
})();
