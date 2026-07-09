/* BoatAI top page — reports.json / stats.json を読んで描画。
   どちらのJSONが無くてもページが真っ白にならないようフォールバックする。 */
(function () {
  "use strict";

  function fmtDate(d) { // "20260710" -> "2026/07/10"
    return d.slice(0, 4) + "/" + d.slice(4, 6) + "/" + d.slice(6, 8);
  }

  function setPlaceholder(el, msg) {
    if (el) el.innerHTML = '<li class="placeholder">' + msg + "</li>";
  }

  // ---------- レポート一覧 & トップのボタン ----------
  function renderReports(data) {
    var daily = (data && data.daily) || [];
    var results = (data && data.results) || [];
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

  // ---------- 実績サマリー & グラフ ----------
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
    valid.forEach(function (s) {
      totalPnl += s.pnl || 0;
      totalTop10 += s.top10_hits || 0;
      totalWin += s.win_hits || 0;
      totalN += s.n_judged || 0;
    });
    if (cardsEl) {
      cardsEl.innerHTML =
        card("昨日の上位10点内的中", (last.top10_hits ?? "-") + "/" + last.n_judged +
          " (" + (last.top10_rate ?? "-") + "%)") +
        card("昨日の1点買い収支", (last.pnl >= 0 ? "+" : "") + (last.pnl ?? 0).toLocaleString() + "円",
          last.pnl >= 0 ? "plus" : "minus") +
        card("累計 上位10点内率", totalN ? Math.round(totalTop10 / totalN * 100) + "%" : "-") +
        card("累計 1点買い収支 (" + valid.length + "日)",
          (totalPnl >= 0 ? "+" : "") + totalPnl.toLocaleString() + "円",
          totalPnl >= 0 ? "plus" : "minus");
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
    return fetch(path, { cache: "no-cache" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  document.addEventListener("DOMContentLoaded", function () {
    loadJson("reports.json").then(function (d) {
      try { renderReports(d); } catch (e) {
        setPlaceholder(document.getElementById("list-daily"), "一覧を読み込めませんでした");
        setPlaceholder(document.getElementById("list-results"), "一覧を読み込めませんでした");
      }
    });
    loadJson("stats.json").then(function (d) {
      try { renderStats(d); } catch (e) {
        var el = document.getElementById("stats-cards");
        if (el) el.innerHTML = '<p class="placeholder">実績データを読み込めませんでした</p>';
      }
    });
  });
})();
