/* BoatAI race.html — レース詳細 (予想＋直前＋結果を1画面)
   URL: race.html?id=202607200404  (日付8桁 + 場コード2桁 + R番号2桁)
   today.json / live/日付.json / hits.json / reports.json を読み統合表示。
   どのJSONが無くても壊れないようにフォールバックする。 */
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

  var state = { today:null, live:null, hits:null, reports:null };

  function showNodata(msg){
    var s=document.getElementById("nodata");
    if(s){s.hidden=false;document.getElementById("nodata-msg").textContent=msg;}
  }

  // ---- ヘッダー & カウントダウン ----
  function deadlineDate(hhmm){
    var mm=/^(\d{1,2}):(\d{2})$/.exec(String(hhmm||"").trim());
    if(!mm)return null;
    var d=new Date(+date.slice(0,4), +date.slice(4,6)-1, +date.slice(6,8), +mm[1], +mm[2], 0, 0);
    return d;
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

  // ---- レースタブ (同じ場の1R〜12R) ----
  function renderTabs(venue){
    var box=document.getElementById("race-tabs");
    if(!box)return;
    var races=(venue&&venue.races)||[];
    if(!races.length){
      // today.jsonが無い日でも1-12Rのタブは出す
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

  // ---- 結果パネル ----
  function renderResult(){
    var hits=state.hits;
    if(!hits||hits.date!==date)return false;
    var item=(hits.items||[]).filter(function(i){return i.race_id===id;})[0];
    if(!item)return false;
    var sec=document.getElementById("result-panel");
    var body=document.getElementById("result-body");
    sec.hidden=false;
    var lanes=String(item.combo||"").split("-");
    var comboHtml=lanes.map(function(l){return laneBadge(l);}).join('<span class="combo-dash">›</span>');
    var hitCls=item.hit?"res-hit":"res-miss";
    var rankTxt=item.model_rank?("AI予想 "+item.model_rank+"位"):"";
    body.innerHTML=
      '<div class="res-flex">'
      +'<div class="res-combo '+hitCls+'">'+comboHtml+'</div>'
      +'<div class="res-info">'
      +'<div class="res-badge '+hitCls+'">'+(item.hit?"🎯 的中！（AI上位20点内）":"不的中")+"</div>"
      +(item.payout?'<div class="res-pay">3連単 '+Number(item.payout).toLocaleString()+"円</div>":"")
      +(rankTxt?'<div class="res-rank">'+esc(rankTxt)+"</div>":"")
      +"</div></div>";
    var st=document.getElementById("rh-status");
    if(st)st.innerHTML='<span class="stat-chip '+(item.hit?"stat-hit":"stat-done")+'">'+(item.hit?"的中":"レース終了")+"</span>";
    var cd=document.getElementById("rh-cd");
    if(cd)cd.hidden=true;
    if(cdTimer)clearInterval(cdTimer);
    return true;
  }

  // ---- 勝率バー (朝 vs 直前) ----
  function renderProbs(liveRace,todayRace){
    var sec=document.getElementById("prob-panel");
    var box=document.getElementById("prob-bars");
    var sub=document.getElementById("prob-sub");
    var wp=liveRace&&liveRace.win_prob;
    var mp=(liveRace&&liveRace.morning_win_prob)||null;
    if(!wp&&!mp){
      // liveが無い→today.jsonの本命だけでも
      if(!todayRace)return false;
      sec.hidden=false;
      sub.textContent="(朝モデル・本命のみ)";
      box.innerHTML='<div class="prob-row"><div class="pr-lane">'+laneBadge(todayRace.honmei_lane)
        +'</div><div class="pr-track"><div class="pr-fill" style="width:'+(todayRace.honmei_prob*100)
        +'%"></div></div><div class="pr-val">'+pct(todayRace.honmei_prob)+"</div></div>"
        +'<p class="note">展示航走後にここが6艇分の直前予測へ更新されます。</p>';
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

  // ---- 展示タイム ----
  function renderExh(liveRace){
    var ex=liveRace&&liveRace.exhibition;
    if(!ex)return;
    var sec=document.getElementById("exh-panel");
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
  }

  // ---- 3連単TOP10 ----
  function renderTop10(liveRace,resultCombo){
    var top=(liveRace&&liveRace.top10)||[];
    if(!top.length)return;
    var sec=document.getElementById("top10-panel");
    var ol=document.getElementById("top10-list");
    sec.hidden=false;
    ol.innerHTML=top.map(function(t,i){
      var isHit=resultCombo&&t.combo===resultCombo;
      var lanes=String(t.combo).split("-");
      return '<li class="t10'+(isHit?" t10-hit":"")+'">'
        +'<span class="t10-rank">'+(i+1)+"</span>"
        +'<span class="t10-combo">'+lanes.map(laneBadge).join("-")+"</span>"
        +'<span class="t10-bar"><span style="width:'+Math.min(100,t.prob*100/(top[0].prob||1)*1)+'%"></span></span>'
        +'<span class="t10-prob">'+pct(t.prob)+"</span>"
        +(isHit?'<span class="t10-hitmark">🎯 的中</span>':"")
        +"</li>";
    }).join("");
  }

  // ---- メイン ----
  Promise.all([
    loadJson("today.json"),
    loadJson("live/"+date+".json"),
    loadJson("hits.json"),
    loadJson("reports.json")
  ]).then(function(res){
    state.today=res[0];state.live=res[1];state.hits=res[2];state.reports=res[3];

    // today.json は当日のみ有効
    var venue=null,todayRace=null;
    if(state.today&&state.today.date===date){
      venue=(state.today.venues||[]).filter(function(v){return v.jcd===jcd;})[0];
      if(venue)todayRace=(venue.races||[]).filter(function(r){return r.race_id===id;})[0];
    }
    var liveRace=null;
    if(state.live&&state.live.date===date){
      liveRace=(state.live.races||[]).filter(function(r){return r.race_id===id;})[0];
    }

    // ヘッダー
    document.getElementById("rh-venue").innerHTML=
      esc(venueName)+' <span class="rh-rno">'+rno+"R</span>";
    var meta=fmtDate(date);
    var dlStr=(todayRace&&todayRace.deadline)||(liveRace&&liveRace.deadline)||null;
    if(dlStr)meta+="　締切 "+dlStr;
    if(todayRace&&todayRace.flag)meta+="　"+(FLAG_LABEL[todayRace.flag]||todayRace.flag);
    document.getElementById("rh-meta").textContent=meta;

    renderTabs(venue);

    // 結果
    var hasResult=renderResult();
    var resultCombo=null;
    if(hasResult){
      var it=(state.hits.items||[]).filter(function(i){return i.race_id===id;})[0];
      resultCombo=it&&it.combo;
    }else if(dlStr&&isToday){
      var dl=deadlineDate(dlStr);
      if(dl&&dl>new Date())startCountdown(dl);
      else document.getElementById("rh-status").innerHTML='<span class="stat-chip stat-wait">結果待ち</span>';
    }else if(!isToday){
      document.getElementById("rh-status").innerHTML='<span class="stat-chip stat-done">開催終了</span>';
    }

    // パネル
    var any=false;
    if(renderProbs(liveRace,todayRace))any=true;
    renderExh(liveRace);
    renderTop10(liveRace,resultCombo);
    if(!any&&!hasResult){
      showNodata(isToday
        ?"このレースの予測データはまだありません。朝7時のレポート生成後に表示されます。"
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

    // 当日は1分ごとにlive/hitsを再取得
    if(isToday&&!hasResult){
      setInterval(function(){
        Promise.all([loadJson("live/"+date+".json"),loadJson("hits.json")]).then(function(r2){
          state.live=r2[0];state.hits=r2[1];
          var lv=null;
          if(state.live&&state.live.date===date){
            lv=(state.live.races||[]).filter(function(r){return r.race_id===id;})[0];
          }
          var hr=renderResult();
          var rc=null;
          if(hr){
            var it2=(state.hits.items||[]).filter(function(i){return i.race_id===id;})[0];
            rc=it2&&it2.combo;
          }
          renderProbs(lv,todayRace);
          renderExh(lv);
          renderTop10(lv,rc);
        });
      },60000);
    }
  });
})();
