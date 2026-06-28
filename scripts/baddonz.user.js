// ==UserScript==
// @name          Baddonz
// @version       2.13
// @description   Dodatki NI
// @author        besiak
// @match         https://*.margonem.pl/*
// @grant         none
// @icon          https://i.imgur.com/OAtRFEw.png
// @downloadURL   https://besiak6.github.io/scripts/baddonz.user.js
// @updateURL     https://besiak6.github.io/scripts/baddonz.user.js
// ==/UserScript==
(function () {
    fetch(`https://besiak6.github.io/scripts/version.json?t=${Date.now()}`)
        .then(r => r.json())
        .then(d => { if (d?.version) localStorage.setItem('baddonz_v', d.version); })
        .catch(() => {})
        .finally(() => {
            const v = localStorage.getItem('baddonz_v') || '0';
            window.CSS_URL = `https://besiak6.github.io/styles/baddonz2.css?v=${v}`;
            const s = document.createElement('script');
            s.src = `https://besiak6.github.io/scripts/baddonz2.js?v=${v}`;
            document.head.appendChild(s);
        });
})();
