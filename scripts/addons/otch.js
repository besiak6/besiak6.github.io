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

    async function wait(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    const log = (...args) => console.log('%c[Auto Otchłań]', 'color:#4CAF50;font-weight:bold;', ...args);
    const invokeClickHandler = (el) => {
        if (!el) return false;
        try {
            if (typeof $ === 'function') {
                const events = $._data(el, 'events');
                const handler = events?.click?.[0]?.handler;
                if (handler) {
                    handler.call(el, $.Event('click'));
                    return true;
                }
            }
        } catch (e) {
            log('invokeClickHandler - nie udało się pobrać handlera:', e);
        }
        return false;
    };

    function loadSettings() {
        if (!window.BaddonzAPI) return;
        const saved = window.BaddonzAPI.getAddonSettings(ADDON_ID);
        currentSettings = { ...DEFAULT_SETTINGS, ...saved };
        if (!currentSettings.profSets) {
            currentSettings.profSets = { ...DEFAULT_SETTINGS.profSets };
        }
    }

    function saveSettings() {
        if (!window.BaddonzAPI) return;
        window.BaddonzAPI.saveAddonSettings(ADDON_ID, { ...currentSettings }, CHAR_SPECIFIC_KEYS);
    }

    const fetchGameData = () => {
        if (!window.Engine || !window.Engine.changePlayer || !window.Engine.hero) {
            return null;
        }
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
        const captchaWindow = document.querySelector('.captcha-window');
        return captchaWindow && captchaWindow.offsetParent !== null && captchaWindow.querySelector('.header-label .text')?.textContent === 'Zagadka';
    };

    const updateAutoAbyssState = (isActive, autoAbyssEl) => {
        if (isActive) {
            autoAbyssEl.classList.add("active");
            autoAbyssEl.classList.add("baddonz-state-button--active");
            if (typeof $ === 'function' && typeof $.fn.tip === 'function') {
                $(autoAbyssEl).tip('Włączony');
            }
        } else {
            autoAbyssEl.classList.remove("active");
            autoAbyssEl.classList.remove("baddonz-state-button--active");
            if (typeof $ === 'function' && typeof $.fn.tip === 'function') {
                $(autoAbyssEl).tip('Wyłączony');
            }
        }
    };

    const performDailyResetCheck = () => {
        const todayKey = new Date().toDateString();
        if (currentSettings.lastResetDate !== todayKey) {
            log('Nowy dzień - czyszczę listę postaci oznaczonych jako "skończone".');
            currentSettings.lastFinishedChars = {};
            currentSettings.lastResetDate = todayKey;
            saveSettings();
        }
    };

    const startCharacterSwitch = async () => {
        performDailyResetCheck();
        let d = fetchGameData();
        if (!d || !currentSettings.autoSwitch) {
            return;
        }

        let chars = d.charList.filter(char => char.world === d.world);
        log(`Wykryte postacie na koncie (świat ${d.world}):`,
            chars.map(c => `${c.nick || c.id} (lvl ${c.lvl})`));

        if (chars.length <= 1) {
            log('Tylko jedna postać na tym świecie - nie ma na co przełączyć.');
            return;
        }

        chars.sort((a, b) => b.lvl - a.lvl);
        log('Kolejność przelogowywania (od najwyższego levelu):',
            chars.map(c => c.nick || c.id));

        const currentIdx = chars.findIndex(char => char.id === d.currentId);
        if (currentIdx === -1) {
            log('Aktualna postać nie znaleziona na liście - przerywam.');
            return;
        }

        let nextCharToSwitch = null;
        const todayKey = new Date().toDateString();

        for (let i = 1; i < chars.length; i++) {
            const nextIdx = (currentIdx + i) % chars.length;
            const nextChar = chars[nextIdx];

            if (nextChar.id !== d.currentId &&
                currentSettings.lastFinishedChars[nextChar.id] !== todayKey) {
                nextCharToSwitch = nextChar;
                break;
            }
        }

        if (nextCharToSwitch) {
            const nextCharId = nextCharToSwitch.id;
            const previousCharId = d.currentId;
            log(`Przełączam z postaci ${previousCharId} na ${nextCharToSwitch.nick || nextCharId}.`);

            let isSwitched = false;
            let attempts = 0;
            const maxWaitTime = 18000;
            const checkInterval = 6000;
            window.Engine.changePlayer.changePlayerRequest(nextCharId);

            while (!isSwitched && attempts * checkInterval < maxWaitTime) {
                await wait(checkInterval);
                const heroIdOnPage = window.Engine?.hero?.d?.id;

                if (heroIdOnPage === nextCharId) {
                    isSwitched = true;
                    log(`Przełączono pomyślnie na postać ${nextCharId}. Oznaczam poprzednią (${previousCharId}) jako skończoną na dziś.`);
                    currentSettings.lastFinishedChars[previousCharId] = todayKey;
                    saveSettings();
                    break;
                } else if (heroIdOnPage && heroIdOnPage !== nextCharId) {
                    log('Przełączenie się nie powiodło - ponawiam żądanie.');
                    window.Engine.changePlayer.changePlayerRequest(nextCharId);
                    attempts++;
                } else {
                    attempts++;
                }
            }

            if (!isSwitched) {
                log('Nie udało się przełączyć postaci w wyznaczonym czasie.');
            }
        } else {
            log('Brak dostępnej postaci do przełączenia (wszystkie już skończone na dziś).');
        }
    };

    const collectRewards = () => {
        window._g('match&a=collect');
    };

    const checkAbyssCompletion = async () => {
        const progressStageDiv = document.querySelector(".matchmaking-progress-stage");
        const autoAbyssEl = document.getElementById("autoAbyss");
        if (!autoAbyssEl) return false;

        if (progressStageDiv && progressStageDiv.offsetParent !== null) {
            const stageElement = progressStageDiv.querySelector(".stage");
            const ratioElement = progressStageDiv.querySelector(".ratio");

            if (stageElement && ratioElement) {
                const stageText = stageElement.textContent.trim();
                const ratioText = ratioElement.textContent.trim();

                if (stageText === "Etap IV" && ratioText === "15/15") {
                    log('Osiągnięto maksymalny etap (Etap IV, 15/15).');

                    if (currentSettings.collectChests) {
                        log('Odbieram skrzynki.');
                        collectRewards();
                        await wait(1000);
                    }

                    const shouldStopGlobally = currentSettings.stopOnMaxStage;
                    const shouldAutoSwitch = currentSettings.autoSwitch;

                    if (shouldStopGlobally) {
                        log('Ustawienie "Zatrzymuj" aktywne - wyłączam Auto Otchłań na tej postaci.');
                        updateAutoAbyssState(false, autoAbyssEl);
                        currentSettings.autoAbyss = false;
                        saveSettings();

                        if (shouldAutoSwitch) {
                            log('Przelogowywanie aktywne - szukam kolejnej postaci.');
                            startCharacterSwitch();
                        }
                    } else if (shouldAutoSwitch) {
                        log('Max etap osiągnięty, przelogowywanie aktywne - szukam kolejnej postaci.');
                        startCharacterSwitch();
                    } else {
                        log('Max etap osiągnięty, brak przelogowywania - wyłączam Auto Otchłań.');
                        updateAutoAbyssState(false, autoAbyssEl);
                        currentSettings.autoAbyss = false;
                        saveSettings();
                    }

                    return true;
                }
            }
        }
        return false;
    };

    const waitForOpponentAccept = async () => {
        const maxWaitTime = 5000;
        let elapsedTime = 0;
        const checkInterval = 250;

        while ((!document.querySelector(".choose-eq") || document.querySelector(".choose-eq").offsetParent === null) && elapsedTime < maxWaitTime) {
            await wait(checkInterval);
            elapsedTime += checkInterval;
        }

        return document.querySelector(".choose-eq") && document.querySelector(".choose-eq").offsetParent !== null;
    };

    const handleAlerts = async () => {
        const warningContent = document.querySelector('.alert-content .inner-content');
        const okButton = document.querySelector('.alert-content .button.alert-accept-hotkey');

        if (warningContent && warningContent.offsetParent !== null && okButton && okButton.offsetParent !== null) {
            if (warningContent.textContent.includes('Punkt ostrzeżenia dodany!')) {
                log('Wykryto alert "Punkt ostrzeżenia dodany!" - zamykam.');
                if (!invokeClickHandler(okButton)) {
                    log('Nie udało się wywołać handlera bezpośrednio - pomijam zamknięcie, spróbuję ponownie w kolejnej pętli.');
                    return false;
                }
                await wait(500);
                return true;
            }
        }
        return false;
    };

    const waitForBattleToStart = async () => {
        while (!window.Engine || !window.Engine.battle || !window.Engine.battle.show) {
            await wait(500);
            if (!isRunning) return;
        }
    };

    const waitForBattleToFinish = async () => {
        while (!window.Engine || !window.Engine.battle || !window.Engine.battle.endBattle) {
            await wait(500);
            if (!isRunning) return;
        }
    };

    const fetchOpponentProfessionKey = async () => {
        let attempts = 0;
        const maxAttempts = 30;
        const sleepTime = 250;
        const profClassMap = {
            'hidden-prof--h': 'h', 'hidden-prof--b': 'b', 'hidden-prof--m': 'm',
            'hidden-prof--p': 'p', 'hidden-prof--w': 'w', 'hidden-prof--t': 't'
        };
        while (attempts < maxAttempts) {
            const opponentInfoDiv = document.querySelector(".opponent-info");
            if (opponentInfoDiv && opponentInfoDiv.offsetParent !== null) {
                const opponentAvatar = opponentInfoDiv.querySelector(".avatar-icon");
                if (opponentAvatar) {
                    for (const className in profClassMap) {
                        if (opponentAvatar.classList.contains(className)) {
                            return profClassMap[className];
                        }
                    }
                }
                const levelRatingElement = opponentInfoDiv.querySelector(".level-rating");
                if (levelRatingElement) {
                    const profName = levelRatingElement.textContent.trim();
                    switch (profName) {
                        case 'Łowca': return 'h';
                        case 'Tancerz Ostrzy': return 'b';
                        case 'Mag': return 'm';
                        case 'Paladyn': return 'p';
                        case 'Wojownik': return 'w';
                        case 'Tropiciel': return 't';
                    }
                }
            }
            await wait(sleepTime);
            attempts++;
        }
        return null;
    };

    async function runAbyssAutomation() {
        const autoAbyssEl = document.getElementById("autoAbyss");
        const changeSetsEl = document.getElementById("changeSets");
        if (!autoAbyssEl) return;

        if (!currentSettings.enabled) return;

        isRunning = true;

        while (autoAbyssEl.classList.contains("active") && isRunning) {
            await wait(250);
            if (await checkAbyssCompletion()) {
                isRunning = false;
                return;
            }

            if (await handleAlerts()) {
                await wait(1000);
                continue;
            }

            let foundOpponentTimer = document.querySelector("#matchmaking-timer");
            let isOpponentPromptVisible = foundOpponentTimer && foundOpponentTimer.offsetParent !== null;

            if (isOpponentPromptVisible) {
                if (isCaptchaVisible()) {
                    while (isCaptchaVisible()) {
                        await wait(1000);
                        if (!autoAbyssEl.classList.contains("active") || !isRunning) { isRunning = false; return; }
                    }
                    await wait(500);
                    continue;
                }

                log('Znalazłem przeciwnika - akceptuję.');
                window._g("match&a=accept_opp&ans=1");
                const acceptedSuccessfully = await waitForOpponentAccept();

                if (!acceptedSuccessfully) {
                    log('Akceptacja przeciwnika nie powiodła się (okno wyboru EQ nie pojawiło się) - ponawiam.');
                    await wait(1500);
                    continue;
                }

                if (changeSetsEl && changeSetsEl.classList.contains("active")) {
                    let opponentProfKey = null;
                    let changeSetAttempts = 0;
                    const maxChangeSetAttempts = 30;
                    const changeSetSleepTime = 250;
                    while (opponentProfKey === null && changeSetAttempts < maxChangeSetAttempts) {
                        opponentProfKey = await fetchOpponentProfessionKey();
                        if (opponentProfKey === null) {
                            await wait(changeSetSleepTime);
                        }
                        changeSetAttempts++;
                    }

                    if (opponentProfKey) {
                        log(`Profesja przeciwnika: ${opponentProfKey}`);
                        const profSets = currentSettings.profSets || {};
                        const setId = profSets[opponentProfKey];
                        log(`Przypisany zestaw dla tej profesji: ${setId || '(brak)'}`);

                        let buildsCommons = null;
                        if (window.Engine && window.Engine.buildsManager) {
                            buildsCommons = window.Engine.buildsManager.getBuildsCommons();
                        }

                        if (buildsCommons) {
                            const currentSetId = buildsCommons.getCurrentId();
                            if (setId && setId !== "0" && setId != currentSetId) {
                                log(`Zmieniam zestaw z ${currentSetId} na ${setId}.`);
                                window._g(`builds&action=updateCurrent&id=${setId}`);
                                await wait(750);
                            } else {
                                log('Zestaw nie wymaga zmiany.');
                            }
                        }
                    } else {
                        log('Nie udało się wykryć profesji przeciwnika w wyznaczonym czasie.');
                    }
                }

                window._g("match&a=prepared");
                await waitForBattleToStart();
                if (!isRunning) return;
                log('Jestem w walce.');

                if (currentSettings.autoF) {
                    window._g("fight&a=f");
                }

                await waitForBattleToFinish();
                if (!isRunning) return;
                log('Skończyłem walkę.');

                window._g("fight&a=exit");
                await wait(250);

                if (await checkAbyssCompletion()) {
                    isRunning = false;
                    return;
                }

                await wait(2000);
                if (await checkAbyssCompletion()) {
                    isRunning = false;
                    return;
                }

                if (autoAbyssEl.classList.contains("active")) {
                    window._g("fight&a=nextmatch");
                    await wait(500);
                } else {
                    isRunning = false;
                    return;
                }

            } else {
                let isInQueue = document.querySelector(".matchmaking-timer") && document.querySelector(".matchmaking-timer").offsetParent !== null;
                if (!isInQueue && !isCaptchaVisible()) {
                    if (await checkAbyssCompletion()) {
                        isRunning = false;
                        return;
                    }

                    await wait(2000);
                    if (autoAbyssEl.classList.contains("active")) {
                        log('Zapisuję się do kolejki.');
                        window._g("match&a=signin");
                        await wait(500);
                    } else {
                        isRunning = false;
                        return;
                    }
                } else if (isInQueue || isCaptchaVisible()) {
                    await wait(1000);
                }
            }
        }

        isRunning = false;
    }

    const populateBuilds = async (setSelects) => {
        let buildsCommons = null;
        let attempts = 0;
        const maxAttempts = 10;
        while (!buildsCommons && attempts < maxAttempts) {
            if (window.Engine && window.Engine.buildsManager) {
                buildsCommons = window.Engine.buildsManager.getBuildsCommons();
            }
            if (!buildsCommons) {
                await wait(500);
                attempts++;
            }
        }

        if (!buildsCommons) return;
        const allBuilds = buildsCommons.getBuildsName();
        const optionsHtml = ['<option value="0">Brak</option>'];

        for (const id in allBuilds) {
            if (allBuilds.hasOwnProperty(id) && allBuilds[id] && allBuilds[id].name) {
                let displayName = allBuilds[id].name;
                if (allBuilds[id].name.startsWith('[SET.')) {
                    displayName = id;
                }
                optionsHtml.push(`<option value="${id}">${displayName}</option>`);
            } else if (allBuilds.hasOwnProperty(id) && allBuilds[id] === null) {
                optionsHtml.push(`<option value="${id}">[Anonimowy Zestaw ${id}]</option>`);
            }
        }

        const allOptions = optionsHtml.join('');
        const savedProfSets = currentSettings.profSets || {};

        for (const profKey in setSelects) {
            if (setSelects.hasOwnProperty(profKey) && setSelects[profKey]) {
                const currentSelectedValue = setSelects[profKey].value;

                setSelects[profKey].innerHTML = allOptions;

                const savedValue = savedProfSets[profKey] || "0";
                const optionExists = Array.from(setSelects[profKey].options).some(opt => opt.value === savedValue);

                if (optionExists) {
                    setSelects[profKey].value = savedValue;
                    currentSettings.profSets[profKey] = savedValue;
                } else if (currentSelectedValue !== "0" && Array.from(setSelects[profKey].options).some(opt => opt.value === currentSelectedValue)) {
                    setSelects[profKey].value = currentSelectedValue;
                    currentSettings.profSets[profKey] = currentSelectedValue;
                } else {
                    setSelects[profKey].value = "0";
                    currentSettings.profSets[profKey] = "0";
                }
            }
        }
        saveSettings();
    };

    let populateInterval = null;

    function buildUI() {
        const bodyHtml = `
            <div class="baddonz-setting-row" style="margin-bottom: 4px !important; display: flex; align-items: center;">
                <div class="baddonz-state-button ${currentSettings.autoAbyss ? 'active baddonz-state-button--active' : ''}" id="autoAbyss"></div>
                <span class="baddonz-text" style="padding: 0; margin-left: 5px;">Auto Otchłań</span>
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

            <hr style="width: 100%; border-color: #303030; margin: 5px 0;">

            <div class="baddonz-setting-row">
                <div class="baddonz-checkbox ${currentSettings.changeSets ? 'active' : ''}" id="changeSets"></div>
                <span class="baddonz-text" style="padding: 0;">Zmieniaj Zestawy</span>
            </div>

            <div id="set-change-config" class="baddonz-flex column" style="gap: 3px; display: ${currentSettings.changeSets ? 'flex' : 'none'}; padding: 0 5px;">
                <div class="baddonz-label-wrapper" style="justify-content: space-between; align-items: center;">
                    <div class="baddonz-text" style="padding: 0; min-width: 90px;">Łowca</div>
                    <select class="baddonz-input baddonz-select" id="set-h" style="flex-grow: 1;"></select>
                </div>
                <div class="baddonz-label-wrapper" style="justify-content: space-between; align-items: center;">
                    <div class="baddonz-text" style="padding: 0; min-width: 90px;">Tancerz Ostrzy</div>
                    <select class="baddonz-input baddonz-select" id="set-b" style="flex-grow: 1;"></select>
                </div>
                <div class="baddonz-label-wrapper" style="justify-content: space-between; align-items: center;">
                    <div class="baddonz-text" style="padding: 0; min-width: 90px;">Mag</div>
                    <select class="baddonz-input baddonz-select" id="set-m" style="flex-grow: 1;"></select>
                </div>
                <div class="baddonz-label-wrapper" style="justify-content: space-between; align-items: center;">
                    <div class="baddonz-text" style="padding: 0; min-width: 90px;">Paladyn</div>
                    <select class="baddonz-input baddonz-select" id="set-p" style="flex-grow: 1;"></select>
                </div>
                <div class="baddonz-label-wrapper" style="justify-content: space-between; align-items: center;">
                    <div class="baddonz-text" style="padding: 0; min-width: 90px;">Wojownik</div>
                    <select class="baddonz-input baddonz-select" id="set-w" style="flex-grow: 1;"></select>
                </div>
                <div class="baddonz-label-wrapper" style="justify-content: space-between; align-items: center;">
                    <div class="baddonz-text" style="padding: 0; min-width: 90px;">Tropiciel</div>
                    <select class="baddonz-input baddonz-select" id="set-t" style="flex-grow: 1;"></select>
                </div>
            </div>
        `;

        uiWindowElement = window.BaddonzAPI.createAddonWindow(ADDON_ID, "Auto Otchłań", bodyHtml, {
            width: '210px',
            customId: 'baddonz-otch-wnd',
            hasSettings: false,
            hasCollapse: false
        });

        const autoAbyssEl = uiWindowElement.querySelector("#autoAbyss");
        const collectChestsEl = uiWindowElement.querySelector("#collectChests");
        const stopOnMaxStageEl = uiWindowElement.querySelector("#stopOnMaxStage");
        const changeSetsEl = uiWindowElement.querySelector("#changeSets");
        const setChangeConfigEl = uiWindowElement.querySelector("#set-change-config");
        const autoSwitchEl = uiWindowElement.querySelector("#autoSwitch");
        const autoFEl = uiWindowElement.querySelector("#autoF");

        const setSelects = {
            h: uiWindowElement.querySelector("#set-h"),
            b: uiWindowElement.querySelector("#set-b"),
            m: uiWindowElement.querySelector("#set-m"),
            p: uiWindowElement.querySelector("#set-p"),
            w: uiWindowElement.querySelector("#set-w"),
            t: uiWindowElement.querySelector("#set-t")
        };

        if (typeof $ === 'function' && typeof $.fn.tip === 'function') {
            $(collectChestsEl).tip('Automatyczne odbieranie skrzynek gdy Etap IV (15/15)');
            $(stopOnMaxStageEl).tip('Zatrzymuje dodatek po osiągnięciu Etapu IV (15/15)');
            $(changeSetsEl).tip('Zmieniaj zestawy w zależności od profesji przeciwnika');
            $(autoSwitchEl).tip('Automatyczne przelogowywanie postaci po ukończeniu Otchłani');
        }

        updateAutoAbyssState(currentSettings.autoAbyss, autoAbyssEl);

        autoAbyssEl.addEventListener('click', () => {
            if (!currentSettings.enabled) return;
            const newState = !autoAbyssEl.classList.contains("active");
            updateAutoAbyssState(newState, autoAbyssEl);
            currentSettings.autoAbyss = newState;
            saveSettings();
            if (newState) {
                runAbyssAutomation();
            } else {
                isRunning = false;
            }
        });

        collectChestsEl.addEventListener('click', () => {
            currentSettings.collectChests = collectChestsEl.classList.toggle("active");
            saveSettings();
        });

        stopOnMaxStageEl.addEventListener('click', () => {
            currentSettings.stopOnMaxStage = stopOnMaxStageEl.classList.toggle("active");
            saveSettings();
        });

        changeSetsEl.addEventListener('click', () => {
            currentSettings.changeSets = changeSetsEl.classList.toggle("active");
            setChangeConfigEl.style.display = currentSettings.changeSets ? 'flex' : 'none';
            saveSettings();
        });

        autoSwitchEl.addEventListener('click', () => {
            currentSettings.autoSwitch = autoSwitchEl.classList.toggle("active");
            saveSettings();
        });

        autoFEl.addEventListener('click', () => {
            currentSettings.autoF = autoFEl.classList.toggle("active");
            saveSettings();
        });

        for (const profKey in setSelects) {
            if (setSelects.hasOwnProperty(profKey) && setSelects[profKey]) {
                setSelects[profKey].addEventListener('change', () => {
                    currentSettings.profSets[profKey] = setSelects[profKey].value;
                    saveSettings();
                });
            }
        }

        populateBuilds(setSelects);
        if (populateInterval) clearInterval(populateInterval);
        populateInterval = setInterval(() => populateBuilds(setSelects), 5000);
    }

    function addonInit() {
        loadSettings();
        if (!uiWindowElement) buildUI();
        performDailyResetCheck();

        if (currentSettings.autoAbyss && currentSettings.enabled) {
            runAbyssAutomation();
        }
    }

    function addonStop() {
        isRunning = false;
        if (populateInterval) {
            clearInterval(populateInterval);
            populateInterval = null;
        }
        if (uiWindowElement) {
            uiWindowElement.remove();
            uiWindowElement = null;
        }
    }

    function onStateToggle(isEnabled) {
        currentSettings.enabled = isEnabled;
        if (!isEnabled) {
            isRunning = false;
            const autoAbyssEl = document.getElementById("autoAbyss");
            if (autoAbyssEl) {
                updateAutoAbyssState(false, autoAbyssEl);
                currentSettings.autoAbyss = false;
                saveSettings();
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
