/* ============================================================
   記事の編集モード（article-editor.js）
   assets/affiliates.js の✏️ボタンから初回のみ動的に読み込まれる。

   できること：
   - .lp-wrap 内の本文（見出し・段落・リストなど）をその場で直接編集できる
   - 章（<section class="nl-block">）を好きな位置に追加・削除できる
   - バナー枠（data-aff-banner-slot）・ランダム枠（data-aff-random-slot）を
     好きな位置に追加・削除でき、どの登録案件を使うかも選べる
   - 既存のリンク・ヒーローカード・バナー枠がどの登録案件（affiliates.jsonのキー）を
     使うかを選び直せる
   - 「GitHubに保存」を押すと、.lp-wrap の中身をまるごと今の状態でコミットする
     （それまでは全部ローカルの下書き。何度でも選び直し・書き直しできる）

   保存の仕組み：
   記事ソースを取得した時点の「.lp-wrap の開始〜対応する終了divまで」の生テキスト範囲を
   記録しておき、保存時にその範囲を「今の .lp-wrap のinnerHTML」で丸ごと置き換える。
   小さいパッチを積み重ねる方式ではなく、常に今の編集結果をそのまま書き出す方式にすることで、
   本文編集・章の追加・削除・バナー差し替えのすべてを1つの仕組みで扱えるようにしている。

   できないこと（v1のスコープ外）：
   - 目次（.lp-toc）の自動更新（章を追加しても目次には出ない。目次のリンクは手動編集は可能）
   - 章の並べ替え（ドラッグ移動）。位置を変えたい場合は一度削除して入れ直してください。
   ============================================================ */
