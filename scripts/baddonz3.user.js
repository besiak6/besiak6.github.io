// ==UserScript==
// @name         Baddonz
// @match        https://*.margonem.pl/*
// @match        https://*.margonem.com/*
// @exclude      https://commons.margonem.pl/*
// @exclude      https://commons.margonem.com/*
// @connect      besiak6.github.io
// @connect      www.margonem.pl
// @connect      www.margonem.com
// @connect      public-api.margonem.pl
// @require      https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/Sortable.min.js
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_xmlhttpRequest
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// @grant        unsafeWindow
// @icon         https://i.imgur.com/NSWkT4f.png
// @downloadURL  https://besiak6.github.io/scripts/baddonz3.user.js
// @updateURL    https://besiak6.github.io/scripts/baddonz3.user.js
// ==/UserScript==

GM_xmlhttpRequest({
    method: 'GET',
    url: 'https://besiak6.github.io/scripts/baddonz3.js?t=' + Date.now(),
    onload: r => new Function('GM_getValue', 'GM_setValue', 'GM_deleteValue', 'GM_xmlhttpRequest', 'GM_addValueChangeListener', 'GM_removeValueChangeListener', 'unsafeWindow', 'Sortable', r.responseText)(
        GM_getValue, GM_setValue, GM_deleteValue, GM_xmlhttpRequest,
        GM_addValueChangeListener, GM_removeValueChangeListener, unsafeWindow, Sortable
    ),
});
