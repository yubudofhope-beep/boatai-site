/* BoatAI race.html — レース詳細 (予測/直前/結果をタブで1画面に統合)
   URL: race.html?id=202607200404  (日付8桁 + 場コード2桁 + R番号2桁)
   読み込むJSON:
     today.json / live/日付.json / hits.json / reports.json (既存・自動生成)
     data/predict_日付.json / data/result_日付.json
       (公開済みレポートHTMLから extract_race_data.py が抽出。無くても壊れない)
*/
(function () {
  "use strict";

  var LANE_BG = {1:"#f5f5f5",2:"#333333",3:"#e53935",4:"#1e88e5",5:"#fdd835",6:"#43a047"};
  var LANE_FG = {1:"#222",2:"#fff",3:"#fff",4:"#fff",5:"#222",6:"#fff"};
  var VEN = {"01":"桐生","02":"戸田","03":"江戸川","04":"平和島","05":"多摩川",
    "06":"浜名湖","07":"蒲郡","08":"常滑","09":"津","10":"三国","11":"びわこ",
    "12":"住之江","13":"尼崎","14":"鳴門","15":"丸亀","16":"児島","17":"宮島",
    "18":"徳山","19":"下関","20":"若松","21":"芦屋","22":"福岡","23":"唐津","24":"大村"};
  var FLAG_LABEL = {solid:"堅そう", mid:"標準", rough:"荒れ注意"};

  function esc(s){var e=document.createElement("span");e.textContent=String(s==null?"":s);return e.innerHTML;}
  function pct(p){return (p*100).toFixed(1)+"%";}
  function fmtDate(d){return d.slice(0,4)+"/"+d.slice(4,6)+"/"+d.slice(6,8);}
  function laneBadge(l){return '<span class="laneb" style="background:'+(LANE_BG[l]||"#666")+';color:'+(LANE_FG[l]||"#fff")+'">'+esc(l)+"</span>";}
  function loadJson(p){
    return fetch(p+"?t="+Date.now(),{cache:"no-store"})
      .then(function(r){return r.ok?r.json():null;})
      .catch(function(){return null;});
  }
  function todayStr(){
    var d=new Date();
    return d.getFullYear()+String(d.getMonth()+1).padStart(2,"0")+String(d.getDate()).padStart(2,"0");
  }

  // ---- URLからレースIDを解釈 ----
  var id = new URLSearchParams(location.search).get("id") || "";
  var m = /^(\d{8})(\d{2})(\d{2})$/.exec(id);
  if (!m) {
    document.getElementById("rh-venue").textContent = "レースが指定されていません";
    showNodata("URLに ?id=レースID が必要です。ホームからレースを選んでください。");
    return;
  }
  var date = m[1], jcd = m[2], rno = parseInt(m[3], 10);
  var venueName = VEN[jcd] || ("場" + jcd);
  var isToday = (date === todayStr());

  document.title = venueName + " " + rno + "R — BoatAI";

  var state = { today:null, live:null, hits:null, reports:null, predict:null, result:null };
  var curView = null;

  function showNodata(msg){
    var s=document.getElementById("nodata");
    if(s){s.hidden=false;document.getElementById("nodata-msg").textContent=msg;}
  }

  function deadlineDate(hhmm){
    var mm=/^(\d{1,2}):(\d{2})$/.exec(String(hhmm||"").trim());
    if(!mm)return null;
    return new Date(+date.slice(0,4), +date.slice(4,6)-1, +date.slice(6,8), +mm[1], +mm[2], 0, 0);
  }

  var cdTimer=null;
  function startCountdown(dl){
    var el=document.getElementById("rh-cd");
    var st=document.getElementById("rh-status");
    if(!el)return;
    function tick(){
      var sec=Math.floor((dl-new Date())/1000);
      if(sec<=0){
        el.hidden=true;
        if(st)st.innerHTML='<span class="stat-chip stat-wait">結果待ち</span>';
        clearInterval(cdTimer);
        return;
      }
      var mm=Math.floor(sec/60),ss=sec%60;
      el.textContent=(mm>=60
        ?Math.floor(mm/60)+":"+String(mm%60).padStart(2,"0")+":"+String(ss).padStart(2,"0")
        :mm+":"+String(ss).padStart(2,"0"));
      el.classList.toggle("hot",sec<=300);
      el.hidden=false;
      if(st)st.innerHTML='<span class="stat-chip stat-open">締切まで</span>';
    }
    tick();
    cdTimer=setInterval(tick,1000);
  }

  // ---- レースナビ (同じ場の1R〜12R) ----
  function renderNav(venue){
    var box=document.getElementById("race-nav");
    if(!box)return;
    var races=(venue&&venue.races)||[];
    if(!races.length){
      var html="";
      for(var i=1;i<=12;i++){
        html+='<a class="rtab'+(i===rno?" on":"")+'" href="race.html?id='+date+jcd+String(i).padStart(2,"0")+'">'+i+"R</a>";
      }
      box.innerHTML=html;
      return;
    }
    box.innerHTML=races.map(function(r){
      return '<a class="rtab'+(r.rno===rno?" on":"")+'" href="race.html?id='+esc(r.race_id)+'">'+esc(r.rno)+"R</a>";
    }).join("");
  }

  // ---- ビュー切替タブ ----
  function setupTabs(avail, defaultView){
    var bar=document.getElementById("view-tabs");
    if(!bar)return;
    var any = avail.predict||avail.live||avail.result;
    if(!any){bar.hidden=true;return;}
    bar.hidden=false;
    Array.prototype.forEach.call(bar.querySelectorAll(".vtab"),function(btn){
      var v=btn.getAttribute("data-view");
      btn.disabled=!avail[v];
      btn.classList.toggle("off",!avail[v]);
      btn.onclick=function(){ if(avail[v]) setView(v); };
    });
    setView(defaultView);
  }

  function setView(v){
    curView=v;
    ["predict","live","result"].forEach(function(name){
      var el=document.getElementById("view-"+name);
      if(el)el.hidden=(name!==v);
    });
    var bar=document.getElementById("view-tabs");
    if(bar){
      Array.prototype.forEach.call(bar.querySelectorAll(".vtab"),function(btn){
        btn.classList.toggle("on",btn.getAttribute("data-view")===v);
      });
    }
  }

  // ---- 結果ビュー ----
  function renderResultView(hitsItem, resultData){
    var hasAny = !!(hitsItem || resultData);
    if(!hasAny){
      document.getElementById("result-nodata").hidden=false;
      return false;
    }
    document.getElementById("result-nodata").hidden=true;
    var combo = (resultData&&resultData.combo) || (hitsItem&&hitsItem.combo);
    var amount = (resultData&&resultData.amount) != null ? resultData.amount : (hitsItem&&hitsItem.payout);
    var modelRank = (resultData&&resultData.model_rank) != null ? resultData.model_rank : (hitsItem&&hitsItem.model_rank);
    var hit = hitsItem ? !!hitsItem.hit : (modelRank!=null && modelRank<=20);

    if(combo){
      var sec=document.getElementById("result-panel");
      var body=document.getElementById("result-body");
      sec.hidden=false;
      var lanes=String(combo).split("-");
      var comboHtml=lanes.map(function(l){return laneBadge(l);}).join('<span class="combo-dash">›</span>');
      var hitCls=hit?"res-hit":"res-miss";
      body.innerHTML=
        '<div class="res-flex">'
        +'<div class="res-combo '+hitCls+'">'+comboHtml+'</div>'
        +'<div class="res-info">'
        +'<div class="res-badge '+hitCls+'">'+(hit?"🎯 的中！（AI上位20点内）":"不的中")+"</div>"
        +(amount?'<div class="res-pay">3連単 '+Number(amount).toLocaleString()+"円</div>":"")
        +(resultData&&resultData.kimarite?'<div class="res-rank">決まり手: '+esc(resultData.kimarite)+"</div>":"")
        +(modelRank?'<div class="res-rank">AI予想 '+modelRank+"位</div>":"")
        +"</div></div>";
    }
    var st=document.getElementById("rh-status");
    if(st)st.innerHTML='<span class="stat-chip '+(hit?"stat-hit":"stat-done")+'">'+(hit?"的中":"レース終了")+"</span>";
    var cd=document.getElementById("rh-cd");
    if(cd)cd.hidden=true;
    if(cdTimer)clearInterval(cdTimer);

    // 着順
    if(resultData && resultData.finish && resultData.finish.length){
      var fp=document.getElementById("finish-panel");
      var fb=document.getElementById("finish-body");
      fp.hidden=false;
      fb.innerHTML='<table class="finish-table"><tr><th>着</th><th>艇</th><th>選手</th></tr>'
        + resultData.finish.map(function(f){
            return '<tr><td>'+f.pos+"着</td><td>"+laneBadge(f.lane)+"</td><td>"+esc(f.name)+"</td></tr>";
          }).join("")
        + "</table>";
    }
    // 他券種
    if(resultData && resultData.others && resultData.others.length){
      var op=document.getElementById("others-panel");
      var ob=document.getElementById("others-body");
      op.hidden=false;
      ob.innerHTML=resultData.others.map(function(o){
        return '<div class="oth-item">'+esc(o)+"</div>";
      }).join("");
    }
    return true;
  }

  function renderResultTop20(predictData, resultCombo){
    var top=(predictData&&predictData.top20)||[];
    if(!top.length)return;
    var sec=document.getElementById("result-top20-panel");
    var ol=document.getElementById("result-top20-list");
    sec.hidden=false;
    var maxP=top[0]&&top[0].prob||1;
    ol.innerHTML=top.map(function(t){
      var isHit=resultCombo&&t.combo===resultCombo;
      var lanes=String(t.combo).split("-");
      return '<li class="t10'+(isHit?" t10-hit":"")+'">'
        +'<span class="t10-rank">'+t.no+"</span>"
        +'<span class="t10-combo">'+lanes.map(laneBadge).join("-")+"</span>"
        +'<span class="t10-bar"><span style="width:'+Math.min(100,(t.prob/maxP)*100)+'%"></span></span>'
        +'<span class="t10-prob">'+pct(t.prob)+"</span>"
        +(t.odds?'<span class="t10-odds">'+t.odds+"倍</span>":"")
        +(isHit?'<span class="t10-hitmark">🎯 的中</span>':"")
        +"</li>";
    }).join("");
  }

  // ---- 直前ビュー ----
  function renderProbs(liveRace,todayRace){
    var sec=document.getElementById("prob-panel");
    var box=document.getElementById("prob-bars");
    var sub=document.getElementById("prob-sub");
    var wp=liveRace&&liveRace.win_prob;
    var mp=(liveRace&&liveRace.morning_win_prob)||null;
    if(!wp&&!mp){
      if(!todayRace)return false;
      sec.hidden=false;
      sub.textContent="(朝モデル・本命のみ)";
      box.innerHTML='<div class="prob-row"><div class="pr-lane">'+laneBadge(todayRace.honmei_lane)
        +'</div><div class="pr-track"><div class="pr-fill" style="width:'+(todayRace.honmei_prob*100)
        +'%"></div></div><div class="pr-val">'+pct(todayRace.honmei_prob)+"</div></div>";
      return true;
    }
    sec.hidden=false;
    sub.textContent=wp&&mp?"(朝→直前の変化つき)":(wp?"(直前予測)":"(朝モデル)");
    var probs=wp||mp;
    var lanes=[1,2,3,4,5,6].sort(function(a,b){return (probs[b]||0)-(probs[a]||0);});
    box.innerHTML=lanes.map(function(l){
      var p=probs[l]||0;
      var mParam=mp?(mp[l]||0):null;
      var diffHtml="";
      if(wp&&mp){
        var diff=p-mParam;
        if(Math.abs(diff)>=0.005){
          diffHtml='<span class="pr-diff '+(diff>0?"up":"down")+'">'
            +(diff>0?"▲":"▼")+(Math.abs(diff)*100).toFixed(1)+"</span>";
        }
      }
      return '<div class="prob-row">'
        +'<div class="pr-lane">'+laneBadge(l)+"</div>"
        +'<div class="pr-track">'
        +(mp&&wp?'<div class="pr-ghost" style="width:'+(mParam*100)+'%"></div>':"")
        +'<div class="pr-fill pr-l'+l+'" style="width:'+(p*100)+'%"></div></div>'
        +'<div class="pr-val">'+pct(p)+diffHtml+"</div></div>";
    }).join("");
    if(liveRace&&liveRace.delta_comment){
      var dn=document.getElementById("delta-note");
      dn.hidden=false;
      dn.textContent="🤖 "+liveRace.delta_comment;
    }
    return true;
  }

  function renderExh(liveRace){
    var ex=liveRace&&liveRace.exhibition;
    var sec=document.getElementById("exh-panel");
    if(!ex){return false;}
    var box=document.getElementById("exh-grid");
    sec.hidden=false;
    var vals=[1,2,3,4,5,6].map(function(l){return +ex[l]||99;});
    var best=Math.min.apply(null,vals);
    box.innerHTML=[1,2,3,4,5,6].map(function(l){
      var t=ex[l];
      var isBest=(+t===best);
      return '<div class="exh-cell'+(isBest?" best":"")+'">'+laneBadge(l)
        +'<div class="exh-t">'+(t!=null?Number(t).toFixed(2):"-")+"</div>"
        +(isBest?'<div class="exh-best">展示1位</div>':"")+"</div>";
    }).join("");
    return true;
  }

  function renderTop10Live(liveRace){
    var top=(liveRace&&liveRace.top10)||[];
    var sec=document.getElementById("top10-panel");
    if(!top.length)return false;
    var ol=document.getElementById("top10-list");
    sec.hidden=false;
    ol.innerHTML=top.map(function(t,i){
      var lanes=String(t.combo).split("-");
      return '<li class="t10">'
        +'<span class="t10-rank">'+(i+1)+"</span>"
        +'<span class="t10-combo">'+lanes.map(laneBadge).join("-")+"</span>"
        +'<span class="t10-bar"><span style="width:'+Math.min(100,t.prob*100/((top[0]&&top[0].prob)||1)*1)+'%"></span></span>'
        +'<span class="t10-prob">'+pct(t.prob)+"</span></li>";
    }).join("");
    return true;
  }

  function renderLiveView(liveRace, todayRace){
    var hasProb=renderProbs(liveRace,todayRace);
    var hasExh=renderExh(liveRace);
    var hasTop=renderTop10Live(liveRace);
    document.getElementById("live-nodata").hidden = !!(hasProb||hasExh||hasTop);
    return hasProb||hasExh||hasTop;
  }

  // ---- 予測ビュー (朝モデル・全艇) ----
  function renderPredictView(predictData){
    if(!predictData || !predictData.lanes || !predictData.lanes.length){
      document.getElementById("pred-nodata").hidden=false;
      return false;
    }
    document.getElementById("pred-nodata").hidden=true;
    var sec=document.getElementById("pred-prob-panel");
    var grid=document.getElementById("pred-prob-grid");
    sec.hidden=false;
    var lanes=predictData.lanes.slice().sort(function(a,b){return b.p_win-a.p_win;});
    grid.innerHTML=lanes.map(function(l){
      return '<div class="ppr-row">'
        +'<div class="ppr-lane">'+laneBadge(l.lane)+"</div>"
        +'<div class="ppr-bars">'
        +'<div class="ppr-line"><span class="ppr-tag">1着</span>'
        +'<div class="pr-track"><div class="pr-fill pr-l'+l.lane+'" style="width:'+(l.p_win*100)+'%"></div></div>'
        +'<span class="ppr-val">'+pct(l.p_win)+"</span></div>"
        +'<div class="ppr-line"><span class="ppr-tag">2連対</span>'
        +'<div class="pr-track"><div class="pr-fill pr-l'+l.lane+'" style="width:'+(l.p_top2*100)+';opacity:.7"></div></div>'
        +'<span class="ppr-val">'+pct(l.p_top2)+"</span></div>"
        +'<div class="ppr-line"><span class="ppr-tag">3連対</span>'
        +'<div class="pr-track"><div class="pr-fill pr-l'+l.lane+'" style="width:'+(l.p_top3*100)+';opacity:.45"></div></div>'
        +'<span class="ppr-val">'+pct(l.p_top3)+"</span></div>"
        +"</div></div>";
    }).join("");

    var top=predictData.top20||[];
    if(top.length){
      var tp=document.getElementById("pred-top20-panel");
      var ol=document.getElementById("pred-top20-list");
      tp.hidden=false;
      var maxP=top[0].prob||1;
      ol.innerHTML=top.map(function(t){
        var lanes2=String(t.combo).split("-");
        return '<li class="t10">'
          +'<span class="t10-rank">'+t.no+"</span>"
          +'<span class="t10-combo">'+lanes2.map(laneBadge).join("-")+"</span>"
          +'<span class="t10-bar"><span style="width:'+Math.min(100,(t.prob/maxP)*100)+'%"></span></span>'
          +'<span class="t10-prob">'+pct(t.prob)+"</span>"
          +(t.odds?'<span class="t10-odds">'+t.odds+"倍</span>":"")
          +"</li>";
      }).join("");
    }
    return true;
  }

  // ---- メイン ----
  Promise.all([
    loadJson("today.json"),
    loadJson("live/"+date+".json"),
    loadJson("hits.json"),
    loadJson("reports.json"),
    loadJson("data/predict_"+date+".json"),
    loadJson("data/result_"+date+".json")
  ]).then(function(res){
    state.today=res[0];state.live=res[1];state.hits=res[2];
    state.reports=res[3];state.predict=res[4];state.result=res[5];

    var venue=null,todayRace=null;
    if(state.today&&state.today.date===date){
      venue=(state.today.venues||[]).filter(function(v){return v.jcd===jcd;})[0];
      if(venue)todayRace=(venue.races||[]).filter(function(r){return r.race_id===id;})[0];
    }
    var liveRace=null;
    if(state.live&&state.live.date===date){
      liveRace=(state.live.races||[]).filter(function(r){return r.race_id===id;})[0];
    }
    var predictRace = state.predict && state.predict.date===date
      ? (state.predict.races||{})[id] : null;
    var resultRace = state.result && state.result.date===date
      ? (state.result.races||{})[id] : null;
    var hitsItem = state.hits && state.hits.date===date
      ? (state.hits.items||[]).filter(function(i){return i.race_id===id;})[0] : null;

    // ヘッダー
    document.getElementById("rh-venue").innerHTML=
      esc(venueName)+' <span class="rh-rno">'+rno+"R</span>";
    var meta=fmtDate(date);
    var dlStr=(todayRace&&todayRace.deadline)||(liveRace&&liveRace.deadline)||(predictRace&&predictRace.deadline)||null;
    if(dlStr)meta+="　締切 "+dlStr;
    var flagVal=(todayRace&&todayRace.flag)||(predictRace&&predictRace.flag);
    if(flagVal)meta+="　"+(FLAG_LABEL[flagVal]||flagVal);
    document.getElementById("rh-meta").textContent=meta;

    renderNav(venue);

    var hasResult = !!(hitsItem || resultRace);
    var resultCombo = (resultRace&&resultRace.combo) || (hitsItem&&hitsItem.combo) || null;

    // 各ビューを描画 (中身があるかどうかに関わらず一旦全部描く。表示はタブで制御)
    renderResultView(hitsItem, resultRace);
    renderResultTop20(predictRace, resultCombo);
    var hasLive = renderLiveView(liveRace, todayRace);
    var hasPredict = renderPredictView(predictRace);

    // ステータス/カウントダウン (結果が無い場合のみ)
    if(!hasResult){
      if(dlStr&&isToday){
        var dl=deadlineDate(dlStr);
        if(dl&&dl>new Date())startCountdown(dl);
        else document.getElementById("rh-status").innerHTML='<span class="stat-chip stat-wait">結果待ち</span>';
      }else if(!isToday){
        document.getElementById("rh-status").innerHTML='<span class="stat-chip stat-done">開催終了</span>';
      }
    }

    // タブ設定 + 初期表示ビュー
    var avail={predict:hasPredict, live:hasLive, result:hasResult};
    var def = hasResult?"result":(hasLive?"live":(hasPredict?"predict":"result"));
    setupTabs(avail, def);

    if(!hasPredict&&!hasLive&&!hasResult){
      showNodata(isToday
        ?"このレースのデータはまだありません。朝7時のレポート生成後に表示されます。"
        :"この日のレースデータが見つかりません。下のレポートリンクから確認してください。");
    }

    // レポートリンク
    var rep=state.reports||{};
    if((rep.daily||[]).indexOf(date)>=0){
      var ld=document.getElementById("link-daily");
      ld.hidden=false;ld.href="daily/daily_report_"+date+".html#r"+id;
    }
    if((rep.results||[]).indexOf(date)>=0){
      var lr=document.getElementById("link-results");
      lr.hidden=false;lr.href="results/results_report_"+date+".html";
    }

    // 当日・結果未確定なら1分ごとにlive/hitsを再取得 (predict/resultは日次生成なので対象外)
    if(isToday&&!hasResult){
      setInterval(function(){
        Promise.all([loadJson("live/"+date+".json"),loadJson("hits.json")]).then(function(r2){
          state.live=r2[0];state.hits=r2[1];
          var lv=null;
          if(state.live&&state.live.date===date){
            lv=(state.live.races||[]).filter(function(r){return r.race_id===id;})[0];
          }
          var hi = state.hits && state.hits.date===date
            ? (state.hits.items||[]).filter(function(i){return i.race_id===id;})[0] : null;
          var nowHasResult = !!hi;
          if(nowHasResult){
            renderResultView(hi, null);
            renderResultTop20(predictRace, hi.combo);
            setupTabs({predict:hasPredict,live:hasLive,result:true},"result");
          }else{
            renderLiveView(lv, todayRace);
          }
        });
      },60000);
    }
  });
})();
