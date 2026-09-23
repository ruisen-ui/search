// ==UserScript==
// @name         多搜索引擎弹窗搜索
// @namespace    http://tampermonkey.net/
// @version      2.9
// @description  悬浮图标与弹窗双向联动拖拽，拖动弹窗时图标同步移动
// @author       You
// @match        *://*/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==
(function () {
    'use strict';
    const ENGINES = [
        { name: "百度", url: "https://www.baidu.com/s?wd={q}" },
        { name: "谷歌", url: "https://www.google.com/search?q={q}" },
    ];
    const HOST_ID = '__ms_shadow_host__';

    const BTN_SIZE = 44;
    const POP_W = 360;
    const GAP = 8;

    // 统一状态：按钮位置为基准，弹窗位置由按钮位置计算
    let state = {
        btnLeft: 0,
        btnTop: 0,
        popLeft: 0,
        popTop: 0
    };

    let dragBtn = { on: false, moved: false, ox: 0, oy: 0 };
    let dragPop = { on: false, ox: 0, oy: 0 };

    function getSearchInputText() {
        const selectors = [
            'input[name="wd"]',
            'input[name="q"]',
            'input[name="query"]',
            'input[type="search"]',
            'input[placeholder*="请输入"]',
            'input[placeholder*="搜索"]',
            'input[placeholder*="企业名称"]',
            '.el-input__inner'
        ];
        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el && el.value?.trim()) return el.value.trim();
        }
        return '';
    }

    function applyLayout(btn, pop) {
        btn.style.left = state.btnLeft + 'px';
        btn.style.top = state.btnTop + 'px';
        pop.style.left = state.popLeft + 'px';
        pop.style.top = state.popTop + 'px';
    }

    // 根据按钮位置重新计算弹窗位置
    function positionPopupFromBtn(pop) {
        const popH = pop.offsetHeight || 180;
        let popTop = state.btnTop - popH - GAP;
        let popLeft = state.btnLeft;

        // 水平边界
        popLeft = Math.max(8, Math.min(popLeft, window.innerWidth - POP_W - 8));

        // 上方放不下就放按钮下方
        if (popTop < 8) {
            popTop = state.btnTop + BTN_SIZE + GAP;
        }

        // 垂直边界兜底
        if (popTop + popH > window.innerHeight - 8) {
            popTop = Math.max(8, window.innerHeight - popH - 8);
        }

        state.popLeft = popLeft;
        state.popTop = popTop;
    }

    function saveBtnPos() {
        localStorage.setItem(
            'ms_pos',
            JSON.stringify({
                l: Math.round(state.btnLeft),
                t: Math.round(state.btnTop)
            })
        );
    }

    function init() {
        if (document.getElementById(HOST_ID)) return;
        if (!document.body) return;

        const host = document.createElement('div');
        host.id = HOST_ID;
        host.style.cssText = [
            'position:fixed!important',
            'top:0!important',
            'left:0!important',
            'width:0!important',
            'height:0!important',
            'overflow:visible!important',
            'z-index:2147483647!important',
            'pointer-events:none!important',
            'background:0 0!important',
            'border:0!important',
            'margin:0!important',
            'padding:0!important'
        ].join(';');
        document.body.appendChild(host);

        const shadow = host.attachShadow({ mode: 'open' });

        const style = document.createElement('style');
        style.textContent = `
            :host { all: initial; }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            .s-btn {
                position: fixed; width: 44px; height: 44px; border-radius: 50%;
                background: #2563eb; color: #fff; display: flex; align-items: center;
                justify-content: center; cursor: grab; z-index: 2147483647;
                box-shadow: 0 2px 10px rgba(0,0,0,.25); user-select: none;
                font-size: 18px; pointer-events: auto; line-height: 1; border: none;
                font-family: system-ui, -apple-system, sans-serif;
                opacity:0.4;
                transition: opacity 0.2s;
            }
            .s-btn:hover { opacity:0.65; }
            .s-btn:active { cursor: grabbing; }
            .s-pop {
                position: fixed; width: 360px; background: rgba(255,255,255,0.75); border-radius: 10px;
                box-shadow: 0 4px 24px rgba(0,0,0,.22); z-index: 2147483647;
                padding: 14px 14px 12px; display: none; pointer-events: auto;
                font-family: system-ui, -apple-system, sans-serif;
                cursor: grab;
            }
            .s-pop:active { cursor: grabbing; }
            .s-pop input {
                width: 100%; padding: 9px 12px; border: 1px solid rgba(204,204,204,.6);
                border-radius: 6px; font-size: 14px; margin-bottom: 10px;
                outline: none; font-family: inherit;
                background: rgba(255,255,255,0.55);
                color: #111;
                pointer-events:auto;
                cursor:text;
            }
            .s-pop input:focus {
                border-color: rgba(37,99,235,.8);
                box-shadow: 0 0 0 2px rgba(37,99,235,.18);
                background: rgba(255,255,255,0.75);
            }
            .s-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
            .s-grid button {
                padding: 7px 4px; border: none; border-radius: 6px;
                background: rgba(37,99,235,.72); color: #fff; cursor: pointer;
                font-size: 13px; font-family: inherit; pointer-events: auto;
                transition: background .15s;
            }
            .s-grid button:hover { background: rgba(29,78,216,.88); }
            .s-close {
                position: absolute; top: 6px; right: 8px; cursor: pointer;
                font-size: 18px; color: rgba(153,153,153,0.85); pointer-events: auto;
                line-height: 1; background: none; border: none; padding: 4px;
            }
            .s-close:hover { color: #333; }
        `;
        shadow.appendChild(style);

        const btn = document.createElement('div');
        btn.className = 's-btn';
        btn.textContent = '🔍';
        shadow.appendChild(btn);

        const pop = document.createElement('div');
        pop.className = 's-pop';
        pop.innerHTML =
            '<span class="s-close">×</span>' +
            '<input placeholder="关键词，可自动读取页面搜索框内容">' +
            '<div class="s-grid"></div>';
        shadow.appendChild(pop);

        const input = pop.querySelector('input');
        const grid = pop.querySelector('.s-grid');
        const closeBtn = pop.querySelector('.s-close');

        ENGINES.forEach(en => {
            const b = document.createElement('button');
            b.textContent = en.name;
            b.dataset.url = en.url;
            grid.appendChild(b);
        });

        closeBtn.onclick = () => {
            pop.style.display = 'none';
        };

        // 初始化按钮位置
        const saved = JSON.parse(localStorage.getItem('ms_pos') || '{}');
        if (saved.l != null && saved.t != null) {
            state.btnLeft = saved.l;
            state.btnTop = saved.t;
        } else {
            state.btnLeft = window.innerWidth - BTN_SIZE - 20;
            state.btnTop = window.innerHeight - BTN_SIZE - 80;
        }

        positionPopupFromBtn(pop);
        applyLayout(btn, pop);

        // 按钮拖拽
        btn.addEventListener('mousedown', e => {
            if (e.button !== 0) return;
            dragBtn.on = true;
            dragBtn.moved = false;
            dragBtn.ox = e.clientX - state.btnLeft;
            dragBtn.oy = e.clientY - state.btnTop;
            e.preventDefault();
        });

        // 弹窗拖拽：明确带动按钮
        pop.addEventListener('mousedown', e => {
            if (e.target === input || e.target.closest('button')) return;
            if (e.button !== 0) return;

            dragPop.on = true;
            dragPop.ox = e.clientX - state.popLeft;
            dragPop.oy = e.clientY - state.popTop;
            e.preventDefault();
        });

        document.addEventListener('mousemove', e => {
            if (dragBtn.on) {
                dragBtn.moved = true;
                state.btnLeft = Math.max(0, Math.min(e.clientX - dragBtn.ox, window.innerWidth - BTN_SIZE));
                state.btnTop = Math.max(0, Math.min(e.clientY - dragBtn.oy, window.innerHeight - BTN_SIZE));

                positionPopupFromBtn(pop);
                applyLayout(btn, pop);
            }

            if (dragPop.on) {
                // 先移动弹窗
                state.popLeft = Math.max(0, Math.min(e.clientX - dragPop.ox, window.innerWidth - POP_W));
                state.popTop = Math.max(0, Math.min(e.clientY - dragPop.oy, window.innerHeight - (pop.offsetHeight || 180)));

                // 按钮始终跟随弹窗底部
                state.btnLeft = state.popLeft;
                state.btnTop = state.popTop + (pop.offsetHeight || 180) + GAP;

                // 按钮边界
                state.btnLeft = Math.min(state.btnLeft, window.innerWidth - BTN_SIZE);
                state.btnTop = Math.min(state.btnTop, window.innerHeight - BTN_SIZE);

                applyLayout(btn, pop);
            }
        });

        document.addEventListener('mouseup', () => {
            if (dragBtn.on && dragBtn.moved) saveBtnPos();
            if (dragPop.on) saveBtnPos();

            dragBtn.on = false;
            dragPop.on = false;
        });

        btn.addEventListener('click', e => {
            if (dragBtn.moved) return;

            let txt = '';
            try { txt = window.getSelection().toString().trim(); } catch (_) {}
            if (!txt) txt = getSearchInputText();
            if (txt) input.value = txt;

            pop.style.display = 'block';
            positionPopupFromBtn(pop);
            applyLayout(btn, pop);
            input.focus();
        });

        grid.addEventListener('click', e => {
            if (e.target.tagName !== 'BUTTON') return;
            const q = input.value.trim();
            if (!q) return;
            window.open(e.target.dataset.url.replace('{q}', encodeURIComponent(q)), '_blank');
            pop.style.display = 'none';
        });

        input.addEventListener('keydown', e => {
            if (e.key === 'Enter') grid.querySelector('button').click();
        });

        document.addEventListener('mousedown', e => {
            if (!host.contains(e.target)) pop.style.display = 'none';
        });

        const obs = new MutationObserver(() => {
            if (!document.getElementById(HOST_ID) && document.body) {
                obs.disconnect();
                init();
            }
        });
        obs.observe(document.documentElement, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    setInterval(() => {
        if (!document.getElementById(HOST_ID) && document.body) init();
    }, 1000);
})();
