// ==UserScript==
// @name          Item Info baddonz
// @version       05.08.2025
// @description   Informacje o itemach (API 2.0 - Dynamiczny CSS, zero duplikatów)
// @author        besiak
// @match         https://*.margonem.pl/*
// @grant         none
// ==/UserScript==

(function() {
    'use strict';
    
    const ADDON_ID = "II";

    const UPGRADEABLE_RARITIES = ["legendary", "heroic", "unique", "upgraded", "common"];
    const UPGRADEABLE_CLASSES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 29];

    const ICON_STYLE = 'width: 22px; height: 22px; background-size: 100%; display: inline-block; vertical-align: middle;';

    const LEGEND_UPGRADE_ICON = `<div class="item-details__ico" style="${ICON_STYLE} margin-left: 2px; background-image: url(&quot;https://micc.garmory-cdn.cloud/obrazki/itemy//upg/lege_enh_ball.gif&quot;);"></div>`;
    const LEGEND_ESSENCE_ICON = `<div class="item-details__ico" style="${ICON_STYLE} margin-left: 2px; background-image: url(&quot;https://micc.garmory-cdn.cloud/obrazki/itemy//neu/pyl-sakryfikacji.gif&quot;);"></div>`;

    const HEROIC_UPGRADE_ICON = `<div class="item-details__ico" style="${ICON_STYLE} margin-left: 2px; background-image: url(&quot;https://micc.garmory-cdn.cloud/obrazki/itemy/upg/hero_enh_ball.gif&quot;);"></div>`;
    const HEROIC_ESSENCE_ICON = `<div class="item-details__ico" style="${ICON_STYLE} margin-left: 2px; background-image: url(&quot;https://micc.garmory-cdn.cloud/obrazki/itemy//neu/ese_hero.gif&quot;);"></div>`;

    const UNIQUE_UPGRADE_ICON = `<div class="item-details__ico" style="${ICON_STYLE} margin-left: 2px; background-image: url(&quot;https://micc.garmory-cdn.cloud/obrazki/itemy//upg/uniq_enh_ball.gif&quot;);"></div>`;
    const UNIQUE_ESSENCE_ICON = `<div class="item-details__ico" style="${ICON_STYLE} margin-left: 2px; background-image: url(&quot;https://micc.garmory-cdn.cloud/obrazki/itemy//neu/ese_unikat.gif&quot;);"></div>`;

    const UPGRADED_UPGRADE_ICON = `<div class="item-details__ico" style="${ICON_STYLE} margin-left: 2px; background-image: url(&quot;https://micc.garmory-cdn.cloud/obrazki/itemy//upg/upgr_enh_ball.gif&quot;);"></div>`;
    const UPGRADED_ESSENCE_ICON = `<div class="item-details__ico" style="${ICON_STYLE} margin-left: 2px; background-image: url(&quot;https://micc.garmory-cdn.cloud/obrazki/itemy//neu/ese_ulep.gif&quot;);"></div>`;

    const COMMON_UPGRADE_ICON = `<div class="item-details__ico" style="${ICON_STYLE} margin-left: 2px; background-image: url(&quot;https://micc.garmory-cdn.cloud/obrazki/itemy//upg/comm_enh_ball.gif&quot;);"></div>`;
    const COMMON_ESSENCE_ICON = `<div class="item-details__ico" style="${ICON_STYLE} margin-left: 2px; background-image: url(&quot;https://micc.garmory-cdn.cloud/obrazki/itemy//neu/ese_zwycz.gif&quot;);"></div>`;

    const GOLD_ICON = `<div class="item-details__ico" style="${ICON_STYLE} margin-left: 2px; background-image: url(&quot;https://experimental.margonem.pl/img/goldIconNormal.png&quot;);"></div>`;

    let currentSettings = {
        enabled: true,
        windowOpacity: 2,
        windowVisible: false,
        amount_essence: true,
        HIDE_OPIS: false,
        UPGRADE_LEVEL: true,
        SHOW_SUMMARY_LEGEND: true,
        SHOW_COMMON: true,
        SHOW_UNIQUE: true,
        SHOW_HEROIC: true,
        SHOW_LEGENDARY: true
    };

    let uiWindowElement = null;

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
        currentSettings = { ...currentSettings, ...accSettings };
        updateDynamicStyles();
    }

    function saveSettings() {
        if (!window.BaddonzAPI) return;
        const accId = window.BaddonzAPI.accountId;
        window.BaddonzAPI.saveAddonSettings(ADDON_ID, {});
        
        try {
            let data = JSON.parse(localStorage.getItem('BaddonzData')) || {};
            if (!data[accId]) data[accId] = {};
            if (!data[accId].accountAddons) data[accId].accountAddons = {};
            data[accId].accountAddons[ADDON_ID] = currentSettings;
            localStorage.setItem('BaddonzData', JSON.stringify(data));
        } catch (e) {}
        updateDynamicStyles();
    }

    function formatNumber(num) {
        return num.toLocaleString('pl-PL', { maximumFractionDigits: 0 });
    }

    function formatBigNumber(num, isGold = false) {
        if (num < 1000) return num;
        if (num >= 1000000) {
            const scaled = num / 1000000;
            let formatted;
            if (isGold) {
                const rounded = Math.ceil(scaled * 100) / 100;
                formatted = rounded.toFixed(rounded % 1 === 0 ? 0 : (rounded * 10) % 1 === 0 ? 1 : 2);
            } else {
                formatted = scaled.toFixed(scaled % 1 === 0 ? 0 : 1);
            }
            return formatted.replace(/\.0+$/, '') + 'm';
        } else if (num >= 1000) {
            const scaled = num / 1000;
            let formatted;
            if (isGold) {
                const rounded = Math.ceil(scaled * 100) / 100;
                formatted = rounded.toFixed(rounded % 1 === 0 ? 0 : (rounded * 10) % 1 === 0 ? 1 : 2);
            } else {
                formatted = scaled.toFixed(scaled % 1 === 0 ? 0 : 1);
            }
            return formatted.replace(/\.0+$/, '') + 'k';
        }
        return num.toString();
    }

    function calculateCosts(level, artisanBonus, rarity) {
        const multipliers = [1.0, 1.1, 1.3, 1.6, 2.0];
        let basePoints, totalGoldCost;

        switch (rarity) {
            case "common": basePoints = (Math.floor(level / 10) * 10) + 180; totalGoldCost = 10 * Math.pow(level, 2) + 1300 * level; break;
            case "unique": basePoints = 10 * level + 1800; totalGoldCost = 100 * Math.pow(level, 2) + 13000 * level; break;
            case "upgraded": basePoints = 150 * level + 27000; totalGoldCost = 400 * Math.pow(level, 2) + 52000 * level; break;
            case "heroic": basePoints = 100 * level + 18000; totalGoldCost = 300 * Math.pow(level, 2) + 39000 * level; break;
            case "legendary": basePoints = (180 + level) * 1000; totalGoldCost = 600 * Math.pow(level, 2) + 78000 * level; break;
            default: return null;
        }

        const costs = multipliers.map(m => Math.round(basePoints * m));
        const totalUpgradePoints = costs.reduce((a, b) => a + b, 0);

        const baseEssenceValue = Math.round(level / 10 + 10);
        let totalUpgradeEssence = baseEssenceValue * 3;
        const lastDigit = level % 10;

        if (lastDigit >= 2 && lastDigit <= 4) totalUpgradeEssence += 1;
        else if (lastDigit >= 5 && lastDigit <= 8) totalUpgradeEssence -= 1;

        let dismantleEssence = baseEssenceValue;
        if (artisanBonus) {
            const bonusPercentage = parseInt(artisanBonus, 10) / 100;
            if (!isNaN(bonusPercentage)) dismantleEssence = Math.round(baseEssenceValue * bonusPercentage);
        }

        return { costs: costs, totalPoints: totalUpgradePoints, totalEssence: totalUpgradeEssence, totalGold: totalGoldCost, dismantleEssence: dismantleEssence };
    }

    // GŁÓWNA MAGIA - Dynamiczne ukrywanie sekcji tipów (Zamiast modyfikowania kodu w locie)
    function updateDynamicStyles() {
        let css = '';
        if (!currentSettings.enabled) {
            css += `
                .baddonz-ii-essence-marker { display: none !important; }
                .baddonz-ii-levels { display: none !important; }
                .baddonz-ii-summary { display: none !important; }
            `;
        } else {
            if (!currentSettings.amount_essence) css += `.baddonz-ii-essence-marker { display: none !important; }\n`;
            if (currentSettings.HIDE_OPIS) css += `.item-tip-section.s-7 { display: none !important; }\n`;
            if (!currentSettings.UPGRADE_LEVEL) css += `.baddonz-ii-levels { display: none !important; }\n`;
            if (!currentSettings.SHOW_SUMMARY_LEGEND) css += `.baddonz-ii-summary { display: none !important; }\n`;
            
            if (!currentSettings.SHOW_COMMON) css += `.baddonz-ii-common { display: none !important; }\n`;
            if (!currentSettings.SHOW_UNIQUE) css += `.baddonz-ii-unique { display: none !important; }\n`;
            if (!currentSettings.SHOW_HEROIC) css += `.baddonz-ii-heroic { display: none !important; }\n`;
            if (!currentSettings.SHOW_LEGENDARY) css += `.baddonz-ii-legendary { display: none !important; }\n`;
        }
        
        let styleEl = document.getElementById('baddonz-ii-dynamic-styles');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'baddonz-ii-dynamic-styles';
            document.head.appendChild(styleEl);
        }
        styleEl.innerText = css;
    }

    function addLegendInfoToTip() {
        const $target = $(this);
        const item = $target.data('item');

        if (!item) return;

        const stats = item._cachedStats;
        let itemLevel = parseInt(stats?.lvl, 10);
        if (stats.lowreq) itemLevel += parseInt(stats.lowreq, 10);

        const itemClass = item.cl;
        const itemRarity = stats?.rarity;
        const tipId = $target.attr('tip-id');
        let currentTipContent = window.TIPS?.allTips[tipId] || "";
        const $visibleTip = window.TIPS?.$tip;

        // Esencja w nazwie (Wstrzykujemy zawsze jako SPAN, żeby CSS mógł go chować i pokazywać natychmiastowo)
        if (item.salvageItems && !currentTipContent.includes('baddonz-ii-essence-marker')) {
            const itemDisplayName = item.name || 'Brak nazwy';
            const newNameContent = `${itemDisplayName} <span class="baddonz-ii-essence-marker">[<span class="c_green" style="font-weight: bold;">${item.salvageItems}</span>]</span>`;

            $target.changeInTip('.tip-item-stat-item-name', newNameContent);
            currentTipContent = window.TIPS?.allTips[tipId] || "";

            if ($visibleTip) {
                const $itemName = $visibleTip.find('.tip-item-stat-item-name');
                if ($itemName.length) $itemName.html(newNameContent);
            }
        }

        // Zmiana Daty Lootu (Zostaje na zawsze po wczytaniu, to tylko formatowanie)
        const lootData = stats?.loot;
        if (lootData && $visibleTip) {
            const parts = lootData.split(',');
            const [, , groupSize, timestamp] = parts;

            const dateMs = Number(timestamp) * 1000;
            const date = new Date(dateMs);
            const dateString = date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const timeString = date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

            const $lootElement = $visibleTip.find('.tip-item-stat-loot.looter');

            if ($lootElement.length) {
                const originalLootText = $lootElement.html();
                if (!originalLootText.includes(timeString.substring(0, 5))) {
                    const findDateRegex = new RegExp(dateString.replace(/\./g, '\\.'), 'g');
                    const findTeamRegex = /wraz z drużyną/;
                    let newLootText = originalLootText.replace(findDateRegex, `${dateString} ${timeString}`);
                    newLootText = newLootText.replace(findTeamRegex, `wraz z drużyną (<span class="c_orange">${groupSize}</span>)`);

                    $lootElement.html(newLootText);
                    $target.changeInTip('.tip-item-stat-loot.looter', newLootText);
                    currentTipContent = window.TIPS?.allTips[tipId] || "";
                }
            }
        }

        // Statystyki Kosztów ulepszeń
        if (isNaN(itemLevel) || !UPGRADEABLE_CLASSES.includes(itemClass) || !UPGRADEABLE_RARITIES.includes(itemRarity)) return;
        
        // Zapobiega duplikatom: wstrzykuje sekcję tylko raz!
        if (currentTipContent.includes('baddonz-ii-stats-marker')) return;

        const artisanBonus = stats.artisanbon;
        const costs = calculateCosts(itemLevel, artisanBonus, itemRarity);

        if (!costs) return;

        const totalEssence = costs.totalEssence;
        const totalGold = costs.totalGold;

        // Wstrzykiwanie ZAWSZE, chowanie i wyświetlanie leży po stronie wygenerowanych klas CSS w locie
        let upgradeLines1_4 = [];
        for (let i = 0; i < 4; i++) {
            upgradeLines1_4.push(`+${i + 1}: ${formatBigNumber(costs.costs[i])}`);
        }

        const upgradeLine5 = `+5: ${formatBigNumber(costs.costs[4])} | <span class="c_green">${totalEssence} esy</span> | <span class="c_yellow">${formatBigNumber(totalGold, true)} złota</span>`;
        const levelsContent = `<div style="text-align: center;"><span class="c_blue">Koszt Poziomów Ulepszenia:</span></div>${upgradeLines1_4.join(' / ')}<br>${upgradeLine5}`;
        
        const levelsSectionHtml = `
            <div class="item-tip-section baddonz-ii-levels baddonz-ii-${itemRarity} baddonz-ii-stats-marker">
                <div class="tip-item-stat-addon" style="text-align: center; font-size: 11px;">${levelsContent}</div>
            </div>
        `;

        let upgradeIcon, essenceIcon;
        switch (itemRarity) {
            case "legendary": upgradeIcon = LEGEND_UPGRADE_ICON; essenceIcon = LEGEND_ESSENCE_ICON; break;
            case "heroic": upgradeIcon = HEROIC_UPGRADE_ICON; essenceIcon = HEROIC_ESSENCE_ICON; break;
            case "unique": upgradeIcon = UNIQUE_UPGRADE_ICON; essenceIcon = UNIQUE_ESSENCE_ICON; break;
            case "upgraded": upgradeIcon = UPGRADED_UPGRADE_ICON; essenceIcon = UPGRADED_ESSENCE_ICON; break;
            case "common": upgradeIcon = COMMON_UPGRADE_ICON; essenceIcon = COMMON_ESSENCE_ICON; break;
            default: upgradeIcon = LEGEND_UPGRADE_ICON; essenceIcon = LEGEND_ESSENCE_ICON;
        }

        const summaryContent = `${upgradeIcon} <span class="c_blue">${formatNumber(costs.totalPoints)}</span>&nbsp;&nbsp;&nbsp;&nbsp;${essenceIcon} <span class="c_green">${totalEssence}</span>&nbsp;&nbsp;&nbsp;&nbsp;${GOLD_ICON} <span class="c_yellow">${formatBigNumber(totalGold, true)}</span>`;
        const summarySectionHtml = `
            <div class="item-tip-section baddonz-ii-summary baddonz-ii-${itemRarity}">
                <div class="tip-item-stat-addon" style="text-align: center;">${summaryContent}</div>
            </div>
        `;

        const insertionHtml = levelsSectionHtml + summarySectionHtml;
        const insertionMarker = '<div class="item-tip-section s-8">';

        if ($visibleTip) {
            const $s8 = $visibleTip.find('.item-tip-section.s-8');

            if ($s8.length) {
                $s8.before(insertionHtml);
            } else {
                const $s7 = $visibleTip.find('.item-tip-section.s-7');
                if ($s7.length) {
                     $s7.after(insertionHtml);
                } else {
                    const $s5 = $visibleTip.find('.item-tip-section.s-5');
                    if ($s5.length) $s5.after(insertionHtml);
                }
            }

            const index = currentTipContent.indexOf(insertionMarker);

            if (index !== -1) {
                const partBefore = currentTipContent.substring(0, index);
                const partAfter = currentTipContent.substring(index);
                window.TIPS.allTips[tipId] = partBefore + insertionHtml + partAfter;
            } else {
                $target.concatTip(insertionHtml);
            }
        }
    }

    function buildUI() {
        const bodyHtml = `
            <div class="baddonz-setting-row" style="margin-bottom: 2px !important;">
                <div class="baddonz-checkbox ii-amount-essence-cb ${currentSettings.amount_essence ? 'active' : ''}"></div>
                <span class="baddonz-text" style="padding:0;">Ilość esencji w nazwie</span>
            </div>
            <div class="baddonz-setting-row" style="margin-bottom: 2px !important;">
                <div class="baddonz-checkbox ii-hide-opis-cb ${currentSettings.HIDE_OPIS ? 'active' : ''}"></div>
                <span class="baddonz-text" style="padding:0;">Ukryj fabułę (opis)</span>
            </div>
            
            <hr style="width: 100%; border-color: #303030; margin: 4px 0;">
            
            <div class="baddonz-setting-row" style="margin-bottom: 2px !important;">
                <div class="baddonz-checkbox ii-upgrade-level-cb ${currentSettings.UPGRADE_LEVEL ? 'active' : ''}"></div>
                <span class="baddonz-text" style="padding:0;">Koszty poziomów</span>
            </div>
            <div class="baddonz-setting-row" style="margin-bottom: 2px !important;">
                <div class="baddonz-checkbox ii-show-summary-cb ${currentSettings.SHOW_SUMMARY_LEGEND ? 'active' : ''}"></div>
                <span class="baddonz-text" style="padding:0;">Podsumowanie kosztów</span>
            </div>
            
            <hr style="width: 100%; border-color: #303030; margin: 4px 0;">
            <div class="baddonz-text" style="text-align:center; width:100%; margin-bottom:1px; padding:0;">Pokazuj ulepszenia dla:</div>
            
            <div class="baddonz-grid-2col" style="margin-bottom: 2px;">
                <div class="baddonz-label-wrapper" style="padding: 0; justify-content: flex-start;">
                    <div class="baddonz-checkbox ii-show-common-cb ${currentSettings.SHOW_COMMON ? 'active' : ''}"></div>
                    <span class="baddonz-text" style="color:#aaa; padding-left:4px;">Zwykłe</span>
                </div>
                <div class="baddonz-label-wrapper" style="padding: 0; justify-content: flex-start;">
                    <div class="baddonz-checkbox ii-show-unique-cb ${currentSettings.SHOW_UNIQUE ? 'active' : ''}"></div>
                    <span class="baddonz-text" style="color:#e5b922; padding-left:4px;">Unikaty</span>
                </div>
                <div class="baddonz-label-wrapper" style="padding: 0; justify-content: flex-start;">
                    <div class="baddonz-checkbox ii-show-heroic-cb ${currentSettings.SHOW_HEROIC ? 'active' : ''}"></div>
                    <span class="baddonz-text" style="color:#2286e5; padding-left:4px;">Herosy</span>
                </div>
                <div class="baddonz-label-wrapper" style="padding: 0; justify-content: flex-start;">
                    <div class="baddonz-checkbox ii-show-legendary-cb ${currentSettings.SHOW_LEGENDARY ? 'active' : ''}"></div>
                    <span class="baddonz-text" style="color:#e52222; padding-left:4px;">Legendy</span>
                </div>
            </div>
        `;

        uiWindowElement = window.BaddonzAPI.createAddonWindow(ADDON_ID, "Item Info", bodyHtml, {
            width: '185px',
            customId: 'baddonz-ii-wnd',
            hasSettings: false,
            hasCollapse: false,
            hasClose: true
        });
        uiWindowElement.classList.add('baddonz-ii-wnd');

        // Bindowanie akcji do checkboxów -> aktualizacja zmiennych -> zapis -> uderzenie nowego CSS
        const bindCheckbox = (selector, key) => {
            const cb = uiWindowElement.querySelector(selector);
            cb.addEventListener('click', () => {
                currentSettings[key] = cb.classList.toggle('active');
                saveSettings();
            });
        };

        bindCheckbox('.ii-amount-essence-cb', 'amount_essence');
        bindCheckbox('.ii-hide-opis-cb', 'HIDE_OPIS');
        bindCheckbox('.ii-upgrade-level-cb', 'UPGRADE_LEVEL');
        bindCheckbox('.ii-show-summary-cb', 'SHOW_SUMMARY_LEGEND');
        bindCheckbox('.ii-show-common-cb', 'SHOW_COMMON');
        bindCheckbox('.ii-show-unique-cb', 'SHOW_UNIQUE');
        bindCheckbox('.ii-show-heroic-cb', 'SHOW_HEROIC');
        bindCheckbox('.ii-show-legendary-cb', 'SHOW_LEGENDARY');
    }

    function addonInit() {
        loadSettings();
        if (!uiWindowElement) buildUI();
        $(document).on('pointerenter', '[tip-id]', addLegendInfoToTip);
    }

    function addonStop() {
        $(document).off('pointerenter', '[tip-id]', addLegendInfoToTip);
        if (uiWindowElement) {
            uiWindowElement.remove();
            uiWindowElement = null;
        }
    }

    // To odpala się w przypadku kliknięcia w Docku, nie niszczy UI, po prostu aktualizuje CSS
    function onStateToggle(isEnabled) {
        currentSettings.enabled = isEnabled;
        saveSettings();
    }

    const checkApi = () => {
        if (!window.BaddonzAPI || !window.BaddonzAPI.registerAddon || !window.Engine || !window.Engine.allInit || !window.Engine.items) {
            setTimeout(checkApi, 500); return;
        }
        window.BaddonzAPI.registerAddon(ADDON_ID, { init: addonInit, stop: addonStop, onStateToggle: onStateToggle });
    };

    checkApi();

})();
