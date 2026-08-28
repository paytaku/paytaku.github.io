/* ============================================================
   アフィリリンク自動差し込み（affiliates.js）
   affiliates.json を読み込み：
   - data-aff="キー" → href / ボタン文言を差し替え
   - data-aff-banner="キー" → バナー表示（配列の先頭、またはdata-aff-banner-idx指定）
   - data-aff-pending="キー" → まだリンク未設定のカード（例：モッピー・ポイントインカムなど）を
     「準備中」表示にしておき、affiliates.jsonに実URLが登録された瞬間、記事側を一切編集せずに
     自動で申し込みボタンを表示する（詳しくはファイル末尾のブロックを参照）
   JSON取得失敗時はHTMLの元href/文言をそのまま使う（フォールバック）。
   ============================================================ */
(function(){
  // href に入れて良いURLか（http/httpsのみ許可）。
  // affiliates.json は管理画面から自由入力できるため、javascript: 等の危険なスキームが
  // 紛れ込んでも「申し込む」ボタンを押した一般訪問者側でスクリプトが実行されないようにする。
  function isSafeHttpUrl(str){
    if(!str || typeof str !== 'string') return false;
    try{
      var u = new URL(str, location.href);
      return u.protocol === 'http:' || u.protocol === 'https:';
    }catch(_e){
      return false;
    }
  }

  var url = new URL('../affiliates.json', document.currentScript ? document.currentScript.src : location.href);
  fetch(url.href, { cache: 'no-cache' })
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(data){
      if(!data) return;
      var links   = data.links   || {};
      var banners = data.banners || {};
      var names   = data.names   || {};

      // ポイントサイト名 → そのポイントサイト自身のカードキー、の逆引き表を作る。
      // 例：hapitas-signup が {isPointSite:true} かつ names["hapitas-signup"]==="ハピタス" なら、
      //     via==="ハピタス" のカードから hapitas-signup 側のURL・バナーを引けるようにする。
      var pointSiteKeyByName = {};
      Object.keys(links).forEach(function(k){
        var l = links[k];
        if(l && l.isPointSite && names[k]){
          pointSiteKeyByName[names[k]] = k;
        }
      });

      /* ---- CTAリンクの差し替え ---- */
      document.querySelectorAll('a[data-aff]').forEach(function(a){
        var key   = a.getAttribute('data-aff');
        var entry = links[key];
        if(!entry) return;

        var href, type, via, code;
        if(typeof entry === 'string'){
          href = entry; type = 'direct';
        } else {
          href = entry.url; type = entry.type || 'direct'; via = entry.via; code = entry.code;
        }
        if(href && isSafeHttpUrl(href)) a.setAttribute('href', href);

        /* ポイントサイト経由なら文言を差し替え（data-aff-keeptext があれば維持） */
        if(type === 'point' && via && !a.hasAttribute('data-aff-keeptext')){
          var pr = /（PR）\s*$/.test(a.textContent) ? '（PR）' : '';
          a.textContent = via + '経由で申し込む' + (pr ? ' ' + pr : '');
        }

        /* 紹介コード：ポイントサイト経由＋コード登録があれば、ボタンの直後に
           「紹介リンク・紹介コード・バナー」の3点セットとして自動表示する。
           記事HTML側の修正は不要（affiliates.jsonにcodeを登録するだけで反映される）。 */
        var existingHint = a.nextElementSibling;
        var hasHint = existingHint && existingHint.classList && existingHint.classList.contains('aff-code-hint');
        if(type === 'point' && code){
          var hint = hasHint ? existingHint : document.createElement('div');
          hint.className = 'aff-code-hint';
          hint.innerHTML = '紹介コード：<code class="aff-code-value">' + code.replace(/</g,'&lt;') + '</code>'
            + '<button type="button" class="aff-code-copy">コピー</button>';
          if(!hasHint) a.insertAdjacentElement('afterend', hint);
          var btn = hint.querySelector('.aff-code-copy');
          btn.onclick = function(){
            navigator.clipboard && navigator.clipboard.writeText(code).then(function(){
              btn.textContent = 'コピーしました';
              setTimeout(function(){ btn.textContent = 'コピー'; }, 1500);
            });
          };
        } else if(hasHint){
          existingHint.remove(); // コードが無くなった場合は表示も消す
        }

        /* ポイントサイト経由の案内＋そのポイントサイト自身のバナー・登録リンクを自動挿入する。
           記事側は一切編集不要：カード側を「ポイントサイト経由」に設定するだけで、
           全記事のCTA直後に「◯◯経由がお得です」の案内とポイントサイトのバナーが差し込まれる。
           挿入位置は紹介コード欄（あれば）のさらに直後。 */
        var afterEl = (a.nextElementSibling && a.nextElementSibling.classList && a.nextElementSibling.classList.contains('aff-code-hint'))
          ? a.nextElementSibling : a;
        var existingPromo = afterEl.nextElementSibling;
        var hasPromo = existingPromo && existingPromo.classList && existingPromo.classList.contains('aff-point-promo');

        if(type === 'point' && via){
          var psKey = pointSiteKeyByName[via];
          var psEntry = psKey ? links[psKey] : null;
          var psUrl = psEntry && psEntry.url && psEntry.url !== '#' ? psEntry.url : null;
          var psBannerArr = psKey ? banners[psKey] : null;
          var psBanner = psBannerArr ? (Array.isArray(psBannerArr) ? psBannerArr[0] : psBannerArr) : null;

          var promo = hasPromo ? existingPromo : document.createElement('div');
          promo.className = 'aff-point-promo';
          var html = '<p class="aff-point-promo-text">💡 直接申し込むより<b>' + via + '経由の方がお得</b>です。'
            + 'カードの成果ポイントに加えて、' + via + 'の新規登録ポイントも別途受け取れます。</p>';
          if(psUrl){
            html += '<a class="aff-point-promo-link" href="' + psUrl + '" target="_blank" rel="sponsored noopener nofollow">'
              + '→ ' + via + 'に登録する（未登録の方）</a>';
          }
          if(psBanner && psBanner.img && psBanner.href){
            html += '<a class="aff-point-promo-banner" href="' + psBanner.href + '" target="_blank" rel="sponsored noopener nofollow">'
              + '<img src="' + psBanner.img + '" alt="' + (psBanner.title || via) + '" loading="lazy"></a>';
          }
          promo.innerHTML = html;
          if(!hasPromo) afterEl.insertAdjacentElement('afterend', promo);
        } else if(hasPromo){
          existingPromo.remove(); // 直アフィリエイトに戻した場合は表示も消す
        }
      });

      /* ---- バナーの差し込み ---- */
      /*
       * 単体: data-aff-banner="キー" [data-aff-banner-idx="0"]
       * 複数: data-aff-banner-list="キー"
       *   → affiliates.json の banners[キー] に登録されたバナーを、登録順ですべて表示
       */
      document.querySelectorAll('[data-aff-banner]').forEach(function(el){
        var key  = el.getAttribute('data-aff-banner');
        var arr  = banners[key];
        if(!arr) return;

        var list = Array.isArray(arr) ? arr : [arr];
        var idx  = parseInt(el.getAttribute('data-aff-banner-idx') || '0', 10);
        var b    = list[idx] || list[0];
        if(!b) return;

        if(el.tagName === 'A' && b.href && isSafeHttpUrl(b.href)) el.setAttribute('href', b.href);
        var img = el.tagName === 'IMG' ? el : el.querySelector('img');
        if(img && b.img && isSafeHttpUrl(b.img)){
          img.setAttribute('src', b.img);
        } else if(!b.img){
          var box = el.closest('.lp-banner-box') || el;
          box.style.display = 'none';
        }
        if(b.title) el.setAttribute('title', b.title);
      });

      /* ---- 登録されたバナーをすべて表示 ---- */
      document.querySelectorAll('[data-aff-banner-list]').forEach(function(container){
        var key = container.getAttribute('data-aff-banner-list');
        var arr = banners[key];
        if(!arr) return;

        var list = Array.isArray(arr) ? arr : [arr];
        var valid = list.filter(function(b){ return b && b.img && b.href && isSafeHttpUrl(b.href) && isSafeHttpUrl(b.img); });
        if(!valid.length){
          container.style.display = 'none';
          return;
        }

        valid.forEach(function(b, i){
          var box = document.createElement('div');
          box.className = 'lp-banner-box';

          var label = document.createElement('div');
          label.className = 'lp-banner-label';
          label.textContent = '📣 PR';
          box.appendChild(label);

          var a = document.createElement('a');
          a.href = b.href;
          a.target = '_blank';
          a.rel = 'sponsored noopener nofollow';
          if(b.title) a.title = b.title;

          var img = document.createElement('img');
          img.src = b.img;
          img.alt = b.title || key;
          img.className = 'lp-banner-img';
          img.loading = 'lazy';
          a.appendChild(img);
          box.appendChild(a);
          container.appendChild(box);
        });
      });
      /* ---- 提携状況の文言切り替え（表・注釈などのテキスト用） ----
         使い方：
           <span data-aff-status="キー">
             <span class="aff-status-pending">提携準備中（登録リンク未設定）</span>
             <span class="aff-status-ready" style="display:none;">提携済み・今すぐ登録可能</span>
           </span>
         data-aff-pending のボタン版と同じ判定で、実URLが登録された瞬間に文言だけ自動で切り替わる。 */
      document.querySelectorAll('[data-aff-status]').forEach(function(el){
        var key   = el.getAttribute('data-aff-status');
        var entry = links[key];
        var href  = entry ? (typeof entry === 'string' ? entry : entry.url) : null;
        var ready = isSafeHttpUrl(href) && href !== '#';

        var pending = el.querySelector('.aff-status-pending');
        var readyEl = el.querySelector('.aff-status-ready');
        if(pending) pending.style.display = ready ? 'none' : '';
        if(readyEl) readyEl.style.display  = ready ? '' : 'none';
      });

      /* ---- 準備中カードの自動切り替え ----
         使い方（記事HTML側）：
           <div data-aff-pending="モッピーなどのキー">
             <p class="aff-pending-note">現在準備中です…</p>
             <a data-aff="同じキー" href="#" class="aff-pending-btn" style="display:none;">◯◯に登録する（PR）</a>
           </div>
         affiliates.json 側でそのキーに http/https の実URLが入るまでは
         「準備中」の案内文だけを見せ、ボタンは隠したままにする。
         実URLが登録された瞬間、記事HTMLを直さなくても自動的にボタンが表示され、
         上のdata-aff処理でhrefも正しいリンクに差し替わる。 */
      document.querySelectorAll('[data-aff-pending]').forEach(function(wrap){
        var key   = wrap.getAttribute('data-aff-pending');
        var entry = links[key];
        var href  = entry ? (typeof entry === 'string' ? entry : entry.url) : null;
        var ready = isSafeHttpUrl(href) && href !== '#';

        var note = wrap.querySelector('.aff-pending-note');
        var btn  = wrap.querySelector('.aff-pending-btn, [data-aff="' + key + '"]');

        if(btn)  btn.style.display  = ready ? '' : 'none';
        if(note) note.style.display = ready ? 'none' : '';
      });
      /* ---- ポイントサイト一覧の自動生成 ----
         使い方（記事HTML側）：
           <div data-aff-pointsites-list data-aff-pointsites-exclude="hapitas-signup"></div>
         affiliates.json の links 内で isPointSite:true になっている項目を全て列挙し、
         実URL登録済みなら登録ボタン、未設定なら「準備中」の案内を自動生成する。
         ちょびリッチなど新しいポイントサイトを増やしたいときは、管理画面（admin/affiliates.html）で
         カードを追加して「ポイントサイト」にチェックを入れるだけでよい。記事側のHTMLは一切編集不要で、
         次にページを開いたときにはこの一覧に自動で行が増える。
         data-aff-pointsites-exclude には、記事内で別途手動のCTAを用意済みのキーをカンマ区切りで
         指定すると、その分だけ自動一覧から除外できる（二重表示防止）。 */
      document.querySelectorAll('[data-aff-pointsites-list]').forEach(function(container){
        var excludeAttr = container.getAttribute('data-aff-pointsites-exclude') || '';
        var exclude = excludeAttr.split(',').map(function(s){ return s.trim(); }).filter(Boolean);

        var keys = Object.keys(links).filter(function(k){
          return links[k] && links[k].isPointSite && exclude.indexOf(k) === -1;
        });
        if(!keys.length) return;

        keys.forEach(function(key){
          var entry = links[key];
          var href  = entry.url;
          var ready = isSafeHttpUrl(href) && href !== '#';
          var name  = names[key] || key;

          var box = document.createElement('section');
          box.className = 'lp-section lp-cta-section aff-pointsite-card';
          box.style.marginTop = '16px';

          var title = document.createElement('p');
          title.className = 'nl-cta-name';
          title.textContent = name + 'に登録する';
          box.appendChild(title);

          var note = document.createElement('p');
          note.className = 'nl-text';
          note.style.marginBottom = ready ? '10px' : '0';
          note.textContent = ready
            ? '登録無料。当サイト経由での登録に対応しています。'
            : '当サイト経由の登録リンクは現在準備中です。リンクが公開され次第、ここに登録ボタンが自動で表示されます。';
          box.appendChild(note);

          if(ready){
            var a = document.createElement('a');
            a.href = href;
            a.target = '_blank';
            a.rel = 'noopener noreferrer nofollow sponsored';
            a.className = 'lp-apply-btn';
            a.textContent = name + 'に無料登録する（PR）';
            box.appendChild(a);
          }

          container.appendChild(box);
        });
      });

      /* ---- ヒーローカード（券面を記事冒頭で大きく見せる） ----
         使い方（記事HTML側）：
           <div class="lp-hero-card" data-aff-hero="rakuten-card">
             <img class="lp-hero-card-img" alt="楽天カード">
             <div class="lp-hero-card-name">楽天カード</div>
             <div class="lp-hero-card-copy">年会費永年無料で還元率1.0%〜</div>
             <a class="lp-hero-card-cta" data-aff="rakuten-card" href="#" target="_blank" rel="sponsored noopener nofollow">今すぐ申し込む（PR）</a>
           </div>
         banners[key] の1枚目（＝管理画面で「バナー1」に登録した券面画像）を
         そのまま大きく表示する。名前・コピー・CTAは既存のdata-aff処理と共存する。
         券面バナーが未登録の場合はカード自体を非表示にする（空枠を出さない）。 */
      document.querySelectorAll('[data-aff-hero]').forEach(function(box){
        var key = box.getAttribute('data-aff-hero');
        var arr = banners[key];
        var b   = arr ? (Array.isArray(arr) ? arr[0] : arr) : null;
        if(!b || !b.img || !isSafeHttpUrl(b.img)){ box.style.display = 'none'; return; }
        var img = box.querySelector('.lp-hero-card-img');
        if(img) img.setAttribute('src', b.img);
        var nameEl = box.querySelector('.lp-hero-card-name');
        if(nameEl && !nameEl.textContent.trim() && names[key]) nameEl.textContent = names[key];
      });

      /* ---- 章ごとのバナー自動配分 ----
         使い方（記事HTML側）：各章の切れ目に、同じキーで何個でも置いておく
           <div data-aff-banner-slot="dmm-kabu"></div>
         affiliates.json に登録されたバナー枚数に応じて、置いてある枠（スロット）の
         どこにどのバナーを出すかを自動で決める：
           - バナー枚数 <= スロット数 → スロット全体に均等な間隔で振り分け、余った枠は非表示
             （＝「1〜2枚しかないカード」は連続表示にならず、ちょうどいい間隔で1回だけ出る）
           - バナー枚数 > スロット数 → 全スロットを使い切り、余ったバナーは出さない
             （枠を増やしたい記事は data-aff-banner-slot を追記すればよい）
         これにより、案件ごとにバナー枚数が違っても、管理画面でバナーを増減するだけで
         記事側の配置を毎回調整し直す必要がなくなる。 */
      var slotGroups = {};
      document.querySelectorAll('[data-aff-banner-slot]').forEach(function(el){
        var key = el.getAttribute('data-aff-banner-slot');
        (slotGroups[key] = slotGroups[key] || []).push(el);
      });
      Object.keys(slotGroups).forEach(function(key){
        var slots = slotGroups[key];
        var arr   = banners[key];
        var valid = (arr || []).filter(function(b){ return b && b.img && b.href && isSafeHttpUrl(b.href) && isSafeHttpUrl(b.img); });
        if(!valid.length){ slots.forEach(function(s){ s.style.display = 'none'; }); return; }

        var n = slots.length, m = valid.length;
        var chosen = new Array(n).fill(-1); // スロットindex -> バナーindex（-1は非表示）
        if(m <= n){
          // m枚を n個の枠に均等な間隔で割り当てる（例：2枚を9枠なら 0番目と8番目、のように離す）
          for(var i = 0; i < m; i++){
            var pos = m === 1 ? Math.floor((n - 1) / 2) : Math.round(i * (n - 1) / (m - 1));
            chosen[pos] = i;
          }
        } else {
          // バナーの方が多い場合は、全スロットを使い切る形で先頭から均等に割り当てる
          for(var j = 0; j < n; j++){
            chosen[j] = Math.floor(j * m / n);
          }
        }

        slots.forEach(function(slotEl, idx){
          var bIdx = chosen[idx];
          if(bIdx === -1 || bIdx == null){ slotEl.style.display = 'none'; return; }
          var b = valid[bIdx];
          var box = document.createElement('div');
          box.className = 'lp-banner-box';
          box.innerHTML = '<div class="lp-banner-label">📣 PR</div>'
            + '<a href="' + b.href + '" target="_blank" rel="sponsored noopener nofollow"'
            + (b.title ? ' title="' + b.title.replace(/"/g,'&quot;') + '"' : '') + '>'
            + '<img src="' + b.img + '" alt="' + (b.title || names[key] || key).replace(/"/g,'&quot;') + '" class="lp-banner-img" loading="lazy"></a>';
          slotEl.replaceWith(box);
        });
      });

      /* ---- クレカ以外の案件をランダムに1つ表示（アプリ案件などの空き枠埋め） ----
         使い方（記事HTML側）：
           <div data-aff-random-slot></div>
           <div data-aff-random-slot data-aff-random-category="app"></div>
         affiliates.json の links 内で category が指定ジャンル（省略時は "app"）の
         案件から、実URL登録済みのものをランダムに1つ選んで表示する。
         同一ページ内で同じ案件が重複しないようにし、対象案件が無ければ枠ごと非表示にする。
         新しい案件を管理画面で追加するだけで、次にページを開いたときからランダム表示の
         候補に自動で加わる（記事側の編集は不要）。 */
      var usedRandomKeys = [];
      document.querySelectorAll('[data-aff-random-slot]').forEach(function(el){
        var cat = el.getAttribute('data-aff-random-category') || 'app';
        var pool = Object.keys(links).filter(function(k){
          var l = links[k];
          if(!l || l.category !== cat) return false;
          if(usedRandomKeys.indexOf(k) !== -1) return false;
          var b = banners[k];
          var banner = b ? (Array.isArray(b) ? b[0] : b) : null;
          return isSafeHttpUrl(l.url) && l.url !== '#' && banner && banner.img && banner.href
            && isSafeHttpUrl(banner.img) && isSafeHttpUrl(banner.href);
        });
        if(!pool.length){ el.style.display = 'none'; return; }
        var key = pool[Math.floor(Math.random() * pool.length)];
        usedRandomKeys.push(key);
        var b = banners[key];
        var banner = Array.isArray(b) ? b[0] : b;
        var box = document.createElement('div');
        box.className = 'lp-banner-box lp-random-slot';
        box.innerHTML = '<div class="lp-banner-label">📱 PR</div>'
          + '<a href="' + banner.href + '" target="_blank" rel="sponsored noopener nofollow">'
          + '<img src="' + banner.img + '" alt="' + (names[key] || key).replace(/"/g,'&quot;') + '" class="lp-banner-img" loading="lazy"></a>';
        el.replaceWith(box);
      });
    })
    .catch(function(){ /* 失敗時はHTMLの元href・文言をそのまま使う */ });
})();
