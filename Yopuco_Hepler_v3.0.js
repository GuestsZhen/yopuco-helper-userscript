// ==UserScript==
// @name         有谱么播放解锁 V3.0
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  自动解锁有谱么乐谱播放限制（仅播放解锁功能，无界面）
// @author       GuestsZhen
// @match        https://yopu.co/view/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    const STATE_KEY = 'yopuco_unlock_state';
    let isUnlocked = false;
    let originalSetTimeout = null;

    function getTargetWindow() {
        if (typeof unsafeWindow !== 'undefined') {
            return unsafeWindow;
        }
        return window;
    }

    const targetWindow = getTargetWindow();

    function unlockSpectrum() {
        if (isUnlocked) {
            return true;
        }

        try {
            originalSetTimeout = targetWindow.setTimeout;

            if (typeof originalSetTimeout !== 'function') {
                return false;
            }

            targetWindow.setTimeout = function(callback, delay, ...args) {
                if (typeof delay === 'number' && delay > 2000) {
                    return -1;
                }
                return originalSetTimeout(callback, delay, ...args);
            };

            if (targetWindow !== window) {
                window.setTimeout = targetWindow.setTimeout;
            }

            isUnlocked = true;
            saveState(true);

            const testId = window.setTimeout(() => {}, 3000);

            if (testId === -1) {
                showToast('播放解锁已启用', 'success');
                return true;
            } else {
                return false;
            }

        } catch (error) {
            return false;
        }
    }

    function disableUnlock() {
        if (!isUnlocked || !originalSetTimeout) {
            return;
        }

        try {
            targetWindow.setTimeout = originalSetTimeout;

            if (targetWindow !== window) {
                window.setTimeout = originalSetTimeout;
            }

            isUnlocked = false;
            saveState(false);
            showToast('播放解锁已禁用', 'info');

        } catch (error) {
        }
    }

    function toggleUnlock() {
        if (isUnlocked) {
            disableUnlock();
        } else {
            unlockSpectrum();
        }
    }

    function saveState(state) {
        try {
            localStorage.setItem(STATE_KEY, JSON.stringify(state));
        } catch (error) {
        }
    }

    function loadState() {
        try {
            const saved = localStorage.getItem(STATE_KEY);
            return saved ? JSON.parse(saved) : true;
        } catch (error) {
            return true;
        }
    }

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.textContent = message;

        const colors = {
            success: '#4CAF50',
            info: '#5c94cd',
            warning: '#FF9800',
            error: '#f44336'
        };

        toast.style.cssText = `
            position: fixed !important;
            top: 80px !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            background: ${colors[type] || colors.info} !important;
            color: white !important;
            padding: 12px 24px !important;
            border-radius: 8px !important;
            font-size: 14px !important;
            font-weight: 500 !important;
            z-index: 1000000 !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
            opacity: 0 !important;
            transition: opacity 0.3s ease !important;
            pointer-events: none !important;
        `;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '1';
        }, 10);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 2000);
    }

    const shouldUnlock = loadState();
    if (shouldUnlock) {
        unlockSpectrum();
    }

})();