// history-panel.js
// バージョン履歴ブラウザUIパネル

function formatTimestamp(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const yyyy = d.getFullYear();
    const mm   = String(d.getMonth() + 1).padStart(2, '0');
    const dd   = String(d.getDate()).padStart(2, '0');
    const hh   = String(d.getHours()).padStart(2, '0');
    const mi   = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function showConfirmDialog(editor, files) {
    if (!editor || typeof editor.popupWindow !== 'function') {
        return Promise.resolve(window.confirm(
            `以下のファイルをコミット時点の状態に復元します:\n\n${files.join('\n')}\n\n続行しますか？`
        ));
    }
    return new Promise((resolve) => {
        const contents = document.createElement('div');
        contents.style.minWidth = '18em';

        const msg = document.createElement('div');
        msg.textContent = '以下のファイルをコミット時点の状態に復元します:';
        msg.style.marginBottom = '.5em';
        contents.appendChild(msg);

        const list = document.createElement('ul');
        list.style.margin = '0 0 .8em 1em';
        list.style.padding = '0';
        list.style.fontSize = '.9em';
        files.forEach(f => {
            const li = document.createElement('li');
            li.textContent = f;
            list.appendChild(li);
        });
        contents.appendChild(list);

        const controls = document.createElement('div');
        controls.style.display = 'flex';
        controls.style.gap = '.5em';
        controls.style.justifyContent = 'flex-end';
        contents.appendChild(controls);

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'キャンセル';
        cancelBtn.classList.add('meditor-diff-ignore-btn');
        cancelBtn.addEventListener('click', () => { popup.remove(); resolve(false); });
        controls.appendChild(cancelBtn);

        const restoreBtn = document.createElement('button');
        restoreBtn.textContent = '復元する';
        restoreBtn.classList.add('meditor-diff-apply-btn');
        restoreBtn.addEventListener('click', () => { popup.remove(); resolve(true); });
        controls.appendChild(restoreBtn);

        const popup = editor.popupWindow('復元の確認', contents);
        const closeBtn = popup.element.querySelector('.meditor-popup-window-close-button');
        if (closeBtn) closeBtn.addEventListener('click', () => resolve(false));
    });
}

/**
 * @param {object} editor      - MEditor インスタンス
 * @param {function} api       - api(url, body) 関数
 * @param {object} appState    - APP_STATE（CURRENT_FILE.path を参照）
 * @param {function} onRestore - 復元成功後に呼ぶコールバック（エクスプローラー更新用）
 * @returns {{ element: HTMLElement, refresh: () => void, updateFilter: () => void, setTheme: (aceTheme: string) => void }}
 */
export function createHistoryPanel(editor, api, appState, onRestore) {
    // テーマ管理：editor.ACE_THEME を起点にする
    let currentAceTheme = editor.ACE_THEME || 'ace/theme/chrome';
    const activeAceEditors = new Set();

    function clearActiveEditors() {
        for (const ed of activeAceEditors) {
            try { ed.destroy(); } catch (_) {}
        }
        activeAceEditors.clear();
    }

    // raw git diff を Ace エディタに _showDiffUnifiedInEditor と同じマーカーで表示
    function createDiffViewFromGitDiff(rawDiff) {
        const lines     = [];
        const lineTypes = [];

        for (const line of (rawDiff ?? '').split('\n')) {
            if (line.startsWith('diff --git ')) {
                const m = line.match(/b\/(.+)$/);
                lines.push('📄 ' + (m ? m[1] : line));
                lineTypes.push('header');
            } else if (
                line.startsWith('index ') ||
                line.startsWith('--- ') ||
                line.startsWith('+++ ')
            ) {
                // skip
            } else if (line.startsWith('@@')) {
                lines.push('···');
                lineTypes.push('separator');
            } else if (line.startsWith('+')) {
                lines.push('+ ' + line.slice(1));
                lineTypes.push('added');
            } else if (line.startsWith('-')) {
                lines.push('- ' + line.slice(1));
                lineTypes.push('removed');
            } else {
                lines.push('  ' + line.slice(1));
                lineTypes.push('context');
            }
        }
        while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
            lines.pop();
            lineTypes.pop();
        }

        const aceDiv = document.createElement('div');
        aceDiv.style.cssText = 'width:100%;font-size:.85em';

        const aceEditor = ace.edit(aceDiv);
        aceEditor.$blockScrolling = Infinity;
        aceEditor.setOptions({
            readOnly: true,
            maxLines: 40,
            minLines: 2,
            showGutter: false,
            showPrintMargin: false,
            highlightActiveLine: false,
            wrap: true,
            fontSize: '0.85em',
        });
        aceEditor.setTheme(currentAceTheme);
        activeAceEditors.add(aceEditor);

        const Range   = ace.require('ace/range').Range;
        const session = aceEditor.getSession();
        session.setValue(lines.join('\n'));

        for (let i = 0; i < lineTypes.length; i++) {
            if (lineTypes[i] === 'added') {
                session.addMarker(new Range(i, 0, i, 1e5), 'meditor-diff-line-added', 'fullLine');
            } else if (lineTypes[i] === 'removed') {
                session.addMarker(new Range(i, 0, i, 1e5), 'meditor-diff-line-removed', 'fullLine');
            }
        }

        return aceDiv;
    }

    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.height = '100%';
    container.style.fontSize = '.9em';

    // ── ヘッダー ──────────────────────────────
    const header = document.createElement('div');
    header.style.cssText = [
        'display:flex', 'align-items:center', 'gap:.4em',
        'padding:.5em .6em', 'border-bottom:1px solid var(--me-color-border,#ddd)',
        'flex-shrink:0'
    ].join(';');
    container.appendChild(header);

    const refreshBtn = document.createElement('button');
    refreshBtn.textContent = '⟳';
    refreshBtn.title = '更新';
    refreshBtn.classList.add('meditor-web-previewer-reload-btn');
    header.appendChild(refreshBtn);

    const filterLabel = document.createElement('label');
    filterLabel.style.cssText = 'display:flex;align-items:center;gap:.25em;cursor:pointer;color:var(--me-color-text);user-select:none';

    const filterCheckbox = document.createElement('input');
    filterCheckbox.type = 'checkbox';
    filterCheckbox.style.cssText = 'cursor:pointer;margin:0';

    const filterLabelText = document.createElement('span');
    filterLabelText.textContent = 'このファイル';
    filterLabelText.style.fontSize = '.9em';

    filterLabel.appendChild(filterCheckbox);
    filterLabel.appendChild(filterLabelText);
    header.appendChild(filterLabel);

    // ── リスト ────────────────────────────────
    const listArea = document.createElement('div');
    listArea.style.cssText = 'flex:1;overflow-y:auto;padding:.2em 0';
    container.appendChild(listArea);

    function getFilterPath() {
        if (filterCheckbox.checked && appState.CURRENT_FILE?.path) {
            return appState.CURRENT_FILE.path;
        }
        return editor.BASE_DIR || null;
    }

    function updateFilterOptions() {
        const hasFile = !!(appState.CURRENT_FILE?.path);
        filterCheckbox.disabled = !hasFile;
        filterLabel.style.opacity = hasFile ? '1' : '.4';
        filterLabel.style.cursor = hasFile ? 'pointer' : 'not-allowed';
        filterCheckbox.style.cursor = hasFile ? 'pointer' : 'not-allowed';
        if (!hasFile) filterCheckbox.checked = false;
    }

    function setMessage(text, color = '#888') {
        clearActiveEditors();
        listArea.innerHTML = '';
        const el = document.createElement('div');
        el.style.cssText = `padding:.8em .6em;color:${color}`;
        el.textContent = text;
        listArea.appendChild(el);
    }

    async function loadHistory() {
        updateFilterOptions();
        setMessage('読み込み中...');
        try {
            const data = await api('/api/git_manager.php', {
                action: 'history',
                file: getFilterPath(),
                limit: 50
            });
            const commits = data.commits ?? [];
            clearActiveEditors();
            listArea.innerHTML = '';
            if (commits.length === 0) {
                setMessage('履歴がありません');
                return;
            }
            commits.forEach(c => renderCommit(c));
        } catch (e) {
            setMessage('読み込みに失敗しました', '#c00');
            console.error('[history-panel] loadHistory error:', e);
        }
    }

    function makeOutlineBtn(label, borderColor, textColor) {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.style.cssText = [
            'flex-shrink:0', 'cursor:pointer',
            'font-size:.85em', 'padding:2px 8px',
            `border:1px solid ${borderColor}`, 'border-radius:3px',
            'background:transparent', `color:${textColor}`,
            'transition:background .15s,color .15s'
        ].join(';');
        btn.addEventListener('mouseenter', () => {
            btn.style.background = borderColor;
            btn.style.color = '#fff';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.background = 'transparent';
            btn.style.color = textColor;
        });
        return btn;
    }

    function renderCommit(c) {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'border-bottom:1px solid var(--me-color-border,#eee)';

        // ── コミット行 ──
        const item = document.createElement('div');
        item.style.cssText = [
            'display:flex', 'align-items:flex-start',
            'justify-content:space-between',
            'padding:.45em .6em', 'gap:.3em'
        ].join(';');

        const info = document.createElement('div');
        info.style.cssText = 'flex:1;min-width:0';

        const ts = document.createElement('div');
        ts.textContent = formatTimestamp(c.timestamp);
        ts.style.cssText = 'font-size:.8em;color:#888;line-height:1.4';
        info.appendChild(ts);

        const msg = document.createElement('div');
        msg.textContent = c.message;
        msg.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.4';
        info.appendChild(msg);

        item.appendChild(info);

        const diffBtn = makeOutlineBtn('差分', 'var(--me-color-border,#aaa)', 'var(--me-color-text,#333)');
        item.appendChild(diffBtn);

        const restoreBtn = makeOutlineBtn('復元', '#4caf50', '#4caf50');
        restoreBtn.addEventListener('click', () => doRestore(c.hash, restoreBtn));
        item.appendChild(restoreBtn);

        wrapper.appendChild(item);

        // ── diff 展開エリア ──
        const diffArea = document.createElement('div');
        diffArea.style.display = 'none';
        wrapper.appendChild(diffArea);

        let diffLoaded = false;

        diffBtn.addEventListener('click', async () => {
            const expanding = diffArea.style.display === 'none';
            diffArea.style.display = expanding ? 'block' : 'none';
            diffBtn.textContent = expanding ? '▲ 差分' : '差分';

            if (!expanding || diffLoaded) return;
            diffLoaded = true;

            const loading = document.createElement('div');
            loading.style.cssText = 'padding:.5em .6em;color:#888;font-size:.85em';
            loading.textContent = '読み込み中...';
            diffArea.appendChild(loading);

            const filterPath = filterCheckbox.checked && appState.CURRENT_FILE?.path
                ? appState.CURRENT_FILE.path : null;

            try {
                const data = await api('/api/git_manager.php', {
                    action: 'commit_diff',
                    hash: c.hash,
                    file: filterPath
                });
                diffArea.innerHTML = '';

                const rawDiff = data.diff ?? '';
                if (!rawDiff.trim()) {
                    appendNote(diffArea, '変更なし');
                    return;
                }
                diffArea.appendChild(createDiffViewFromGitDiff(rawDiff));
            } catch (e) {
                loading.textContent = '差分の取得に失敗しました';
                loading.style.color = '#c00';
                console.error('[history-panel] diff error:', e);
            }
        });

        listArea.appendChild(wrapper);
    }

    function appendNote(container, text) {
        const el = document.createElement('div');
        el.style.cssText = 'padding:.4em .6em;font-size:.85em;color:#888';
        el.textContent = text;
        container.appendChild(el);
    }

    async function doRestore(hash, btn) {
        btn.disabled = true;
        try {
            const filesData = await api('/api/git_manager.php', { action: 'commit_files', hash });
            const confirmed = await showConfirmDialog(editor, filesData.files ?? []);
            if (!confirmed) return;

            await api('/api/git_manager.php', { action: 'restore', hash });
            await loadHistory();
            if (typeof onRestore === 'function') onRestore();
        } catch (e) {
            console.error('[history-panel] restore error:', e);
        } finally {
            btn.disabled = false;
        }
    }

    filterCheckbox.addEventListener('change', loadHistory);
    refreshBtn.addEventListener('click', loadHistory);

    return {
        element: container,
        refresh: loadHistory,
        updateFilter: updateFilterOptions,
        setTheme(aceTheme) {
            currentAceTheme = aceTheme;
            for (const ed of activeAceEditors) ed.setTheme(aceTheme);
        }
    };
}
