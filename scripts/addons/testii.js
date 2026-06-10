// ==UserScript==
// @name          Item Info baddonz
// @version       2.1.0
// @description   Informacje o itemach
// @author        besiak
// @match         https://*.margonem.pl/*
// @grant         none
// ==/UserScript==

(function() {
    'use strict';

    const ADDON_ID = "II";

    // Wszystko zapisywane do konta (acc)
    const DEFAULT = {
        enabled:             true,
        windowVisible:       true,
        windowOpacity:       2,
        amount_essence:      true,
        SHOW_LEGBON_MARKERS: true,
        HIDE_OPIS:           false,
        UPGRADE_LEVEL:       true,
        SHOW_SUMMARY_LEGEND: true,
        SHOW_COMMON:         true,
        SHOW_UPGRADED:       true,
        SHOW_UNIQUE:         true,
        SHOW_HEROIC:         true,
        SHOW_LEGENDARY:      true
    };

    let S = { ...DEFAULT };
    let uiWindowElement = null;
    let observer        = null;

    function loadSettings() {
        if (!window.BaddonzAPI) return;
        S = { ...DEFAULT, ...window.BaddonzAPI.getAccSettings(ADDON_ID) };
    }

    function saveSettings() {
        if (!window.BaddonzAPI) return;
        window.BaddonzAPI.saveAccSettings(ADDON_ID, S);
    }

    // ─── CSS ──────────────────────────────────────────────────────────────────
    if (!document.querySelector(".ii-custom-styles")) {
        const style = document.createElement("style");
        style.className = "ii-custom-styles";
        style.innerText = `
            .baddonz-ii-wnd { width: 210px; min-width: 210px; }
            .baddonz-ii-wnd .baddonz-window-body { padding: 4px 6px 6px 6px !important; gap: 3px !important; }
            .baddonz-ii-wnd .baddonz-setting-row { margin-bottom: 2px !important; }
            .baddonz-ii-wnd .baddonz-text { font-size: 11px; }
            .baddonz-ii-wnd hr { margin: 3px 0 !important; }
            body:not(.baddonz-ii-essence)  .baddonz-essence-marker  { display: none !important; }
            body:not(.baddonz-ii-levels)   .baddonz-levels-marker   { display: none !important; }
            body:not(.baddonz-ii-summary)  .baddonz-summary-marker  { display: none !important; }
            body:not(.baddonz-ii-common)   .baddonz-info-rarity-common   { display: none !important; }
            body:not(.baddonz-ii-upgraded) .baddonz-info-rarity-upgraded { display: none !important; }
            body:not(.baddonz-ii-unique)   .baddonz-info-rarity-unique   { display: none !important; }
            body:not(.baddonz-ii-heroic)   .baddonz-info-rarity-heroic   { display: none !important; }
            body:not(.baddonz-ii-legendary).baddonz-info-rarity-legendary{ display: none !important; }
            body.baddonz-ii-hide-opis.baddonz-ii-common   .baddonz-desc-rarity-common   { display: none !important; }
            body.baddonz-ii-hide-opis.baddonz-ii-upgraded .baddonz-desc-rarity-upgraded { display: none !important; }
            body.baddonz-ii-hide-opis.baddonz-ii-unique   .baddonz-desc-rarity-unique   { display: none !important; }
            body.baddonz-ii-hide-opis.baddonz-ii-heroic   .baddonz-desc-rarity-heroic   { display: none !important; }
            body.baddonz-ii-hide-opis.baddonz-ii-legendary.baddonz-desc-rarity-legendary{ display: none !important; }`;
        document.head.appendChild(style);
    }

    const UPGRADEABLE_RARITIES = ["legendary","heroic","unique","upgraded","common"];
    const UPGRADEABLE_CLASSES  = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,29];
    const ICON_STYLE = 'width:22px;height:22px;background-size:100%;display:inline-block;vertical-align:middle;';
    const mkIcon = (url) => `<div class="item-details__ico" style="${ICON_STYLE} margin-left:2px; background-image:url(&quot;${url}&quot;);"></div>`;
    const CDN    = 'https://micc.garmory-cdn.cloud/obrazki/itemy/';
    const ICONS  = {
        legendary: { upg: mkIcon(`${CDN}upg/lege_enh_ball.gif`), ess: mkIcon(`${CDN}neu/pyl-sakryfikacji.gif`) },
        heroic:    { upg: mkIcon(`${CDN}upg/hero_enh_ball.gif`), ess: mkIcon(`${CDN}neu/ese_hero.gif`)          },
        unique:    { upg: mkIcon(`${CDN}upg/uniq_enh_ball.gif`), ess: mkIcon(`${CDN}neu/ese_unikat.gif`)        },
        upgraded:  { upg: mkIcon(`${CDN}upg/upgr_enh_ball.gif`), ess: mkIcon(`${CDN}neu/ese_ulep.gif`)          },
        common:    { upg: mkIcon(`${CDN}upg/comm_enh_ball.gif`), ess: mkIcon(`${CDN}neu/ese_zwycz.gif`)         }
    };
    const GOLD_ICON = mkIcon('https://experimental.margonem.pl/img/goldIconNormal.png');

    const LEGBON_SHORT = { curse:"KL", lastheal:"OR", facade:"FO", verycrit:"CBK", holytouch:"DA", glare:"OŚ", critred:"KO", cleanse:"PO", anguish:"KU", puncture:"PS", retaliation:"AO", frenzy:"ES" };

    // ─── Body klasy ───────────────────────────────────────────────────────────
    function updateBodyClasses() {
        const b = document.body;
        if (!S.enabled) {
            b.classList.remove('baddonz-ii-hide-opis','baddonz-ii-essence','baddonz-ii-levels','baddonz-ii-summary','baddonz-ii-common','baddonz-ii-upgraded','baddonz-ii-unique','baddonz-ii-heroic','baddonz-ii-legendary');
            return;
        }
        const toggle = (cls, val) => b.classList.toggle(cls, val);
        toggle('baddonz-ii-hide-opis',  S.HIDE_OPIS);
        toggle('baddonz-ii-essence',    S.amount_essence);
        toggle('baddonz-ii-levels',     S.UPGRADE_LEVEL);
        toggle('baddonz-ii-summary',    S.SHOW_SUMMARY_LEGEND);
        toggle('baddonz-ii-common',     S.SHOW_COMMON);
        toggle('baddonz-ii-upgraded',   S.SHOW_UPGRADED);
        toggle('baddonz-ii-unique',     S.SHOW_UNIQUE);
        toggle('baddonz-ii-heroic',     S.SHOW_HEROIC);
        toggle('baddonz-ii-legendary',  S.SHOW_LEGENDARY);
    }

    // ─── Formatowanie ─────────────────────────────────────────────────────────
    const fmt = (n) => n.toLocaleString('pl-PL', { maximumFractionDigits: 0 });
    const fmtBig = (n, isGold = false) => {
        if (n < 1000) return n;
        const div = n >= 1e6 ? 1e6 : 1e3;
        const suf = n >= 1e6 ? 'm'  : 'k';
        const scaled = isGold ? Math.ceil(n / div * 100) / 100 : n / div;
        return (scaled % 1 === 0 ? scaled.toFixed(0) : scaled.toFixed(1)).replace(/\.0$/, '') + suf;
    };

    function calculateCosts(level, artisanBonus, rarity) {
        const mult = [1.0,1.1,1.3,1.6,2.0];
        let basePoints, totalGold;
        switch(rarity) {
            case "common":   basePoints = (Math.floor(level/10)*10)+180; totalGold = 10*level**2+1300*level; break;
            case "unique":   basePoints = 10*level+1800;   totalGold = 100*level**2+13000*level; break;
            case "upgraded": basePoints = 150*level+27000; totalGold = 400*level**2+52000*level; break;
            case "heroic":   basePoints = 100*level+18000; totalGold = 300*level**2+39000*level; break;
            case "legendary":basePoints = (180+level)*1000;totalGold = 600*level**2+78000*level; break;
            default: return null;
        }
        const costs  = mult.map(m => Math.round(basePoints * m));
        const baseEss= Math.round(level/10+10);
        const ld     = level % 10;
        let totalEss = baseEss*3 + (ld>=2&&ld<=4?1:ld>=5&&ld<=8?-1:0);
        let dismantleEss = baseEss;
        if (artisanBonus) {
            const bp = parseInt(artisanBonus,10) / 100;
            if (!isNaN(bp)) dismantleEss = Math.round(baseEss * bp);
        }
        return { costs, totalPoints: costs.reduce((a,b)=>a+b,0), totalEssence: totalEss, totalGold, dismantleEssence: dismantleEss };
    }

    const parseStats = (str) => {
        if (!str || typeof str !== 'string') return {};
        const r = {};
        for (const pair of str.split(';')) { const [k,v] = pair.split('='); if (k && v !== undefined) r[k] = v; }
        return r;
    };

    // ─── Znaczniki bonusów ────────────────────────────────────────────────────
    function _addSpanToEl(el, text, isBless) {
        let tz = el.querySelector(".baddonz-legbon-marker");
        if (tz && tz.innerText === text && tz.dataset.isBless === String(isBless)) return;
        if (!tz) { tz = document.createElement("span"); tz.className = "baddonz-legbon-marker"; el.appendChild(tz); }
        tz.innerText = text;
        tz.dataset.isBless = isBless;
        Object.assign(tz.style, { position:"absolute", left:"0", backgroundColor:"rgba(0,0,0,0.75)", color:"#ff6200", fontSize:"9px", padding:"0px 1px", width:"fit-content", height:"fit-content", fontFamily:"'Arial Black',Gadget,sans-serif", lineHeight:"1.1", userSelect:"none", pointerEvents:"none", zIndex:"2" });
        if (isBless) { tz.style.top="0"; tz.style.bottom="auto"; tz.style.borderBottomRightRadius="3px"; tz.style.borderTopRightRadius="0"; }
        else         { tz.style.bottom="0"; tz.style.top="auto"; tz.style.borderTopRightRadius="3px"; tz.style.borderBottomRightRadius="0"; }
    }

    const removeAllLegbonMarkers = () => document.querySelectorAll('.baddonz-legbon-marker').forEach(el => el.remove());

    function applyMarkerToElement(el) {
        if (!el || el.nodeType !== 1) return;
        let itemData = $(el).data('item');
        if (!itemData) {
            const m = el.className.match(/item-id-(\d+)/);
            if (m && window.Engine?.items) itemData = window.Engine.items.getItemById(m[1]);
        }
        if (!itemData) return;
        const stats = itemData._cachedStats || parseStats(itemData.stat || itemData.stats);
        if (stats) {
            const legbonStr = stats.legbon || stats.socket_injection_legbon || stats.socket_fleeting_legbon;
            if (legbonStr) {
                const name = legbonStr.split(',')[0];
                if (LEGBON_SHORT[name]) { _addSpanToEl(el, LEGBON_SHORT[name], parseInt(itemData.cl,10)===25); return; }
            }
        }
        el.querySelector(".baddonz-legbon-marker")?.remove();
    }

    function applyLegbonMarkersToAll() {
        if (!S.enabled || !S.SHOW_LEGBON_MARKERS) { removeAllLegbonMarkers(); return; }
        document.querySelectorAll('.item').forEach(applyMarkerToElement);
    }

    // ─── Dymki ────────────────────────────────────────────────────────────────
    function injectCustomInfo(tipHtml, item) {
        if (!tipHtml || typeof tipHtml !== 'string') return tipHtml;
        if (tipHtml.includes('baddonz-item-info-injected')) return tipHtml;
        const stats    = item._cachedStats || parseStats(item.stat);
        const $tip     = $('<div>').html(tipHtml);
        $tip.append('<div style="display:none;" class="baddonz-item-info-injected"></div>');
        let itemLevel  = parseInt(stats?.lvl, 10);
        if (stats.lowreq) itemLevel += parseInt(stats.lowreq, 10);
        const itemClass = item.cl;
        const rarity   = stats?.rarity;
        let costs = null;
        if (!isNaN(itemLevel) && UPGRADEABLE_CLASSES.includes(itemClass) && UPGRADEABLE_RARITIES.includes(rarity))
            costs = calculateCosts(itemLevel, stats.artisanbon, rarity);
        let dismantleEss = item.salvageItems ?? costs?.dismantleEssence;
        if (dismantleEss !== undefined && dismantleEss !== null) {
            const essHtml = ` <span class="c_green baddonz-essence-marker">[${dismantleEss}]</span>`;
            const $name   = $tip.find('.item-name,.tip-item-stat-item-name,.name').first();
            if ($name.length && !$name.html().includes('baddonz-essence-marker')) $name.append(essHtml);
        }
        if (stats?.loot) {
            const parts = stats.loot.split(',');
            if (parts.length >= 4) {
                const gs   = parts[2];
                const d    = new Date(Number(parts[3]) * 1000);
                const ds   = d.toLocaleDateString('pl-PL', { day:'2-digit', month:'2-digit', year:'numeric' });
                const ts   = d.toLocaleTimeString('pl-PL', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false });
                const $loot= $tip.find('.tip-item-stat-loot.looter,.looter').first();
                if ($loot.length) {
                    let html = $loot.html();
                    if (!html.includes(ts.substring(0,5))) {
                        html = html.replace(new RegExp(ds.replace(/\./g,'\\.'), 'g'), `${ds} ${ts}`);
                        html = html.replace(/wraz z drużyną/, `wraz z drużyną (<span class="c_orange">${gs}</span>)`);
                        $loot.html(html);
                    }
                }
            }
        }
        if (costs) {
            const icons = ICONS[rarity] || ICONS.common;
            const lines1_4 = costs.costs.slice(0,4).map((c,i) => `+${i+1}: ${fmtBig(c)}`);
            const levelsCnt= `<div style="text-align:center;"><span class="c_blue">Koszt Poziomów Ulepszenia:</span></div>${lines1_4.join(' / ')}<br>+5: ${fmtBig(costs.costs[4])} | <span class="c_green">${costs.totalEssence} esy</span> | <span class="c_yellow">${fmtBig(costs.totalGold,true)} złota</span>`;
            let insertHtml  = `<div class="item-tip-section baddonz-levels-marker baddonz-info-rarity-${rarity}"><div class="tip-item-stat-addon" style="text-align:center;font-size:11px;">${levelsCnt}</div></div>`;
            const sumCnt   = `${icons.upg} <span class="c_blue">${fmt(costs.totalPoints)}</span>&nbsp;&nbsp;&nbsp;&nbsp;${icons.ess} <span class="c_green">${costs.totalEssence}</span>&nbsp;&nbsp;&nbsp;&nbsp;${GOLD_ICON} <span class="c_yellow">${fmtBig(costs.totalGold,true)}</span>`;
            insertHtml    += `<div class="item-tip-section baddonz-summary-marker baddonz-info-rarity-${rarity}"><div class="tip-item-stat-addon" style="text-align:center;">${sumCnt}</div></div>`;
            $tip.find(`.item-tip-section.s-7`).addClass(`baddonz-desc-rarity-${rarity}`);
            const $s8 = $tip.find('.item-tip-section.s-8');
            if ($s8.length) $s8.before(insertHtml);
            else {
                const $s7 = $tip.find('.item-tip-section.s-7');
                if ($s7.length) $s7.after(insertHtml);
                else { const $s5 = $tip.find('.item-tip-section.s-5'); if ($s5.length) $s5.after(insertHtml); else $tip.append(insertHtml); }
            }
        }
        return $tip.html();
    }

    function hookTipFunction() {
        if (typeof $ === 'undefined' || !$.fn?.tip || $.fn.tip._baddonzHooked) return;
        const orig = $.fn.tip;
        $.fn.tip = function(content, t_type, i_type, params) {
            if (typeof content === 'string' && content.length > 0) {
                const item = this.data('item');
                if (item) { try { content = injectCustomInfo(content, item); } catch(e) {} }
            }
            return orig.call(this, content, t_type, i_type, params);
        };
        $.fn.tip._baddonzHooked = true;
    }

    function applyToExistingTips() {
        if (!window.TIPS?.allTips) return;
        let modified = false;
        $('[tip-id]').each(function() {
            const $el  = $(this), id = $el.attr('tip-id'), item = $el.data('item');
            if (item && window.TIPS.allTips[id]) {
                const newHtml = injectCustomInfo(window.TIPS.allTips[id], item);
                if (newHtml !== window.TIPS.allTips[id]) { window.TIPS.allTips[id] = newHtml; modified = true; }
            }
        });
        if (modified) {
            const $tip = window.TIPS.$tip;
            if ($tip?.is(':visible')) {
                const vid = $tip.attr('data-tip-id');
                if (vid && window.TIPS.allTips[vid]) $tip.html(window.TIPS.allTips[vid]);
            }
        }
    }

    // ─── UI ───────────────────────────────────────────────────────────────────
    function buildUI() {
        const bodyHtml = `
            <div class="baddonz-setting-row"><div class="baddonz-checkbox ii-essence ${S.amount_essence ? 'active' : ''}"></div><span class="baddonz-text">Ilość Esencji</span></div>
            <div class="baddonz-setting-row"><div class="baddonz-checkbox ii-legbon ${S.SHOW_LEGBON_MARKERS ? 'active' : ''}"></div><span class="baddonz-text">Skróty bonusów leg.</span></div>
            <hr style="width:100%;border-color:#303030;margin:3px 0;">
            <div class="baddonz-setting-row"><div class="baddonz-checkbox ii-hide-opis ${S.HIDE_OPIS ? 'active' : ''}"></div><span class="baddonz-text">Ukrywaj opis</span></div>
            <div class="baddonz-setting-row"><div class="baddonz-checkbox ii-levels ${S.UPGRADE_LEVEL ? 'active' : ''}"></div><span class="baddonz-text">Poziomy ulepszenia</span></div>
            <div class="baddonz-setting-row"><div class="baddonz-checkbox ii-summary ${S.SHOW_SUMMARY_LEGEND ? 'active' : ''}"></div><span class="baddonz-text">Podsumowanie ulepszenia</span></div>
            <div class="baddonz-grid-2col" style="margin-top:2px;">
                <div class="baddonz-label-wrapper"><div class="baddonz-checkbox ii-common ${S.SHOW_COMMON ? 'active' : ''}"></div><span class="baddonz-text" style="color:#b0b0b0;">Zwykłe</span></div>
                <div class="baddonz-label-wrapper"><div class="baddonz-checkbox ii-upgraded ${S.SHOW_UPGRADED ? 'active' : ''}"></div><span class="baddonz-text" style="color:#cb50ff;">Ulepszone</span></div>
                <div class="baddonz-label-wrapper"><div class="baddonz-checkbox ii-unique ${S.SHOW_UNIQUE ? 'active' : ''}"></div><span class="baddonz-text" style="color:#f0d322;">Unikaty</span></div>
                <div class="baddonz-label-wrapper"><div class="baddonz-checkbox ii-heroic ${S.SHOW_HEROIC ? 'active' : ''}"></div><span class="baddonz-text" style="color:#0080ff;">Heroiki</span></div>
                <div class="baddonz-label-wrapper"><div class="baddonz-checkbox ii-legendary ${S.SHOW_LEGENDARY ? 'active' : ''}"></div><span class="baddonz-text" style="color:#ff0000;">Legendy</span></div>
            </div>`;

        uiWindowElement = window.BaddonzAPI.createAddonWindow(ADDON_ID, "Item Info", bodyHtml, {
            width: '210px', customId: 'baddonz-ii-wnd', hasSettings: false, hasCollapse: false, hasClose: true
        });
        uiWindowElement.classList.add('baddonz-ii-wnd');

        const bind = (cls, key, cb = null) => {
            const el = uiWindowElement.querySelector(`.${cls}`);
            el.addEventListener('click', () => {
                S[key] = el.classList.toggle('active');
                saveSettings();
                updateBodyClasses();
                if (cb) cb();
            });
        };

        bind('ii-essence',    'amount_essence');
        bind('ii-legbon',     'SHOW_LEGBON_MARKERS', applyLegbonMarkersToAll);
        bind('ii-hide-opis',  'HIDE_OPIS');
        bind('ii-levels',     'UPGRADE_LEVEL');
        bind('ii-summary',    'SHOW_SUMMARY_LEGEND');
        bind('ii-common',     'SHOW_COMMON');
        bind('ii-upgraded',   'SHOW_UPGRADED');
        bind('ii-unique',     'SHOW_UNIQUE');
        bind('ii-heroic',     'SHOW_HEROIC');
        bind('ii-legendary',  'SHOW_LEGENDARY');
    }

    // ─── Lifecycle ────────────────────────────────────────────────────────────
    function addonInit() {
        loadSettings();
        updateBodyClasses();
        hookTipFunction();
        if (!uiWindowElement) buildUI();
        if (uiWindowElement) uiWindowElement.style.display = S.windowVisible ? '' : 'none';

        observer = new MutationObserver((muts) => {
            muts.forEach(m => m.addedNodes.forEach(node => {
                if (node.nodeType !== 1) return;
                if (node.classList?.contains('item')) applyMarkerToElement(node);
                node.querySelectorAll?.('.item').forEach(applyMarkerToElement);
            }));
        });
        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => { applyLegbonMarkersToAll(); applyToExistingTips(); }, 500);
    }

    function addonStop() {
        removeAllLegbonMarkers();
        observer?.disconnect(); observer = null;
        if (uiWindowElement) { uiWindowElement.remove(); uiWindowElement = null; }
    }

    function onStateToggle(isEnabled) {
        S.enabled = isEnabled;
        saveSettings();
        updateBodyClasses();
        applyLegbonMarkersToAll();
    }

    const checkApi = () => {
        if (!window.BaddonzAPI?.registerAddon) { setTimeout(checkApi, 500); return; }
        window.BaddonzAPI.registerAddon(ADDON_ID, { init: addonInit, stop: addonStop, onStateToggle });
    };
    checkApi();
})();
