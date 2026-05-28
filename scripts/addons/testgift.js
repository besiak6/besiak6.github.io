// ==UserScript==
// @name          FreeGift baddonz
// @version       1.0
// @description   Automatyczne odbieranie kalendarza
// @author        besiak
// @match         https://*.margonem.pl/*
// @grant         none
// ==/UserScript==

(function () {
    'use strict';

    const ADDON_ID = "FG";

    let currentSettings = {
        enabled: true
    };

    let promoRetrieved = false;
    let calendarRetrievedIndex = 0;
    let originalOnPromotions = null;
    let originalOnRewardsCalendar = null;
    let isIntercepted = false;

    const isLoggingOff = () => {
        return !!(window.Engine && window.Engine.logOff);
    };

    const getRandomDelay = (min = 1, max = 2) => {
        return Math.floor(Math.random() * (max - min + 1) + min) * 1000;
    };

    const buyItem = async (itemId) => {
        if (isLoggingOff() || !currentSettings.enabled) return;
        return new Promise((resolve) => {
            window._g(`promotions&a=use&id=${itemId}`, (data) => {
                resolve(data);
            });
        });
    };

    const buyFreeStuff = async (promotions) => {
        const freeStuff = promotions.filter(
            (item) => item.is_personal === 1 && !item.price && !item.is_used
        );

        if (freeStuff.length === 0) return;

        for (const item of freeStuff) {
            if (isLoggingOff() || !currentSettings.enabled) break;
            await buyItem(item.id);
            await new Promise(resolve => setTimeout(resolve, getRandomDelay()));
        }
    };

    const retrieveCalendarReward = (data) => {
        if (isLoggingOff() || !currentSettings.enabled) return;

        const today = new Date();
        const utcToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());

        const startDay = new Date(data.start_ts * 1000);
        const utcStart = Date.UTC(startDay.getFullYear(), startDay.getMonth(), startDay.getDate());

        const dayDifference = Math.floor((utcToday - utcStart) / (1000 * 60 * 60 * 24));
        const index = dayDifference;
        const dayData = data.days[index];

        if (!dayData || Object.keys(dayData).length) return;

        return new Promise((resolve) => {
            window._g(`rewards_calendar&action=open&day_no=${index + 1}`, (data) => {
                resolve(data);
            });
        });
    };

    const setupHandler = () => {
        if (isIntercepted) return;
        if (window.Engine && window.Engine.communication && window.Engine.communication.dispatcher) {
            originalOnPromotions = window.Engine.communication.dispatcher.on_promotions;
            originalOnRewardsCalendar = window.Engine.communication.dispatcher.on_rewards_calendar;

            window.Engine.communication.dispatcher.on_promotions = function (data) {
                if (!currentSettings.enabled || promoRetrieved || isLoggingOff()) {
                    if (originalOnPromotions) return originalOnPromotions.call(this, data);
                    return;
                }

                promoRetrieved = true;
                buyFreeStuff(data.active);
            };

            window.Engine.communication.dispatcher.on_rewards_calendar = function (data) {
                if (!currentSettings.enabled || calendarRetrievedIndex > 1 || isLoggingOff()) {
                    if (originalOnRewardsCalendar) return originalOnRewardsCalendar.call(this, data);
                    return;
                }

                calendarRetrievedIndex += 1;
                const delay = getRandomDelay();
                setTimeout(() => {
                    if (!isLoggingOff() && currentSettings.enabled) retrieveCalendarReward(data);
                }, delay);
            };
            isIntercepted = true;
        }
    };

    const removeHandler = () => {
        if (!isIntercepted) return;
        if (window.Engine && window.Engine.communication && window.Engine.communication.dispatcher) {
            if (originalOnPromotions) window.Engine.communication.dispatcher.on_promotions = originalOnPromotions;
            if (originalOnRewardsCalendar) window.Engine.communication.dispatcher.on_rewards_calendar = originalOnRewardsCalendar;
        }
        isIntercepted = false;
    };

    const showNews = () => {
        if (isLoggingOff() || !currentSettings.enabled) return;
        return new Promise((resolve) => {
            window._g("promotions&a=show", (data) => {
                resolve(data);
            });
        });
    };

    const showCalendar = () => {
        if (!window.Engine.rewardsCalendarActive || isLoggingOff() || !currentSettings.enabled) return;
        if (window.Engine.hero && window.Engine.hero.d && window.Engine.hero.d.lvl < 25) return;

        return new Promise((resolve) => {
            window._g("rewards_calendar&action=show", (data) => {
                resolve(data);
            });
        });
    };

    function loadSettings() {
        if (!window.BaddonzAPI) return;
        let charSettings = window.BaddonzAPI.getAddonSettings(ADDON_ID) || {};
        currentSettings = { ...currentSettings, ...charSettings };
    }

    function saveSettings() {
        if (!window.BaddonzAPI) return;
        window.BaddonzAPI.saveAddonSettings(ADDON_ID, currentSettings);
    }

    function runLogic() {
        promoRetrieved = false;
        calendarRetrievedIndex = 0;
        
        setupHandler();
        
        setTimeout(() => {
            if (!isLoggingOff() && currentSettings.enabled) showNews();
        }, 1000);

        setTimeout(() => {
            if (!isLoggingOff() && currentSettings.enabled) showCalendar();
        }, 1000);
    }

    function addonInit() {
        loadSettings();
        if (currentSettings.enabled) {
            runLogic();
        }
    }

    function addonStop() {
        removeHandler();
    }

    function onStateToggle(isEnabled) {
        currentSettings.enabled = isEnabled;
        saveSettings();
        if (isEnabled) {
            runLogic();
        } else {
            removeHandler();
        }
    }

    const checkApi = () => {
        if (!window.BaddonzAPI || !window.BaddonzAPI.registerAddon) {
            setTimeout(checkApi, 500);
            return;
        }
        window.BaddonzAPI.registerAddon(ADDON_ID, { init: addonInit, stop: addonStop, onStateToggle: onStateToggle });
    };

    const checkEngine = () => {
        if (!window.Engine || !window.Engine.allInit) {
            setTimeout(checkEngine, 500);
            return;
        }
        checkApi();
    };

    checkEngine();
})();