(function(){
  var GH_SETTINGS_KEY = 'paytaku-gh-settings'; // admin/affiliates.html と共通
  var editMode = false;
  var panel = null;
  var dirty = false;
  var rawSource = null;   // GitHubから取得した現在のファイルの生テキスト
  var rawSha = null;
  var wrapRange = null;   // rawSource内での .lp-wrap innerHTML の [start, end) 位置
  var slug = location.pathname.split('/').pop().replace(/\.html$/, '');
  var filePath = 'articles/' + slug + '.html';
  var affLinks = {}, affBanners = {}, affNames = {}; // affiliates.jsonの中身

  // 本文として直接編集してよい要素（このセレクタに一致し、かつ除外対象の外にあるものだけ
  // contenteditable にする）。除外対象＝アフィリエイトの仕組みが管理している範囲。
  var EDITABLE_SELECTOR = 'h1, h2, h3, p, li, .nl-text, .lp-tagline, .lp-body-text, .nl-hero-copy, ' +
    '.nl-point-title, .nl-point-desc, .nl-caution-text, .nl-faq-q, .nl-step .t, .nl-step .d, .lp-flow-step div:not(.lp-flow-num)';
  var NOT_EDITABLE_ANCESTOR_SELECTOR = '[data-aff], .lp-banner-box, .lp-hero-card, .lp-apply-btn, .lp-toc, .lp-breadcrumb, .aff-code-hint';

  function getGhSettings(){
    try{
      var raw = localStorage.getItem(GH_SETTINGS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch(e){ return null; }
  }

  function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function escAttr(s){ return esc(s).replace(/"/g,'&quot;'); }

  function loadAffData(){
    var affUrl = new URL('../affiliates.json', location.href);
    return fetch(affUrl.href, { cache: 'no-cache' })
      .then(function(r){ return r.ok ? r.json() : {}; })
      .then(function(data){
        affLinks = data.links || {};
        affBanners = data.banners || {};
        affNames = data.names || {};
      })
      .catch(function(){ affLinks = {}; affBanners = {}; affNames = {}; });
  }

  function fetchRawSource(){
    var gh = getGhSettings();
    if(!gh || !gh.owner || !gh.repo || !gh.token){
      return Promise.reject(new Error('GitHub未接続です。紹介リンク管理の「GitHub設定」タブで先に接続してください。'));
    }
    var branch = gh.branch || 'main';
    var apiUrl = 'https://api.github.com/repos/' + gh.owner + '/' + gh.repo + '/contents/' + filePath + '?ref=' + branch;
    return fetch(apiUrl, {
      headers: { 'Authorization': 'token ' + gh.token, 'Accept': 'application/vnd.github.v3+json' }
    }).then(function(r){
      if(!r.ok) throw new Error('記事ソースの取得に失敗しました（' + r.status + '）');
      return r.json();
    }).then(function(json){
      rawSha = json.sha;
      var b64 = (json.content || '').replace(/\n/g, '');
      rawSource = decodeURIComponent(escape(atob(b64)));
      wrapRange = findWrapRange(rawSource);
      if(!wrapRange) throw new Error('記事ソース内で編集対象の範囲（.lp-wrap）を見つけられませんでした。この記事は編集モードに対応していない可能性があります。');
      return rawSource;
    });
  }

  // rawSource内で <div class="lp-wrap"> の開始位置〜対応する閉じdivの位置を探す。
  // ネストしたdivをタグの出現順で数えるだけの単純なスキャナ（このサイトのテンプレートは
  // .lp-wrap 内に <script> を含まないため、これで安全に対応が取れる）。
  function findWrapRange(text){
    var openTag = '<div class="lp-wrap">';
    var start = text.indexOf(openTag);
    if(start === -1) return null;
    var contentStart = start + openTag.length;
    var depth = 1;
    var i = contentStart;
    while(depth > 0){
      var nextOpen = text.indexOf('<div', i);
      var nextClose = text.indexOf('</div>', i);
      if(nextClose === -1) return null;
      if(nextOpen !== -1 && nextOpen < nextClose){
        depth++;
        i = nextOpen + 4;
      } else {
        depth--;
        if(depth === 0) return { start: contentStart, end: nextClose };
        i = nextClose + 6;
      }
    }
    return null;
  }

  function markDirty(){
    dirty = true;
    var btn = document.getElementById('aeSaveBtn');
    if(btn) btn.disabled = false;
    var el = document.getElementById('aePendingCount');
    if(el) el.textContent = '未保存の変更があります';
  }

  /* ---------------- 本文の直接編集 ---------------- */
  function isInsideExcluded(el){
    return !!el.closest(NOT_EDITABLE_ANCESTOR_SELECTOR);
  }

  function enableContentEditing(root){
    root.querySelectorAll(EDITABLE_SELECTOR).forEach(function(el){
      if(isInsideExcluded(el)) return;
      if(el.dataset.aeEditableBound) return;
      el.dataset.aeEditableBound = '1';
      el.setAttribute('contenteditable', 'true');
      el.classList.add('ae-editable');
      el.addEventListener('input', markDirty);
      el.addEventListener('focus', function(){ el.classList.add('ae-editing'); });
      el.addEventListener('blur', function(){ el.classList.remove('ae-editing'); });
    });
  }

  function disableContentEditing(root){
    root.querySelectorAll('[data-ae-editable-bound]').forEach(function(el){
      el.removeAttribute('contenteditable');
      el.classList.remove('ae-editable', 'ae-editing');
      delete el.dataset.aeEditableBound;
    });
  }

  /* ---------------- リンク・バナーの割り当て一覧 ---------------- */
  function affSelectHtml(currentKey){
    var keys = Object.keys(affNames);
    var opts = '<option value="">（削除）</option>' + keys.map(function(k){
      return '<option value="' + escAttr(k) + '"' + (k === currentKey ? ' selected' : '') + '>' + esc(affNames[k]) + '（' + esc(k) + '）</option>';
    }).join('');
    return '<select class="ae-slot-select">' + opts + '</select>';
  }

  // バナー枠用：そのキーに複数バナーが登録されているときだけ「どのバナーを出すか」を選べるようにする。
  // 未選択（自動）なら、他の同キー枠との自動配分（均等な間隔での振り分け）に任せる。
  function bannerIdxSelectHtml(key, currentIdx){
    var arr = affBanners[key];
    var list = Array.isArray(arr) ? arr : (arr ? [arr] : []);
    if(list.length <= 1) return '';
    var opts = '<option value="">自動（おまかせ）</option>' + list.map(function(b, i){
      var label = 'バナー' + (i + 1) + (b && b.title ? '：' + b.title : '');
      return '<option value="' + i + '"' + (String(currentIdx) === String(i) ? ' selected' : '') + '>' + esc(label) + '</option>';
    }).join('');
    return '<select class="ae-banner-idx-select">' + opts + '</select>';
  }

  function collectAssignableSlots(root){
    var out = [];
    root.querySelectorAll('[data-aff]').forEach(function(el){
      out.push({ el: el, attr: 'data-aff', key: el.getAttribute('data-aff'), label: 'リンク／ボタン「' + (el.textContent || '').trim().slice(0, 20) + '」' });
    });
    root.querySelectorAll('[data-aff-hero]').forEach(function(el){
      out.push({ el: el, attr: 'data-aff-hero', key: el.getAttribute('data-aff-hero'), label: 'ヒーローカード' });
    });
    root.querySelectorAll('[data-aff-banner-slot]').forEach(function(el){
      out.push({ el: el, attr: 'data-aff-banner-slot', key: el.getAttribute('data-aff-banner-slot'), label: 'バナー枠',
        bannerIdx: el.getAttribute('data-aff-banner-idx') });
    });
    return out;
  }

  function renderSlotList(){
    var body = document.getElementById('aeSlotList');
    var slots = collectAssignableSlots(document.querySelector('.lp-wrap'));
    var randomSlots = document.querySelectorAll('.lp-wrap [data-aff-random-slot]');
    if(!slots.length && !randomSlots.length){
      body.innerHTML = '<div class="ae-empty">この記事にはまだリンク・バナー枠がありません。下の「＋」から追加できます。</div>';
      return;
    }
    var html = slots.map(function(slot, i){
      var idxSelectHtml = slot.attr === 'data-aff-banner-slot' ? bannerIdxSelectHtml(slot.key, slot.bannerIdx) : '';
      return '<div class="ae-slot" data-idx="' + i + '">'
        + '<div class="ae-slot-label">' + esc(slot.label) + '</div>'
        + affSelectHtml(slot.key)
        + idxSelectHtml
        + '<button type="button" class="ae-del-btn" data-idx="' + i + '" title="この要素ごと削除">🗑</button>'
        + '</div>';
    }).join('');
    if(randomSlots.length){
      html += Array.prototype.map.call(randomSlots, function(el, i){
        return '<div class="ae-slot" data-random-idx="' + i + '">'
          + '<div class="ae-slot-label">ランダム枠（アプリ案件・自動選択）</div>'
          + '<button type="button" class="ae-del-btn" data-random-idx="' + i + '" title="この枠ごと削除">🗑</button>'
          + '</div>';
      }).join('');
    }
    body.innerHTML = html;

    body.querySelectorAll('.ae-slot[data-idx]').forEach(function(row){
      var idx = Number(row.getAttribute('data-idx'));
      var slot = slots[idx];
      row.querySelector('.ae-slot-select').addEventListener('change', function(e){
        var newKey = e.target.value;
        if(!newKey){ slot.el.remove(); }
        else {
          slot.el.setAttribute(slot.attr, newKey);
          slot.el.removeAttribute('data-aff-banner-idx'); // カードを変えたら固定指定はリセット（別カードの番号が残るのを防ぐ）
          livePreviewUpdate(slot, newKey, null);
        }
        markDirty();
        renderSlotList();
      });
      var idxSelect = row.querySelector('.ae-banner-idx-select');
      if(idxSelect){
        idxSelect.addEventListener('change', function(e){
          var v = e.target.value;
          if(v === ''){ slot.el.removeAttribute('data-aff-banner-idx'); }
          else { slot.el.setAttribute('data-aff-banner-idx', v); }
          livePreviewUpdate(slot, slot.key, v === '' ? null : Number(v));
          markDirty();
        });
      }
      row.querySelector('.ae-del-btn').addEventListener('click', function(){
        slot.el.remove();
        markDirty();
        renderSlotList();
      });
    });
    body.querySelectorAll('.ae-slot[data-random-idx]').forEach(function(row){
      var idx = Number(row.getAttribute('data-random-idx'));
      row.querySelector('.ae-del-btn').addEventListener('click', function(){
        randomSlots[idx].remove();
        markDirty();
        renderSlotList();
      });
    });
  }

  // 割り当て変更を、可能な範囲でその場でも見た目に反映する（保存前のプレビュー用）
  function livePreviewUpdate(slot, newKey, bannerIdx){
    var link = affLinks[newKey];
    var url = link ? (typeof link === 'string' ? link : link.url) : null;
    if(slot.attr === 'data-aff' && url && slot.el.tagName === 'A'){
      slot.el.setAttribute('href', url);
    }
    if(slot.attr === 'data-aff-hero'){
      var banner = affBanners[newKey];
      var b = Array.isArray(banner) ? banner[0] : banner;
      var img = slot.el.querySelector('.lp-hero-card-img');
      if(img && b && b.img) img.setAttribute('src', b.img);
      var nameEl = slot.el.querySelector('.lp-hero-card-name');
      if(nameEl) nameEl.textContent = affNames[newKey] || newKey;
    }
    if(slot.attr === 'data-aff-banner-slot'){
      var banner2list = affBanners[newKey];
      var banner2arr = Array.isArray(banner2list) ? banner2list : (banner2list ? [banner2list] : []);
      // 固定指定（bannerIdx）があればそれを、無ければ1枚目をプレビューに使う。
      // 実際の自動配分（複数枠での均等な振り分け）は保存後、記事側のaffiliates.jsが行う。
      var b2 = (bannerIdx != null && banner2arr[bannerIdx]) ? banner2arr[bannerIdx] : banner2arr[0];
      if(b2 && b2.img && b2.href){
        slot.el.innerHTML = '<div class="lp-banner-label">📣 PR</div>'
          + '<a href="' + escAttr(b2.href) + '" target="_blank" rel="sponsored noopener nofollow">'
          + '<img src="' + escAttr(b2.img) + '" alt="' + escAttr(affNames[newKey] || newKey) + '" class="lp-banner-img" loading="lazy"></a>';
        slot.el.className = 'lp-banner-box';
      } else {
        slot.el.innerHTML = '<div class="ae-placeholder-note">［' + esc(affNames[newKey] || newKey) + ' のバナー未登録］</div>';
      }
    }
  }

  /* ---------------- 章・バナー枠の追加 ---------------- */
  function buildInsertBar(){
    var bar = document.createElement('div');
    bar.className = 'ae-insert-bar';
    bar.innerHTML =
      '<button type="button" class="ae-insert-btn" data-action="section">＋ 章を追加</button>'
      + '<button type="button" class="ae-insert-btn" data-action="banner">＋ バナー枠を追加</button>'
      + '<button type="button" class="ae-insert-btn" data-action="random">＋ ランダム枠を追加</button>';
    bar.querySelectorAll('.ae-insert-btn').forEach(function(btn){
      btn.addEventListener('click', function(){
        insertAt(bar, btn.getAttribute('data-action'));
      });
    });
    return bar;
  }

  function insertAt(afterEl, kind){
    var newEl;
    if(kind === 'section'){
      newEl = document.createElement('section');
      newEl.className = 'nl-block';
      newEl.innerHTML = '<h2 class="nl-h2-plain">新しい章の見出し</h2><p class="nl-text">ここに本文を入力してください。</p>';
    } else if(kind === 'banner'){
      var firstKey = Object.keys(affNames)[0] || '';
      newEl = document.createElement('div');
      newEl.setAttribute('data-aff-banner-slot', firstKey);
      newEl.innerHTML = '<div class="ae-placeholder-note">［' + esc(affNames[firstKey] || firstKey || '未選択') + ' のバナー枠］</div>';
    } else {
      newEl = document.createElement('div');
      newEl.setAttribute('data-aff-random-slot', '');
      newEl.innerHTML = '<div class="ae-placeholder-note">［ランダム枠（アプリ案件）］</div>';
    }
    afterEl.insertAdjacentElement('afterend', newEl);
    // 新しい挿入バーもその後ろに置き直す（連続して追加しやすいように）
    var newBar = buildInsertBar();
    newEl.insertAdjacentElement('afterend', newBar);
    if(kind === 'section'){
      enableContentEditing(newEl);
      injectSectionDeleteButtons();
    }
    markDirty();
    renderSlotList();
  }

  function injectInsertBars(){
    var wrap = document.querySelector('.lp-wrap');
    if(!wrap) return;
    // 既存の挿入バーは一旦除去してから、各section・バナー枠・ランダム枠の直後に置き直す
    wrap.querySelectorAll('.ae-insert-bar').forEach(function(b){ b.remove(); });
    var anchors = wrap.querySelectorAll('section.nl-block, section.lp-section, [data-aff-banner-slot], [data-aff-random-slot]');
    if(!anchors.length){
      // 章が1つも無い記事でも最低1箇所は追加できるようにする
      wrap.appendChild(buildInsertBar());
      return;
    }
    anchors.forEach(function(a){
      a.insertAdjacentElement('afterend', buildInsertBar());
    });
  }

  function removeInsertBars(){
    document.querySelectorAll('.ae-insert-bar').forEach(function(b){ b.remove(); });
  }

  // 既存の章にも削除ボタンを付ける
  function injectSectionDeleteButtons(){
    document.querySelectorAll('.lp-wrap section.nl-block, .lp-wrap section.lp-section').forEach(function(sec){
      if(sec.querySelector(':scope > .ae-section-del')) return;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ae-section-del';
      btn.title = 'この章を削除';
      btn.textContent = '🗑 この章を削除';
      btn.addEventListener('click', function(){
        if(!confirm('この章を削除しますか？')) return;
        sec.remove();
        markDirty();
        renderSlotList();
      });
      sec.insertBefore(btn, sec.firstChild);
    });
  }

  function removeSectionDeleteButtons(){
    document.querySelectorAll('.ae-section-del').forEach(function(b){ b.remove(); });
  }

  /* ---------------- パネルUI ---------------- */
  function buildPanel(){
    var el = document.createElement('div');
    el.id = 'articleEditorPanel';
    el.innerHTML =
      '<div class="ae-header">'
        + '<span class="ae-title">✏️ 記事の編集モード</span>'
        + '<button type="button" class="ae-close" id="aeClose">×</button>'
      + '</div>'
      + '<div class="ae-status" id="aeStatus"></div>'
      + '<div class="ae-tabs">'
        + '<div class="ae-tab-label">本文は記事内で直接クリックして編集できます。バナー・リンクの割り当てはここから：</div>'
      + '</div>'
      + '<div class="ae-body" id="aeSlotList"><div class="ae-loading">読み込み中…</div></div>'
      + '<div class="ae-footer">'
        + '<span class="ae-pending-count" id="aePendingCount">変更なし</span>'
        + '<button type="button" class="ae-save-btn" id="aeSaveBtn" disabled>GitHubに保存</button>'
      + '</div>';
    document.body.appendChild(el);
    document.getElementById('aeClose').addEventListener('click', closeEditMode);
    document.getElementById('aeSaveBtn').addEventListener('click', commitToGithub);
    return el;
  }

  function setStatus(msg, type){
    var el = document.getElementById('aeStatus');
    if(!el) return;
    el.textContent = msg || '';
    el.className = 'ae-status' + (msg ? ' show' : '') + (type ? ' ' + type : '');
  }

  function commitToGithub(){
    var gh = getGhSettings();
    if(!gh || !gh.owner || !gh.repo || !gh.token){
      setStatus('GitHub未接続です。紹介リンク管理の「GitHub設定」タブで先に接続してください。', 'error');
      return;
    }
    if(!dirty || rawSource == null || !wrapRange){
      setStatus('保存する変更がありません。', 'warn');
      return;
    }
    setStatus('保存中…', 'warn');
    var btn = document.getElementById('aeSaveBtn');
    btn.disabled = true;

    // 編集用に付けたUI要素（挿入バー・削除ボタン・contenteditable属性）を取り除いた
    // クリーンな状態でシリアライズしてからコミットする
    var wrap = document.querySelector('.lp-wrap');
    var clone = wrap.cloneNode(true);
    clone.querySelectorAll('.ae-insert-bar, .ae-section-del').forEach(function(n){ n.remove(); });
    clone.querySelectorAll('[contenteditable]').forEach(function(n){
      n.removeAttribute('contenteditable');
      n.classList.remove('ae-editable', 'ae-editing');
    });

    var newInnerHtml = clone.innerHTML;
    var newText = rawSource.slice(0, wrapRange.start) + newInnerHtml + rawSource.slice(wrapRange.end);

    var branch = gh.branch || 'main';
    var apiUrl = 'https://api.github.com/repos/' + gh.owner + '/' + gh.repo + '/contents/' + filePath;
    var b64 = btoa(unescape(encodeURIComponent(newText)));
    fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': 'token ' + gh.token,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: '[記事編集モード] ' + slug + ' を編集',
        content: b64,
        sha: rawSha,
        branch: branch,
      }),
    }).then(function(r){
      if(!r.ok) return r.json().then(function(j){ throw new Error('保存エラー（' + r.status + '）: ' + (j.message || '不明なエラー')); });
      return r.json();
    }).then(function(json){
      rawSha = json.content && json.content.sha ? json.content.sha : rawSha;
      rawSource = newText;
      wrapRange = findWrapRange(rawSource);
      dirty = false;
      document.getElementById('aePendingCount').textContent = '変更なし';
      setStatus('✓ GitHubに保存しました。1〜2分でサイトに反映されます。', 'ok');
    }).catch(function(err){
      setStatus(err.message || '保存に失敗しました。', 'error');
    }).finally(function(){
      btn.disabled = !dirty;
    });
  }

  function openEditMode(){
    editMode = true;
    document.body.classList.add('ae-active');
    if(!panel) panel = buildPanel();
    panel.style.display = '';
    setStatus('記事ソースを読み込み中…', 'warn');

    Promise.all([loadAffData(), fetchRawSource()])
      .then(function(){
        setStatus('', null);
        var wrap = document.querySelector('.lp-wrap');
        enableContentEditing(wrap);
        injectSectionDeleteButtons();
        injectInsertBars();
        renderSlotList();
      })
      .catch(function(err){
        document.getElementById('aeSlotList').innerHTML = '';
        setStatus(err.message || '読み込みに失敗しました。', 'error');
      });
  }

  function closeEditMode(){
    if(dirty && !confirm('保存していない変更があります。編集モードを終了しますか？（変更は破棄されません。もう一度✏️を押せば続きから編集できます）')) return;
    editMode = false;
    document.body.classList.remove('ae-active');
    if(panel) panel.style.display = 'none';
    var wrap = document.querySelector('.lp-wrap');
    if(wrap){ disableContentEditing(wrap); removeSectionDeleteButtons(); removeInsertBars(); }
  }

  window.toggleArticleEditMode = function(){
    if(editMode){ closeEditMode(); } else { openEditMode(); }
  };

  // パネル・編集UI用の最小限のスタイルをここで注入する（articles.cssを汚さないよう分離）
  var style = document.createElement('style');
  style.textContent =
    '#articleEditorPanel{position:fixed;right:16px;bottom:16px;left:16px;max-width:420px;margin-left:auto;'
    + 'background:var(--surface,#1E293B);border:1px solid var(--line,#334155);border-radius:14px;'
    + 'box-shadow:0 12px 32px rgba(0,0,0,0.35);z-index:9999;font-family:"Noto Sans JP",system-ui,sans-serif;'
    + 'max-height:75vh;display:flex;flex-direction:column;}'
    + '.ae-header{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid var(--line,#334155);}'
    + '.ae-title{font-weight:800;font-size:13.5px;color:var(--text,#F1F5F9);}'
    + '.ae-close{background:none;border:none;font-size:18px;color:var(--muted,#94A3B8);cursor:pointer;line-height:1;}'
    + '.ae-status{padding:0 14px;font-size:12px;color:var(--muted,#94A3B8);}'
    + '.ae-status.show{padding:8px 14px;}'
    + '.ae-status.ok{color:#10B981;}'
    + '.ae-status.warn{color:#F59E0B;}'
    + '.ae-status.error{color:#F87171;}'
    + '.ae-tab-label{padding:8px 14px 0;font-size:11px;color:var(--dim,#64748B);line-height:1.6;}'
    + '.ae-body{overflow-y:auto;padding:10px 14px;flex:1;}'
    + '.ae-loading,.ae-empty{color:var(--dim,#64748B);font-size:12.5px;padding:10px 0;}'
    + '.ae-slot{display:flex;align-items:center;gap:6px;padding:8px 0;border-bottom:1px solid var(--line,#334155);flex-wrap:wrap;}'
    + '.ae-slot:last-child{border-bottom:none;}'
    + '.ae-slot-label{flex:0 0 90px;font-size:11px;font-weight:700;color:var(--text,#F1F5F9);line-height:1.4;}'
    + '.ae-slot-select{flex:1;padding:6px 6px;border-radius:8px;border:1px solid var(--line,#334155);'
    + 'background:var(--surface2,#273449);color:var(--text,#F1F5F9);font-size:11.5px;font-family:inherit;min-width:0;}'
    + '.ae-banner-idx-select{flex:1 1 100%;margin-left:96px;padding:5px 6px;border-radius:8px;border:1px solid var(--line,#334155);'
    + 'background:var(--surface2,#273449);color:var(--muted,#94A3B8);font-size:11px;font-family:inherit;min-width:0;}'
    + '.ae-del-btn{flex:0 0 auto;background:none;border:none;font-size:14px;cursor:pointer;padding:4px;}'
    + '.ae-footer{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 14px;border-top:1px solid var(--line,#334155);}'
    + '.ae-pending-count{font-size:11px;color:var(--dim,#64748B);}'
    + '.ae-save-btn{padding:8px 14px;border-radius:8px;border:none;background:var(--primary,#4F46E5);color:#fff;'
    + 'font-size:12.5px;font-weight:700;cursor:pointer;}'
    + '.ae-save-btn:disabled{opacity:.45;cursor:default;}'
    + 'body.ae-active .ae-editable{outline:1px dashed rgba(79,70,229,0.4);outline-offset:2px;cursor:text;border-radius:3px;}'
    + 'body.ae-active .ae-editable.ae-editing{outline:2px solid #4F46E5;background:rgba(79,70,229,0.06);}'
    + '.ae-insert-bar{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin:10px 0;padding:6px;'
    + 'border:1px dashed rgba(79,70,229,0.35);border-radius:10px;}'
    + '.ae-insert-btn{padding:5px 10px;border-radius:999px;border:1px solid #4F46E5;background:none;'
    + 'color:#4F46E5;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;}'
    + '.ae-insert-btn:hover{background:rgba(79,70,229,0.1);}'
    + '.ae-section-del{display:block;margin-bottom:8px;padding:4px 10px;border-radius:999px;border:1px solid #F87171;'
    + 'background:none;color:#F87171;font-size:10.5px;font-weight:700;cursor:pointer;font-family:inherit;}'
    + '.ae-placeholder-note{padding:14px;text-align:center;font-size:11px;color:var(--dim,#64748B);'
    + 'border:1px dashed var(--line,#334155);border-radius:8px;}';
  document.head.appendChild(style);
})();
