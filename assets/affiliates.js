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

      /* ---- CTAリンクの差し替え ---- */
      document.querySelectorAll('a[data-aff]').forEach(function(a){
        var key   = a.getAttribute('data-aff');
        var entry = links[key];
        if(!entry) return;

        var href, type, via;
        if(typeof entry === 'string'){
          href = entry; type = 'direct';
        } else {
          href = entry.url; type = entry.type || 'direct'; via = entry.via;
        }
        if(href) a.setAttribute('href', href);

        /* ポイントサイト経由なら文言を差し替え（data-aff-keeptext があれば維持） */
        if(type === 'point' && via && !a.hasAttribute('data-aff-keeptext')){
          var pr = /（PR）\s*$/.test(a.textContent) ? '（PR）' : '';
          a.textContent = via + '経由で申し込む' + (pr ? ' ' + pr : '');
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
