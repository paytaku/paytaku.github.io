/* ============================================================
   アフィリリンク自動差し込み（affiliates.js）
   affiliates.json を読み込み：
   - data-aff="キー" → href / ボタン文言を差し替え
   - data-aff-banner="キー" → バナー表示（配列の先頭、またはdata-aff-banner-idx指定）
   JSON取得失敗時はHTMLの元href/文言をそのまま使う（フォールバック）。
   ============================================================ */
(function(){
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
        if(href) a.setAttribute('href', href);

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

        if(el.tagName === 'A' && b.href) el.setAttribute('href', b.href);
        var img = el.tagName === 'IMG' ? el : el.querySelector('img');
        if(img && b.img){
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
        var valid = list.filter(function(b){ return b && b.img && b.href; });
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
    })
    .catch(function(){ /* 失敗時はHTMLの元href・文言をそのまま使う */ });
})();
