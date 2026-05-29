// ==UserScript==
// @name         有谱么助手 V4.36
// @namespace    http://tampermonkey.net/
// @version      4.36
// @description  基于 v4.35，删除调试代码，添加重置按钮
// @author       GuestsZhen
// @match        https://yopu.co/view/*
// @grant        none
// @run-at       document-idle
// @icon         https://cdn.yopu.co/img/logo.bd260b19.svg
// ==/UserScript==

(function() {
    'use strict';

    // 打印设置（带默认值）
    const DEFAULT_SETTINGS = {
        lineSpacing: 0,
        leftMargin: 5,   // ✅ v4.12：默认左边距 5mm
        rightMargin: 5,  // ✅ v4.12：默认右边距 5mm
        topMargin: 5     // ✅ v4.12：默认上边距 5mm
    };

    let PRINT_SETTINGS = { ...DEFAULT_SETTINGS };

    // ==================== 播放解锁功能====================
    const STATE_KEY = 'yopuco_unlock_state';
    let isUnlocked = false;
    let originalSetTimeout = null;

    // 获取正确的 window 对象引用
    function getTargetWindow() {
        if (typeof unsafeWindow !== 'undefined') {
            return unsafeWindow;
        }
        return window;
    }

    const targetWindow = getTargetWindow();

    // 播放解锁核心功能
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

            const testId = window.setTimeout(() => {
            }, 3000);

            if (testId === -1) {
                if (typeof updatePlaybackSwitch === 'function') {
                    updatePlaybackSwitch(true);
                }
                showToast('播放解锁已启用', 'success');
                return true;
            } else {
                return false;
            }

        } catch (error) {
            return false;
        }
    }

    // 禁用播放解锁
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

            if (typeof updatePlaybackSwitch === 'function') {
                updatePlaybackSwitch(false);
            }
            showToast('播放解锁已禁用', 'info');

        } catch (error) {
        }
    }

    // 切换播放解锁状态
    function toggleUnlock() {
        if (isUnlocked) {
            disableUnlock();
        } else {
            unlockSpectrum();
        }
    }

    // 状态持久化
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

    // 提示消息
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

    // 更新伴奏播放开关状态
    // 全局变量存储开关元素引用
    let playbackSliderElement = null;
    let playbackKnobElement = null;

    function updatePlaybackSwitch(isOn) {
        if (!playbackSliderElement || !playbackKnobElement) {
            return;
        }
        if (isOn) {
            playbackSliderElement.style.background = '#5c94cd';
            playbackKnobElement.style.left = '22px';
            playbackKnobElement.style.background = 'white';
        } else {
            playbackSliderElement.style.background = '#ddd';
            playbackKnobElement.style.left = '2px';
            playbackKnobElement.style.background = 'white';
        }
    }

    // ✅ v4.13 修复：创建主UI容器（默认显示图标，点击后展开）
    const mainContainer = document.createElement('div');
    mainContainer.id = 'yopuco-helper-main';
    mainContainer.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        z-index: 9999999;
        cursor: move;
        user-select: none;
        transition: none;
    `;

    // 内容容器（默认隐藏，使用 opacity 实现淡入淡出）
    const contentContainer = document.createElement('div');
    contentContainer.id = 'yopuco-content';
    contentContainer.style.cssText = `
        opacity: 0;
        visibility: hidden;
        margin-top: 60px;
        background: white;
        color: black;
        padding: 8px;
        border-radius: 12px;
        font-size: 14px;
        font-family: "Microsoft YaHei", sans-serif;
        min-width: 160px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        transition: opacity 0.3s ease, visibility 0.3s ease;
    `;

    // ✅ v4.13 新增：拖拽功能（在图标上拖拽）
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let initialLeft = 0;
    let initialTop = 0;
    let hasDragged = false;

    // 图标容器（绝对定位在右上角）
    const iconContainer = document.createElement('div');
    iconContainer.id = 'yopuco-icon';
    iconContainer.style.cssText = `
        position: absolute;
        top: -10px;
        right: -10px;
        width: 48px;
        height: 48px;
        background: white;
        border-radius: 50%;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
        cursor: pointer;
        z-index: 10;
    `;

    // 图标图片
    const iconImg = document.createElement('img');
    iconImg.src = 'https://cdn.yopu.co/img/logo.bd260b19.svg';
    iconImg.style.cssText = `
        width: 32px;
        height: 32px;
        object-fit: contain;
    `;
    iconContainer.appendChild(iconImg);

    // 悬停效果
    iconContainer.addEventListener('mouseenter', () => {
        if (!isDragging) {
            iconContainer.style.transform = 'scale(1.1)';
            iconContainer.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.25)';
        }
    });

    iconContainer.addEventListener('mouseleave', () => {
        if (!isDragging) {
            iconContainer.style.transform = 'scale(1)';
            iconContainer.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
        }
    });

    // 拖拽事件监听
    iconContainer.addEventListener('mousedown', (e) => {
        // 只允许左键拖拽
        if (e.button !== 0) return;

        isDragging = true;
        hasDragged = false;

        // 记录初始位置
        const rect = mainContainer.getBoundingClientRect();
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        initialLeft = rect.left;
        initialTop = rect.top;

        // 移除 transition 以便流畅拖拽
        mainContainer.style.transition = 'none';
        iconContainer.style.transition = 'none';
        contentContainer.style.transition = 'none';

        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        hasDragged = true;

        const deltaX = e.clientX - dragStartX;
        const deltaY = e.clientY - dragStartY;

        // 计算新位置
        const newLeft = initialLeft + deltaX;
        const newTop = initialTop + deltaY;

        // 应用新位置（使用 left/top 而不是 right/bottom）
        mainContainer.style.left = newLeft + 'px';
        mainContainer.style.top = newTop + 'px';
        mainContainer.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => {
        if (!isDragging) return;

        isDragging = false;

        setTimeout(() => {
            mainContainer.style.transition = 'none';
            iconContainer.style.transition = 'all 0.3s ease';
            contentContainer.style.transition = 'opacity 0.3s ease, visibility 0.3s ease';
        }, 100);
    });

    // ✅ iOS Safari 触摸事件支持
    iconContainer.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;

        isDragging = true;
        hasDragged = false;

        const rect = mainContainer.getBoundingClientRect();
        const touch = e.touches[0];
        dragStartX = touch.clientX;
        dragStartY = touch.clientY;
        initialLeft = rect.left;
        initialTop = rect.top;

        mainContainer.style.transition = 'none';
        iconContainer.style.transition = 'none';
        contentContainer.style.transition = 'none';
    });

    document.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        if (e.touches.length !== 1) return;

        hasDragged = true;

        const touch = e.touches[0];
        const deltaX = touch.clientX - dragStartX;
        const deltaY = touch.clientY - dragStartY;

        const newLeft = initialLeft + deltaX;
        const newTop = initialTop + deltaY;

        mainContainer.style.left = newLeft + 'px';
        mainContainer.style.top = newTop + 'px';
        mainContainer.style.right = 'auto';

        e.preventDefault();
    });

    document.addEventListener('touchend', (e) => {
        if (!isDragging) return;

        isDragging = false;

        if (!hasDragged) {
            touchProcessed = true;
            contentVisible = !contentVisible;
            if (contentVisible) {
                contentContainer.style.visibility = 'visible';
                requestAnimationFrame(() => {
                    contentContainer.style.opacity = '1';
                });
            } else {
                contentContainer.style.opacity = '0';
                setTimeout(() => {
                    contentContainer.style.visibility = 'hidden';
                }, 300);
            }
        }

        setTimeout(() => {
            mainContainer.style.transition = 'none';
            iconContainer.style.transition = 'all 0.3s ease';
            contentContainer.style.transition = 'opacity 0.3s ease, visibility 0.3s ease';
        }, 100);
    });

    mainContainer.appendChild(contentContainer);
    mainContainer.appendChild(iconContainer);
    document.body.appendChild(mainContainer);

    const titleDiv = document.createElement('div');
    titleDiv.innerHTML = '<strong>有谱么助手 V4.36</strong>';
    titleDiv.style.cssText = 'text-align: center; margin-bottom: 10px; font-size: 16px; font-weight: bold;';
    contentContainer.appendChild(titleDiv);

    // ✅ v4.13：主界面增加【伴奏播放】开关
    const playbackSwitch = document.createElement('label');
    playbackSwitch.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 8px;
        background: #f5f5f5;
        border-radius: 8px;
        margin-bottom: 8px;
        cursor: pointer;
        transition: background 0.3s ease;
    `;

    const playbackLabel = document.createElement('span');
    playbackLabel.textContent = '伴奏播放';
    playbackLabel.style.cssText = `
        font-weight: bold;
        font-size: 14px;
        color: #333;
    `;

    const playbackSlider = document.createElement('div');
    playbackSlider.style.cssText = `
        width: 44px;
        height: 24px;
        background: #ddd;
        border-radius: 12px;
        position: relative;
        transition: background 0.3s ease;
    `;

    const playbackKnob = document.createElement('div');
    playbackKnob.style.cssText = `
        width: 20px;
        height: 20px;
        background: white;
        border-radius: 50%;
        position: absolute;
        top: 2px;
        left: 2px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        transition: left 0.3s ease, background 0.3s ease;
    `;

    // 保存引用到全局变量
    playbackSliderElement = playbackSlider;
    playbackKnobElement = playbackKnob;

    playbackSlider.appendChild(playbackKnob);
    playbackSwitch.appendChild(playbackLabel);
    playbackSwitch.appendChild(playbackSlider);

    playbackSwitch.addEventListener('click', (e) => {
        e.stopPropagation();

        toggleUnlock();
    });

    // 初始化开关状态
    updatePlaybackSwitch(isUnlocked);

    contentContainer.appendChild(playbackSwitch);

    // ✅ v4.13：主界面只有【打印设置】按钮
    const settingsButton = document.createElement('button');
    settingsButton.textContent = '打印设置';
    settingsButton.style.cssText = `
        width: 100%;
        padding: 6px;
        background: #5c94cd;
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-weight: bold;
        font-size: 14px;
        transition: all 0.3s ease;
    `;

    settingsButton.addEventListener('mouseenter', () => {
        settingsButton.style.transform = 'translateY(-2px)';
    });

    settingsButton.addEventListener('mouseleave', () => {
        settingsButton.style.transform = 'translateY(0)';
    });

    settingsButton.addEventListener('click', (e) => {
        e.stopPropagation();
        settingsPanel.style.display = 'block';
        overlay.style.display = 'block';
    });

    contentContainer.appendChild(settingsButton);

    const authorDiv = document.createElement('div');
    authorDiv.textContent = 'By GuestsZhen';
    authorDiv.style.cssText = 'text-align: right; margin-top: 8px; font-size: 10px; color: #999;';
    contentContainer.appendChild(authorDiv);

    // ✅ v4.13 修复：点击图标切换内容显示/隐藏（区分拖拽和点击，使用淡入淡出）
    let contentVisible = false;
    let touchProcessed = false;
    iconContainer.addEventListener('click', (e) => {
        if (touchProcessed) {
            touchProcessed = false;
            return;
        }
        if (hasDragged) {
            hasDragged = false;
            return;
        }

        e.stopPropagation();
        contentVisible = !contentVisible;
        if (contentVisible) {
            contentContainer.style.visibility = 'visible';
            requestAnimationFrame(() => {
                contentContainer.style.opacity = '1';
            });
        } else {
            contentContainer.style.opacity = '0';
            setTimeout(() => {
                contentContainer.style.visibility = 'hidden';
            }, 300);
        }
    });

    // 点击页面其他地方隐藏内容面板（使用淡出效果）
    document.addEventListener('click', (e) => {
        if (!mainContainer.contains(e.target) && contentVisible) {
            contentContainer.style.opacity = '0';
            setTimeout(() => {
                contentContainer.style.visibility = 'hidden';
            }, 300);
            contentVisible = false;
        }
    });

    // ✅ v4.12：设置面板（点击按钮后显示）
    const settingsPanel = document.createElement('div');
    settingsPanel.id = 'yopuco-settings-panel';
    settingsPanel.style.cssText = `
        display: none;
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        color: #333;
        padding: 20px;
        border-radius: 16px;
        font-size: 14px;
        font-family: "Microsoft YaHei", sans-serif;
        z-index: 10000000;
        width: auto;
        min-width: 280px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        cursor: move;
        user-select: none;
    `;

    // 遮罩层
    const overlay = document.createElement('div');
    overlay.id = 'yopuco-overlay';
    overlay.style.cssText = `
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 9999999;
        backdrop-filter: blur(5px);
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(settingsPanel);

    // 设置面板标题（带关闭按钮）
    const panelTitle = document.createElement('div');
    panelTitle.style.cssText = 'margin-bottom: 15px; font-size: 16px; color: #5c94cd; border-bottom: 2px solid #5c94cd; padding-bottom: 8px; display: flex; justify-content: space-between; align-items: center;';

    const titleText = document.createElement('strong');
    titleText.textContent = '打印设置';
    panelTitle.appendChild(titleText);

    // ✅ v4.13 修复：X 关闭按钮
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '&times;';
    closeButton.style.cssText = `
        background: none;
        border: none;
        font-size: 24px;
        color: #999;
        cursor: pointer;
        padding: 0;
        width: 30px;
        height: 30px;
        line-height: 30px;
        text-align: center;
        transition: all 0.3s ease;
    `;

    closeButton.addEventListener('mouseenter', () => {
        closeButton.style.color = '#5c94cd';
        closeButton.style.transform = 'scale(1.2)';
    });

    closeButton.addEventListener('mouseleave', () => {
        closeButton.style.color = '#999';
        closeButton.style.transform = 'scale(1)';
    });

    closeButton.addEventListener('click', () => {
        closeSettingsPanel();
    });

    panelTitle.appendChild(closeButton);
    settingsPanel.appendChild(panelTitle);

    // ✅ v4.13 新增：设置面板拖拽功能（必须在 panelTitle 和 closeButton 定义之后）
    let isSettingsDragging = false;
    let settingsDragStartX = 0;
    let settingsDragStartY = 0;
    let settingsInitialLeft = 0;
    let settingsInitialTop = 0;
    let settingsHasDragged = false;
    let settingsIsCentered = true;  // 标记是否还在居中位置

    panelTitle.addEventListener('mousedown', (e) => {
        // 只允许左键拖拽
        if (e.button !== 0) return;
        // 如果点击的是关闭按钮，不拖拽
        if (e.target === closeButton || closeButton.contains(e.target)) return;

        isSettingsDragging = true;
        settingsHasDragged = false;

        // 如果是第一次拖拽，需要先计算当前位置
        if (settingsIsCentered) {
            const rect = settingsPanel.getBoundingClientRect();
            settingsPanel.style.left = rect.left + 'px';
            settingsPanel.style.top = rect.top + 'px';
            settingsPanel.style.transform = 'none';
            settingsInitialLeft = rect.left;
            settingsInitialTop = rect.top;
            settingsIsCentered = false;
        } else {
            settingsInitialLeft = parseFloat(settingsPanel.style.left);
            settingsInitialTop = parseFloat(settingsPanel.style.top);
        }

        settingsDragStartX = e.clientX;
        settingsDragStartY = e.clientY;

        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isSettingsDragging) return;

        settingsHasDragged = true;

        const deltaX = e.clientX - settingsDragStartX;
        const deltaY = e.clientY - settingsDragStartY;

        const newLeft = settingsInitialLeft + deltaX;
        const newTop = settingsInitialTop + deltaY;

        settingsPanel.style.left = newLeft + 'px';
        settingsPanel.style.top = newTop + 'px';
    });

    document.addEventListener('mouseup', () => {
        if (!isSettingsDragging) return;

        isSettingsDragging = false;
    });

    // 设置项容器
    const settingsContainer = document.createElement('div');
    settingsContainer.style.cssText = 'margin-bottom: 15px;';

    function createSettingItem(label, key, min, max, step, unit) {
        const itemDiv = document.createElement('div');
        itemDiv.style.cssText = 'margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between;';

        const labelSpan = document.createElement('span');
        labelSpan.textContent = label + ':';
        labelSpan.style.cssText = 'color: #555; font-weight: 500; flex-shrink: 0; margin-right: 10px; font-size: 13px;';

        const inputWrapper = document.createElement('div');
        inputWrapper.style.cssText = 'display: flex; align-items: center; flex: 1;';

        const input = document.createElement('input');
        input.type = 'number';
        input.id = `yopuco-input-${key}`;
        input.min = min;
        input.max = max;
        input.step = step;
        input.value = PRINT_SETTINGS[key];
        input.style.cssText = 'width: 30px; background: #f5f5f5; color: #333; border: 2px solid #ddd; padding: 6px 10px; border-radius: 6px; font-size: 13px; transition: all 0.3s ease;';

        input.addEventListener('focus', () => {
            input.style.borderColor = '#565657ff';
            input.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
        });

        input.addEventListener('blur', () => {
            input.style.borderColor = '#ddd';
            input.style.boxShadow = 'none';
        });

        input.addEventListener('change', (e) => {
            const value = parseFloat(e.target.value);
            if (value >= min && value <= max) {
                PRINT_SETTINGS[key] = value;
            } else {
                e.target.value = PRINT_SETTINGS[key];
                alert(`数值超出范围 (${min}-${max}${unit})`);
            }
        });

        const unitSpan = document.createElement('span');
        unitSpan.textContent = unit;
        unitSpan.style.cssText = 'color: #999; margin-left: 5px; font-size: 11px;';

        inputWrapper.appendChild(input);
        inputWrapper.appendChild(unitSpan);
        itemDiv.appendChild(labelSpan);
        itemDiv.appendChild(inputWrapper);
        return itemDiv;
    }

    // ✅ v4.30：两行布局
    // 第 1 行：行间距 + 上边距
    const row1 = document.createElement('div');
    row1.style.cssText = 'display: flex; gap: 10px; margin-bottom: 10px;';
    row1.appendChild(createSettingItem('行间距', 'lineSpacing', 0, 20, 1, 'mm'));
    row1.appendChild(createSettingItem('上边距', 'topMargin', 5, 40, 1, 'mm'));
    settingsContainer.appendChild(row1);

    // 第 2 行：左边距 + 右边距
    const row2 = document.createElement('div');
    row2.style.cssText = 'display: flex; gap: 10px; margin-bottom: 10px;';
    row2.appendChild(createSettingItem('左边距', 'leftMargin', 5, 40, 1, 'mm'));
    row2.appendChild(createSettingItem('右边距', 'rightMargin', 5, 40, 1, 'mm'));
    settingsContainer.appendChild(row2);

    settingsPanel.appendChild(settingsContainer);

    // 按钮容器
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = 'display: flex; gap: 10px; margin-top: 15px;';

    // 【打印】按钮
    const printButton = document.createElement('button');
    printButton.textContent = '打印';
    printButton.style.cssText = `
        flex: 1;
        padding: 10px;
        background: linear-gradient(135deg, #b5b5b6ff 0%, #929292ff 100%);
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-weight: bold;
        font-size: 13px;
        transition: all 0.3s ease;
    `;

    printButton.addEventListener('mouseenter', () => {
        printButton.style.transform = 'translateY(-2px)';
        printButton.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
    });

    printButton.addEventListener('mouseleave', () => {
        printButton.style.transform = 'translateY(0)';
        printButton.style.boxShadow = 'none';
    });

    printButton.addEventListener('click', () => {
        closeSettingsPanel();
        // 延迟执行，确保设置面板完全关闭
        setTimeout(() => {
            optimizedPrint();
        }, 100);
    });
    buttonContainer.appendChild(printButton);

    // 【重置】按钮
    const resetButton = document.createElement('button');
    resetButton.textContent = '重置';
    resetButton.style.cssText = `
        flex: 1;
        padding: 10px;
        background: linear-gradient(135deg,#b5b5b6ff 0%, #929292ff 100%);
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-weight: bold;
        font-size: 13px;
        transition: all 0.3s ease;
    `;

    resetButton.addEventListener('mouseenter', () => {
        resetButton.style.transform = 'translateY(-2px)';
        resetButton.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
    });

    resetButton.addEventListener('mouseleave', () => {
        resetButton.style.transform = 'translateY(0)';
        resetButton.style.boxShadow = 'none';
    });

    resetButton.addEventListener('click', () => {
        PRINT_SETTINGS.lineSpacing = DEFAULT_SETTINGS.lineSpacing;
        PRINT_SETTINGS.leftMargin = DEFAULT_SETTINGS.leftMargin;
        PRINT_SETTINGS.rightMargin = DEFAULT_SETTINGS.rightMargin;
        PRINT_SETTINGS.topMargin = DEFAULT_SETTINGS.topMargin;
        
        ['lineSpacing', 'leftMargin', 'rightMargin', 'topMargin'].forEach(key => {
            const input = document.getElementById(`yopuco-input-${key}`);
            if (input) {
                input.value = PRINT_SETTINGS[key];
            }
        });
    });
    buttonContainer.appendChild(resetButton);

    // 按钮容器只保留【打印】和【重置】

    settingsPanel.appendChild(buttonContainer);

    // 关闭设置面板
    function closeSettingsPanel() {
        settingsPanel.style.display = 'none';
        overlay.style.display = 'none';
    }

    // 点击遮罩层关闭设置面板
    overlay.addEventListener('click', closeSettingsPanel);

    // ESC 键关闭设置面板
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeSettingsPanel();
        }
    });

    // 初始化时加载播放解锁状态
    const shouldUnlock = loadState();
    if (shouldUnlock) {
        unlockSpectrum();
    }

    function extractSongTitle() {
        const titleElement = document.querySelector('h1, .title, [class*="title"]');
        if (!titleElement) return '未命名乐谱';

        let fullTitle = titleElement.textContent.trim();

        const suffixPatterns = [/\s*吉他弹唱谱\s*$/i];
        suffixPatterns.forEach(pattern => {
            fullTitle = fullTitle.replace(pattern, '');
        });

        const dashMatch = fullTitle.match(/^([^\-–—]+)/);
        if (dashMatch) {
            return dashMatch[1].trim();
        }

        return fullTitle.trim() || '未命名乐谱';
    }

    function extractSongInfo() {
        const info = { singer: '', arranger: '', timeSig: '', tempo: '', key: '', originalKey: '' };
        const infoElements = document.querySelectorAll('[class*="info"], [class*="meta"], .song-info, .music-info');

        infoElements.forEach(el => {
            const text = el.textContent || '';
            const singerMatch = text.match(/(?:唱|演唱)[：:]?\s*([^编拍选原\n]+)/i);
            if (singerMatch && !info.singer) info.singer = singerMatch[1].trim();
            const arrangerMatch = text.match(/(?:编|编配)[：:]?\s*([^拍选原\n]+)/i);
            if (arrangerMatch && !info.arranger) info.arranger = arrangerMatch[1].trim();
            const timeSigMatch = text.match(/(?:拍号|节拍)[：:]?\s*(\d+\/\d+)/i);
            if (timeSigMatch && !info.timeSig) info.timeSig = timeSigMatch[1].trim();
            const tempoMatch = text.match(/(?:拍速|速度)[：:]?\s*(\d+)/i);
            if (tempoMatch && !info.tempo) info.tempo = tempoMatch[1].trim();
            const keyMatch = text.match(/(?:选调|调)[：:]?\s*([A-G][#b]?)/i);
            if (keyMatch && !info.key) info.key = keyMatch[1].trim();
            const originalKeyMatch = text.match(/(?:原唱调|原调)[：:]?\s*([A-G][#b]?)/i);
            if (originalKeyMatch && !info.originalKey) info.originalKey = originalKeyMatch[1].trim();
        });

        return info;
    }

    // ✅ v4.12：连续布局（不分页）
    function createContinuousLayout(svgElements, songTitle, songInfo) {
        const container = document.createElement('div');
        container.id = 'yopuco-paged-content';

        const measuresPerLine = 1;  // ✅ v4.12：固定每行 1 个小节

        let currentRow = null;
        let measureCount = 0;

        // 添加歌曲标题和歌曲信息
        const header = document.createElement('div');
        header.className = 'page-header';

        const titleElement = document.createElement('div');
        titleElement.className = 'page-title';
        titleElement.textContent = songTitle;
        header.appendChild(titleElement);

        const infoRows = [];
        if (songInfo.singer) infoRows.push(`<span class="song-info-row"><span class="song-info-label">唱:</span><span class="song-info-value">${songInfo.singer}</span></span>`);
        if (songInfo.arranger) infoRows.push(`<span class="song-info-row"><span class="song-info-label">编:</span><span class="song-info-value">${songInfo.arranger}</span></span>`);
        if (songInfo.timeSig) infoRows.push(`<span class="song-info-row"><span class="song-info-label">拍号:</span><span class="song-info-value">${songInfo.timeSig}</span></span>`);
        if (songInfo.tempo) infoRows.push(`<span class="song-info-row"><span class="song-info-label">拍速:</span><span class="song-info-value">${songInfo.tempo}</span></span>`);
        if (songInfo.key) infoRows.push(`<span class="song-info-row"><span class="song-info-label">选调:</span><span class="song-info-value">${songInfo.key}</span></span>`);
        if (songInfo.originalKey) infoRows.push(`<span class="song-info-row"><span class="song-info-label">原唱调:</span><span class="song-info-value">${songInfo.originalKey}</span></span>`);

        if (infoRows.length > 0) {
            const songInfoDiv = document.createElement('div');
            songInfoDiv.className = 'song-info';
            songInfoDiv.innerHTML = infoRows.join('');
            header.appendChild(songInfoDiv);
        }

        container.appendChild(header);

        svgElements.forEach((svg) => {
            if (!currentRow || measureCount % measuresPerLine === 0) {
                currentRow = document.createElement('div');
                currentRow.className = 'measure-row';
                container.appendChild(currentRow);
            }

            const measureDiv = document.createElement('div');
            measureDiv.className = 'measure';
            measureDiv.appendChild(svg);
            currentRow.appendChild(measureDiv);
            measureCount++;
        });

        return container;
    }

    function optimizedPrint() {
        let printArea = document.querySelector('#nier-scroll-view > div > div > div.at-surface');
        
        if (!printArea) {
            printArea = document.querySelector('.at-surface');
        }
        if (!printArea) {
            printArea = document.querySelector('[class*="surface"]');
        }
        if (!printArea) {
            printArea = document.querySelector('#nier-scroll-view');
        }
        
        if (!printArea) {
            alert('❌ 未找到打印区域，请确保在有谱么乐谱页面使用此脚本');
            return;
        }

        const originalSVGs = Array.from(printArea.querySelectorAll('svg'));

        const validSVGs = originalSVGs.filter((svg) => {
            const innerHTML = svg.innerHTML || '';
            return innerHTML.length > 100;
        });

        if (validSVGs.length === 0) {
            alert('❌ 未找到乐谱内容，请确保乐谱已加载完成');
            return;
        }

        const svgElements = validSVGs.map((svg, index) => {
            const clonedSvg = svg.cloneNode(true);
            if (!clonedSvg.getAttribute('viewBox')) {
                const widthAttr = svg.getAttribute('width');
                const heightAttr = svg.getAttribute('height');
                let width = 825;
                let height = 140;
                
                if (widthAttr && !isNaN(parseFloat(widthAttr))) {
                    width = parseFloat(widthAttr);
                } else if (typeof svg.clientWidth === 'number' && svg.clientWidth > 0) {
                    width = svg.clientWidth;
                }
                
                if (heightAttr && !isNaN(parseFloat(heightAttr))) {
                    height = parseFloat(heightAttr);
                } else if (typeof svg.clientHeight === 'number' && svg.clientHeight > 0) {
                    height = svg.clientHeight;
                }
                
                clonedSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);
            }
            
            clonedSvg.removeAttribute('style');
            clonedSvg.setAttribute('width', '100%');
            
            const heightAttr = svg.getAttribute('height');
            if (heightAttr && !isNaN(parseFloat(heightAttr))) {
                clonedSvg.setAttribute('height', heightAttr);
            } else if (typeof svg.clientHeight === 'number' && svg.clientHeight > 0) {
                clonedSvg.setAttribute('height', svg.clientHeight + 'px');
            } else {
                clonedSvg.removeAttribute('height');
            }
            
            return clonedSvg;
        });

        const songTitle = extractSongTitle();
        const songInfo = extractSongInfo();

        const printContainer = document.createElement('div');
        printContainer.id = 'yopuco-print-container';
        printContainer.style.cssText = `
            position: relative !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: auto !important;
            min-height: 100vh !important;
            z-index: 9999998 !important;
            display: block !important;
            background: white !important;
            overflow: visible !important;
        `;

        const continuousContent = createContinuousLayout(svgElements, songTitle, songInfo);
        printContainer.appendChild(continuousContent);

        const styleId = 'yopuco-print-styles-v4.13';
        let styleElement = document.getElementById(styleId);
        if (styleElement) {
            styleElement.remove();
        }

        styleElement = document.createElement('style');
        styleElement.id = styleId;
        styleElement.textContent = `
            @media print {
                body > div:not(#yopuco-print-container),
                body > script,
                body > link,
                body > style,
                body > noscript,
                body > meta,
                body > title,
                body > head {
                    display: none !important;
                }
                #yopuco-scroll-wrapper,
                #yopuco-helper-main,
                #yopuco-settings-panel,
                #yopuco-overlay {
                    display: none !important;
                }
                body {
                    margin: 0 !important;
                    padding: 0 !important;
                    background: white !important;
                }
                #yopuco-print-container {
                    display: block !important;
                    position: static !important;
                    left: auto !important;
                    top: auto !important;
                    right: auto !important;
                    bottom: auto !important;
                    width: 100% !important;
                    height: auto !important;
                    max-height: none !important;
                    min-height: 0 !important;
                    overflow: visible !important;
                    outline: none !important;
                    border: none !important;
                    margin: 0 !important;
                    padding: 0 ${PRINT_SETTINGS.rightMargin}mm 0 ${PRINT_SETTINGS.leftMargin}mm !important;
                    box-sizing: border-box !important;
                    background: white !important;
                    z-index: auto !important;
                }
                svg {
                    visibility: visible !important;
                    display: block !important;
                    width: 100% !important;
                    height: auto !important;
                    max-width: 100% !important;
                }
                .measure-row {
                    visibility: visible !important;
                    outline: none !important;
                    background: transparent !important;
                    display: block !important;
                    width: 100% !important;
                }
                .page-header {
                    visibility: visible !important;
                    outline: none !important;
                    background: transparent !important;
                    display: block !important;
                }
                * {
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
            }

            #yopuco-print-container {
                outline: none !important;
                padding: 0 ${PRINT_SETTINGS.rightMargin}mm 0 ${PRINT_SETTINGS.leftMargin}mm !important;
                box-sizing: border-box !important;
                background: white !important;
            }

            @page {
                size: A4 !important;
                margin: 0 !important;
            }

            .page-header {
                text-align: center !important;
                margin-top: ${PRINT_SETTINGS.topMargin}mm !important;
                margin-bottom: 0mm !important;
                padding-bottom: 0mm !important;
                border-bottom: 1px solid #ddd !important;
                width: 100% !important;
            }

            .page-title {
                font-size: 20pt !important;
                font-weight: bold !important;
                color: #333 !important;
                font-family: "Microsoft YaHei", "PingFang SC", sans-serif !important;
                margin-bottom: 4mm !important;
            }

            .song-info {
                display: flex !important;
                justify-content: center !important;
                align-items: center !important;
                gap: 15px !important;
                margin-top: 5mm !important;
                flex-wrap: nowrap !important;
            }

            .song-info-row {
                display: inline-flex !important;
                align-items: center !important;
                gap: 3px !important;
                font-size: 11pt !important;
                color: #666 !important;
                font-family: "Microsoft YaHei", "PingFang SC", sans-serif !important;
                white-space: nowrap !important;
            }

            .song-info-label {
                color: #999 !important;
                margin-right: 1mm !important;
            }

            .song-info-value {
                color: #333 !important;
                font-weight: 500 !important;
            }

            .measure-row {
                display: flex !important;
                flex-wrap: nowrap !important;
                width: 100% !important;
                max-width: 100% !important;
                margin-bottom: 0 !important;
                gap: 2mm !important;
                overflow: visible !important;
                box-sizing: border-box !important;
            }

            .measure {
                flex: 1 1 0 !important;
                min-width: 0 !important;
                max-width: none !important;
                text-align: center !important;
                border: none !important;
                padding: 0 2mm !important;
                margin: 0 !important;
                overflow: visible !important;
            }

            .measure svg {
                display: block !important;
                width: 100% !important;
                height: auto !important;
                max-width: 100% !important;
                visibility: visible !important;
            }

            .page-footer {
                display: none !important;
            }
        `;

        document.head.appendChild(styleElement);

        const scrollWrapper = document.createElement('div');
        scrollWrapper.id = 'yopuco-scroll-wrapper';
        scrollWrapper.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            max-height: 100vh !important;
            overflow-y: auto !important;
            z-index: 9999997 !important;
            background: white !important;
        `;

        scrollWrapper.appendChild(printContainer);
        document.body.appendChild(scrollWrapper);

        const checkPrintContainer = document.getElementById('yopuco-print-container');

        function performPrint() {
            try {
                const printIframe = document.createElement('iframe');
                printIframe.id = 'yopuco-print-iframe';
                printIframe.style.cssText = `
                    position: fixed !important;
                    top: 0 !important;
                    left: 0 !important;
                    width: 100% !important;
                    height: 100% !important;
                    border: none !important;
                    z-index: 9999999 !important;
                    background: white !important;
                `;
                
                document.body.appendChild(printIframe);

                printIframe.onload = function() {
                    const iframeDoc = printIframe.contentDocument || printIframe.contentWindow.document;
                    
                    const iframeStyle = iframeDoc.createElement('style');
                    iframeStyle.textContent = `
                        @page {
                            size: A4 !important;
                            margin: 0 !important;
                        }
                        body {
                            margin: 0 !important;
                            padding: ${PRINT_SETTINGS.topMargin}mm ${PRINT_SETTINGS.rightMargin}mm 0 ${PRINT_SETTINGS.leftMargin}mm !important;
                            background: white !important;
                            font-family: "Microsoft YaHei", "PingFang SC", sans-serif !important;
                        }
                        #yopuco-print-content {
                            width: 100% !important;
                            height: auto !important;
                            background: white !important;
                        }
                        .page-header {
                            text-align: center !important;
                            margin-bottom: 8mm !important;
                        }
                        .page-title {
                            font-size: 20pt !important;
                            font-weight: bold !important;
                            color: #333 !important;
                            margin-bottom: 4mm !important;
                        }
                        .song-info {
                            display: flex !important;
                            justify-content: center !important;
                            gap: 15px !important;
                            margin-top: 5mm !important;
                        }
                        .song-info-row {
                            display: inline-flex !important;
                            align-items: center !important;
                            gap: 3px !important;
                            font-size: 11pt !important;
                            color: #666 !important;
                        }
                        .measure-row {
                            display: flex !important;
                            flex-wrap: nowrap !important;
                            width: 100% !important;
                            gap: 2mm !important;
                            margin-bottom: ${PRINT_SETTINGS.lineSpacing}mm !important;
                        }
                        .measure {
                            flex: 1 1 0 !important;
                            min-width: 0 !important;
                            text-align: center !important;
                            padding: 0 2mm !important;
                        }
                        .measure svg {
                            display: block !important;
                            width: 100% !important;
                            height: auto !important;
                        }
                    `;
                    iframeDoc.head.appendChild(iframeStyle);

                    const printContent = document.createElement('div');
                    printContent.id = 'yopuco-print-content';
                    printContent.innerHTML = continuousContent.innerHTML;
                    iframeDoc.body.appendChild(printContent);

                    setTimeout(() => {
                        printIframe.contentWindow.print();
                        
                        setTimeout(() => {
                            if (document.body.contains(printIframe)) {
                                document.body.removeChild(printIframe);
                            }
                            
                            if (document.body.contains(scrollWrapper)) {
                                document.body.removeChild(scrollWrapper);
                            }
                            if (document.head.contains(styleElement)) {
                                document.head.removeChild(styleElement);
                            }
                        }, 1000);
                    }, 500);
                };

                printIframe.src = 'about:blank';

            } catch (error) {
                alert('打印失败，请尝试刷新页面后重新打印');
                if (document.body.contains(scrollWrapper)) {
                    document.body.removeChild(scrollWrapper);
                }
                if (document.head.contains(styleElement)) {
                    document.head.removeChild(styleElement);
                }
            }
        }

        setTimeout(performPrint, 300);
    }

})();
