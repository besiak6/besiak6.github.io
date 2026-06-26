// ==UserScript==
// @name          Baddonz
// @version       2.11
// @description   Menadżer dodatków by besiak
// @author        besiak
// @match         https://*.margonem.pl/*
// @grant         none
// @icon          https://i.imgur.com/OAtRFEw.png
// @downloadURL   https://besiak6.github.io/scripts/baddonz.user.js
// @updateURL     https://besiak6.github.io/scripts/baddonz.user.js
// ==/UserScript==
(function () {
    const v = localStorage.getItem('bdz_ver') || '0';
    window.CSS_URL = `https://besiak6.github.io/styles/beta.css?v=${v}`;
    const s = document.createElement('script');
    s.src = `https://besiak6.github.io/scripts/beta.js?v=${v}`;
    document.head.appendChild(s);
    fetch(`https://besiak6.github.io/scripts/version.json?t=${Date.now()}`)
        .then(r => r.json())
        .then(d => { if (d?.version !== v) localStorage.setItem('bdz_ver', d.version); })
        .catch(() => {});
})();
