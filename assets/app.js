/* BoatAI top page — today.json / live/*.json / hits.json / reports.json / stats.json
   を読んで「レース起点UI」を描画する。
   どのJSONが無くてもページが真っ白にならないよう、各セクションは独立に
   フォールバックする (データが無いセクションは hidden のまま)。 */
(function () {
  "use strict";

  var LANE_BG = {1:"#f5f5f5",2:"#333333",3:"#e53935",4:"#1e88e5",5:"#fdd835",6:"#43a047"};
  var LANE_FG = {1:"#333",2:"#fff",3:"#fff",4:"#fff",5:"#333",6:"#fff"};
  var FLAG_LABEL = {solid:"堅そう", mid:"標準", rough:"荒れ注意"};

  var state = {
    today: null,       // today.json
    live: null,        // live/YYYYMMDD.json
    hits: null,        // hits.json
    dailyDates: [],    // reports.json daily
    date: todayStr()
  };

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0")
      + String(d.getDate()).padStart(2, "0");
  }
  function fmtDate(d) { // "20260710" -> "2026/07/10"
    return d.slice(0, 4) + "/" + d.slice(4, 6) + "/" + d.slice(6, 8);
  }
  function esc(s) {
    var e = document.createElement("span");
    e.textContent = String(s == null ? "" : s);
    return e.innerHTML;
  }
  function pct(p) { return (p * 100).toFixed(1) + "%"; }
  function setPlaceholder(el, msg) {
    if (el) el.innerHTML = '<li class="placeholder">' + msg + "</li>";
  }
  function deadlineDate(hhmm) { // "HH:MM" -> 今日のDate (不正はnull)
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || "").trim());
    if (!m) return null;
    var d = new Date();
    d.setHours(+m[1], +m[2], 0, 0);
    return d;
  }
  function laneBadge(l) {
    return '<span class="laneb" style="background:' + (LANE_BG[l] || "#666")
      + ';color:' + (LANE_FG[l] || "#fff") + '">' + esc(l) + "</span>";
  }
  function flagChip(flag) {
    if (!flag) return "";
    return '<span class="chip chip-' + esc(flag) + '">' + (FLAG_LABEL[flag] || esc(flag)) + "</span>";
  }
  function raceLink(raceId) { // レース詳細ページ (予想+結果を1画面)
    return "race.html?id=" + encodeURIComponent(raceId);
  }

  // 当日全レースをフラット化 [{race_id,jcd,venue,rno,deadline,dl(Date),...}]
  function flatRaces() {
    if (!state.today || state.today.date !== state.date) return [];
    var out = [];
    (state.today.venues || []).forEach(function (v) {
      (v.races || []).forEach(function (r) {
        out.push({
          race_id: r.race_id, jcd: v.jcd, venue: v.name, rno: r.rno,
          deadline: r.deadline, dl: deadlineDate(r.deadline),
          honmei_lane: r.honmei_lane, honmei_prob: r.honmei_prob,
          flag: r.flag, top1_combo: r.top1_combo, top1_prob: r.top1_prob
        });
      });
    });
    return out;
  }

  // ---------- まもなく締切 ----------
  function renderSoon() {
    var sec = document.getElementById("soon");
    var box = document.getElementById("soon-cards");
    if (!sec || !box) return;
    var now = new Date();
    var coming = flatRaces().filter(function (r) { return r.dl && r.dl > now; })
      .sort(function (a, b) { return a.dl - b.dl; }).slice(0, 4);
    if (!coming.length) { sec.hidden = true; return; }
    sec.hidden = false;
    box.innerHTML = coming.map(function (r) {
      return '<a class="soon-card" href="' + raceLink(r.race_id) + '">'
        + '<div class="sc-top"><span class="sc-venue">' + esc(r.venue) + " "
        + esc(r.rno) + 'R</span>' + flagChip(r.flag) + "</div>"
        + '<div class="sc-cd" data-dl="' + esc(r.deadline) + '">--:--</div>'
        + '<div class="sc-dl">締切 ' + esc(r.deadline) + "</div>"
        + '<div class="sc-honmei">'
        + (r.honmei_lane ? "本命 " + laneBadge(r.honmei_lane) + " "
          + '<strong>' + pct(r.honmei_prob || 0) + "</strong>" : "")
        + "</div>"
        + (r.top1_combo ? '<div class="sc-combo">AI1位 ' + esc(r.top1_combo)
          + ' <span class="muted">' + pct(r.top1_prob || 0) + "</span></div>" : "")
        + "</a>";
    }).join("");
  }

  function tickCountdown() {
    var now = new Date();
    var els = document.querySelectorAll(".sc-cd");
    var needRerender = false;
    for (var i = 0; i < els.length; i++) {
      var dl = deadlineDate(els[i].getAttribute("data-dl"));
      if (!dl) continue;
      var sec = Math.floor((dl - now) / 1000);
      if (sec <= 0) { needRerender = true; continue; }
      var mm = Math.floor(sec / 60), ss = sec % 60;
      els[i].textContent = (mm >= 60
        ? Math.floor(mm / 60) + ":" + String(mm % 60).padStart(2, "0") + ":" + String(ss).padStart(2, "0")
        : mm + ":" + String(ss).padStart(2, "0"));
      els[i].classList.toggle("hot", sec <= 300);
    }
    if (needRerender) { renderSoon(); renderVenues(); }
  }

  // ---------- 本日のレース場グリッド ----------
  function renderVenues() {
    var sec = document.getElementById("venues");
    var grid = document.getElementById("venue-grid");
    if (!sec || !grid) return;
    if (!state.today || state.today.date !== state.date
        || !(state.today.venues || []).length) { sec.hidden = true; return; }
    sec.hidden = false;
    var now = new Date();
    grid.innerHTML = state.today.venues.map(function (v) {
      var next = null;
      (v.races || []).forEach(function (r) {
        var dl = deadlineDate(r.deadline);
        if (dl && dl > now && (!next || dl < next.dl)) next = { r: r, dl: dl };
      });
      var body, cls = "vcard";
      if (next) {
        var minLeft = Math.floor((next.dl - now) / 60000);
        var soonBadge = minLeft <= 10
          ? '<span class="chip chip-hot">締切間近</span>' : "";
        body = '<div class="vc-next">次 ' + esc(next.r.rno) + "R "
          + '<span class="vc-dl">' + esc(next.r.deadline) + "締切</span></div>"
          + soonBadge;
        if (minLeft <= 10) cls += " vcard-hot";
      } else {
        body = '<div class="vc-next muted">本日終了</div>';
        cls += " vcard-done";
      }
      var href = next ? raceLink(next.r.race_id)
        : (state.dailyDates.indexOf(state.date) >= 0
          ? "daily/daily_report_" + state.date + ".html" : "live.html");
      return '<a class="' + cls + '" href="' + href + '">'
        + '<div class="vc-name">' + esc(v.name) + "</div>" + body + "</a>";
    }).join("");
    // 非開催場は畳んで小さく
    var openNames = state.today.venues.map(function (v) { return v.name; });
    var ALL = ["桐生","戸田","江戸川","平和島","多摩川","浜名湖","蒲郡","常滑",
      "津","三国","びわこ","住之江","尼崎","鳴門","丸亀","児島","宮島","徳山",
      "下関","若松","芦屋","福岡","唐津","大村"];
    var closed = ALL.filter(function (n) { return openNames.indexOf(n) < 0; });
    var det = document.getElementById("venue-closed");
    var lst = document.getElementById("venue-closed-list");
    if (det && lst && closed.length) {
      det.hidden = false;
      lst.textContent = closed.join(" / ");
    }
  }

  // ---------- 鉄板 / 波乱 TOP5 ----------
  function pickItem(r) {
    return '<li><a href="' + raceLink(r.race_id) + '">'
      + '<span class="pk-race">' + esc(r.venue) + " " + esc(r.rno) + "R</span>"
      + '<span class="pk-dl">' + esc(r.deadline || "") + "</span>"
      + '<span class="pk-honmei">' + laneBadge(r.honmei_lane) + " "
      + '<strong>' + pct(r.honmei_prob) + "</strong></span>"
      + (r.top1_combo ? '<span class="pk-combo">' + esc(r.top1_combo)
        + " " + pct(r.top1_prob || 0) + "</span>" : "")
      + "</a></li>";
  }

  function renderPicks() {
    var sec = document.getElementById("picks");
    if (!sec) return;
    var rs = flatRaces().filter(function (r) {
      return typeof r.honmei_prob === "number";
    });
    if (rs.length < 3) { sec.hidden = true; return; }
    sec.hidden = false;
    var bySolid = rs.slice().sort(function (a, b) { return b.honmei_prob - a.honmei_prob; });
    var solid = bySolid.slice(0, 5);
    var rough = bySolid.slice().reverse().slice(0, 5);
    document.getElementById("list-solid").innerHTML = solid.map(pickItem).join("");
    document.getElementById("list-rough").innerHTML = rough.map(pickItem).join("");
  }

  // ---------- 的中速報ティッカー ----------
  function renderTicker() {
    var bar = document.getElementById("hits-ticker");
    var track = document.getElementById("ticker-track");
    if (!bar || !track) return;
    var h = state.hits;
    if (!h || h.date !== state.date || !(h.items || []).length) { bar.hidden = true; return; }
    var hits = h.items.filter(function (i) { return i.hit; });
    if (!hits.length) { bar.hidden = true; return; }
    var parts = hits.map(function (i) {
      // 上位10点内=緑 / 11-20位=黄緑 で色分け
      var deep = i.model_rank && i.model_rank > 10;
      return '<span class="tk-item' + (deep ? " tk-deep" : "") + '">HIT '
        + esc(i.venue) + " " + esc(i.rno) + "R "
        + '<strong>' + esc(i.combo) + "</strong> "
        + (i.payout ? '<span class="tk-pay">' + Number(i.payout).toLocaleString() + "円</span>" : "")
        + (i.model_rank ? '<span class="' + (deep ? "tk-r20" : "tk-r10")
          + '">(AI' + esc(i.model_rank) + "位)</span>" : "")
        + "</span>";
    });
    // ループ用に2周分並べる
    track.innerHTML = parts.join("") + parts.join("");
    track.style.animationDuration = Math.max(12, hits.length * 6) + "s";
    bar.hidden = false;
  }

  // ---------- AIの目が変わったレース ----------
  function renderDelta() {
    var sec = document.getElementById("delta");
    var box = document.getElementById("delta-cards");
    if (!sec || !box) return;
    var lv = state.live;
    var races = (lv && lv.date === state.date && lv.races) || [];
    var changed = races.filter(function (r) { return r.delta_comment; });
    if (!changed.length) { sec.hidden = true; return; }
    sec.hidden = false;
    var VEN = {"01":"桐生","02":"戸田","03":"江戸川","04":"平和島","05":"多摩川",
      "06":"浜名湖","07":"蒲郡","08":"常滑","09":"津","10":"三国","11":"びわこ",
      "12":"住之江","13":"尼崎","14":"鳴門","15":"丸亀","16":"児島","17":"宮島",
      "18":"徳山","19":"下関","20":"若松","21":"芦屋","22":"福岡","23":"唐津","24":"大村"};
    box.innerHTML = changed.slice(-8).reverse().map(function (r) {
      return '<a class="delta-card" href="race.html?id=' + esc(r.race_id) + '">'
        + '<div class="dc-race">' + esc(VEN[r.jcd] || r.jcd) + " " + esc(r.rno)
        + 'R <span class="muted">締切 ' + esc(r.deadline || "?") + "</span></div>"
        + '<div class="dc-comment">' + esc(r.delta_comment) + "</div></a>";
    }).join("");
  }

  // ---------- レポート一覧 & トップのボタン (既存機能) ----------
  function renderReports(data) {
    var daily = (data && data.daily) || [];
    var results = (data && data.results) || [];
    state.dailyDates = daily;
    fillList("list-daily", daily, "daily/daily_report_", "予想");
    fillList("list-results", results, "results/results_report_", "結果");

    var btnT = document.getElementById("btn-today");
    if (btnT) {
      if (daily.length) {
        btnT.href = "daily/daily_report_" + daily[0] + ".html";
        btnT.textContent = fmtDate(daily[0]) + " の予想レポートを見る";
      } else {
        btnT.textContent = "予想レポート準備中";
        btnT.classList.add("disabled");
      }
    }
    var btnR = document.getElementById("btn-results");
    if (btnR) {
      if (results.length) {
        btnR.href = "results/results_report_" + results[0] + ".html";
        btnR.textContent = fmtDate(results[0]) + " の結果・答え合わせ";
      } else {
        btnR.textContent = "結果レポート準備中";
        btnR.classList.add("disabled");
      }
    }
  }

  function fillList(id, dates, prefix, label) {
    var ul = document.getElementById(id);
    if (!ul) return;
    if (!dates.length) {
      setPlaceholder(ul, "レポートはまだありません");
      return;
    }
    ul.innerHTML = "";
    dates.forEach(function (d, i) {
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = prefix + d + ".html";
      a.innerHTML = '<span class="date">' + fmtDate(d) + "</span>" +
        '<span class="lbl">' + label + "レポート</span>" +
        (i === 0 ? '<span class="tag-new">NEW</span>' : "");
      li.appendChild(a);
      ul.appendChild(li);
    });
  }

  // ---------- 実績サマリー & グラフ (既存機能) ----------
  function card(k, v, cls) {
    return '<div class="scard"><div class="k">' + k + '</div>' +
      '<div class="v ' + (cls || "") + '">' + v + "</div></div>";
  }

  function renderStats(stats) {
    var cardsEl = document.getElementById("stats-cards");
    var fb = document.getElementById("chart-fallback");
    var canvas = document.getElementById("stats-chart");
    var valid = (stats || []).filter(function (s) {
      return s && s.date && s.n_judged;
    });
    if (!valid.length) {
      if (cardsEl) cardsEl.innerHTML =
        '<p class="placeholder">実績データはまだありません。夜の結果レポート公開後に表示されます。</p>';
      if (fb) fb.hidden = false;
      if (canvas) canvas.style.display = "none";
      return;
    }
    var last = valid[valid.length - 1];
    var totalPnl = 0, totalTop10 = 0, totalWin = 0, totalN = 0;
    var totalTop20 = 0, totalN20 = 0; // top20 は新形式レポートの日のみ集計
    valid.forEach(function (s) {
      totalPnl += s.pnl || 0;
      totalTop10 += s.top10_hits || 0;
      totalWin += s.win_hits || 0;
      totalN += s.n_judged || 0;
      if (s.top20_hits != null) {
        totalTop20 += s.top20_hits;
        totalN20 += s.n_judged || 0;
      }
    });
    if (cardsEl) {
      var htmlCards =
        card("昨日の上位10点内的中", (last.top10_hits ?? "-") + "/" + last.n_judged +
          " (" + (last.top10_rate ?? "-") + "%)");
      if (last.top20_hits != null) {
        htmlCards += card("昨日の上位20点内的中", last.top20_hits + "/" + last.n_judged +
          " (" + (last.top20_rate ?? "-") + "%)");
      }
      htmlCards +=
        card("昨日の1点買い収支", (last.pnl >= 0 ? "+" : "") + (last.pnl ?? 0).toLocaleString() + "円",
          last.pnl >= 0 ? "plus" : "minus") +
        card("累計 上位10点内率", totalN ? Math.round(totalTop10 / totalN * 100) + "%" : "-");
      if (totalN20) {
        htmlCards += card("累計 上位20点内率", Math.round(totalTop20 / totalN20 * 100) + "%");
      }
      htmlCards +=
        card("累計 1点買い収支 (" + valid.length + "日)",
          (totalPnl >= 0 ? "+" : "") + totalPnl.toLocaleString() + "円",
          totalPnl >= 0 ? "plus" : "minus");
      cardsEl.innerHTML = htmlCards;
    }
    drawChart(canvas, fb, valid);
  }

  function drawChart(canvas, fb, valid) {
    if (!canvas) return;
    if (typeof Chart === "undefined") { // CDN読み込み失敗でも壊さない
      canvas.style.display = "none";
      if (fb) { fb.hidden = false; fb.textContent = "グラフを読み込めませんでした (実績カードは上に表示中)"; }
      return;
    }
    var labels = valid.map(function (s) { return fmtDate(s.date).slice(5); });
    var cum = 0;
    var cumPnl = valid.map(function (s) { cum += (s.pnl || 0); return cum; });
    var rate = valid.map(function (s) { return s.top10_rate; });
    new Chart(canvas, {
      data: {
        labels: labels,
        datasets: [
          { type: "bar", label: "上位10点内的中率(%)", data: rate,
            backgroundColor: "rgba(41,182,246,.55)", yAxisID: "y" },
          { type: "line", label: "累計1点買い収支(円)", data: cumPnl,
            borderColor: "#fdd835", backgroundColor: "#fdd835",
            tension: .25, yAxisID: "y2" }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: "#e5e9f0" } } },
        scales: {
          x: { ticks: { color: "#9aa5b5" }, grid: { color: "#22314a" } },
          y: { min: 0, max: 100, ticks: { color: "#9aa5b5" }, grid: { color: "#22314a" } },
          y2: { position: "right", ticks: { color: "#fdd835" }, grid: { drawOnChartArea: false } }
        }
      }
    });
  }

  // ---------- 読み込み (失敗しても続行) ----------
  function loadJson(path) {
    return fetch(path + (path.indexOf("?") < 0 ? "?t=" + Date.now() : ""),
      { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  function renderRaceUI() {
    try { renderSoon(); } catch (e) { var s = document.getElementById("soon"); if (s) s.hidden = true; }
    try { renderVenues(); } catch (e) { var v = document.getElementById("venues"); if (v) v.hidden = true; }
    try { renderPicks(); } catch (e) { var p = document.getElementById("picks"); if (p) p.hidden = true; }
    try { renderTicker(); } catch (e) { var t = document.getElementById("hits-ticker"); if (t) t.hidden = true; }
    try { renderDelta(); } catch (e) { var d = document.getElementById("delta"); if (d) d.hidden = true; }
  }

  function loadDynamic() {
    Promise.all([
      loadJson("today.json"),
      loadJson("live/" + state.date + ".json"),
      loadJson("hits.json")
    ]).then(function (res) {
      state.today = res[0];
      state.live = res[1];
      state.hits = res[2];
      renderRaceUI();
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    loadJson("reports.json").then(function (d) {
      try { renderReports(d); } catch (e) {
        setPlaceholder(document.getElementById("list-daily"), "一覧を読み込めませんでした");
        setPlaceholder(document.getElementById("list-results"), "一覧を読み込めませんでした");
      }
      loadDynamic();               // raceLink が dailyDates を参照するため後から
    });
    loadJson("stats.json").then(function (d) {
      try { renderStats(d); } catch (e) {
        var el = document.getElementById("stats-cards");
        if (el) el.innerHTML = '<p class="placeholder">実績データを読み込めませんでした</p>';
      }
    });
    setInterval(tickCountdown, 1000);   // カウントダウン
    setInterval(loadDynamic, 60000);    // live/hits を1分ごとに再取得
  });
})();
