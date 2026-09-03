/*
 * Shared data layer for GitHub Pages + Supabase.
 *
 * Fill in js/supabase.config.js with the two values from the Supabase project.
 * The config script is loaded immediately before this one in index.html.
 *
 * This file deliberately has no service-role key: browsers may only contain the
 * Supabase URL and anon key.  Row Level Security in supabase-schema.sql protects
 * the actual data.
 */
(function () {
  'use strict';
  const cfg = window.SUPABASE_CONFIG;
  if (!cfg || !cfg.url || !cfg.anonKey || cfg.url.includes('YOUR_PROJECT')) {
    console.warn('Supabase is not configured; using this browser only.');
    return;
  }
  const sb = window.supabase.createClient(cfg.url, cfg.anonKey);
  window.supabaseClient = sb;
  let profile = null;

  function banner(message, bad) {
    const b = document.getElementById('global-error-banner');
    if (!b) return;
    b.style.background = bad ? '#D64545' : '#2E9E51';
    b.textContent = message; b.style.display = 'block';
    setTimeout(() => { b.style.display = 'none'; }, 4500);
  }
  function fail(error, fallback) {
    console.error(error);
    banner(fallback || (error && error.message) || '저장 중 오류가 발생했어요.', true);
  }
  function itemFromRow(r) {
    return { id:r.id, type:r.type, name:r.name, location:r.location, date:r.lost_date,
      description:r.description || '', contact:r.contact || '', photos:r.photos || [],
      authorId:r.author_id, status:r.status, createdAt:new Date(r.created_at).getTime() };
  }
  async function loadProfile() {
    const { data:{ user } } = await sb.auth.getUser();
    if (!user) return null;
    const { data, error } = await sb.from('profiles').select('*').eq('id', user.id).single();
    if (error) throw error;
    profile = data;
    myId = data.student_id; myName = data.name; myDept = data.dept || '';
    isAdmin = !!data.is_admin;
    return data;
  }
  async function refreshLostFound() {
    const { data, error } = await sb.from('lost_found_items').select('*').order('created_at', { ascending:false });
    if (error) throw error;
    items = data.map(itemFromRow);
    renderItems(); updateHomeCount();
  }
  async function updateHomeCountRemote() {
    const { count } = await sb.from('lost_found_items').select('*', { count:'exact', head:true });
    const el = document.getElementById('home-count'); if (el) el.textContent = (count || 0) + '건 등록됨';
  }

  // ---- Authentication (Supabase Auth uses the verified school email) ----
  window.submitAuth = async function () {
    const btn = document.getElementById('auth-submit-btn');
    const id = document.getElementById('auth-id').value.trim();
    const pw = document.getElementById('auth-pw').value;
    if (!id || !pw) return showAuthError('학번과 비밀번호를 입력해주세요');
    if (pw.length < 6) return showAuthError('비밀번호는 6자 이상이어야 해요');
    btn.disabled = true;
    try {
      if (authMode === 'signup') {
        const name = document.getElementById('auth-name').value.trim();
        const email = document.getElementById('auth-email').value.trim().toLowerCase();
        if (!name) return showAuthError('이름을 입력해주세요');
        if (!/^[^\s@]+@senedu\.kr$/.test(email)) return showAuthError('회원가입은 @senedu.kr 학교 이메일만 가능해요');
        if (!selectedAuthDept) return showAuthError('학과를 선택해주세요');
        const { data, error } = await sb.auth.signUp({ email, password:pw, options:{ data:{ student_id:id, name, dept:selectedAuthDept } } });
        if (error) throw error;
        if (!data.session) { banner('학교 이메일의 인증 링크를 누른 뒤 로그인해주세요.'); return; }
      } else {
        if (!/^[^\s@]+@senedu\.kr$/.test(id.toLowerCase())) return showAuthError('로그인에는 학교 이메일을 입력해주세요.');
        const { error } = await sb.auth.signInWithPassword({ email:id.toLowerCase(), password:pw });
        if (error) throw new Error('이메일 또는 비밀번호가 올바르지 않아요.');
      }
      await loadProfile();
      document.getElementById('auth').classList.remove('active'); document.getElementById('home').classList.add('active');
      updateWelcome(); await updateHomeCountRemote(); await updateSuggestCount(); await updatePortfolioCount();
      updateCertCount(); renderHomeExamDday(); startHomeTips();
    } catch (e) { showAuthError(e.message || '로그인 처리 중 오류가 발생했어요.'); }
    finally { btn.disabled = false; }
  };
  window.logout = async function () {
    await sb.auth.signOut(); profile = null; myId=''; myName=''; myDept=''; isAdmin=false;
    hideAllViews(); document.getElementById('auth').classList.add('active'); setAuthMode('login');
  };

  // ---- Lost and found ----
  window.showLostFound = async function () { hideAllViews(); document.getElementById('lostfound').classList.add('active'); window.scrollTo(0,0); try { await refreshLostFound(); } catch(e) { fail(e); } };
  window.updateHomeCount = function () { if (profile) updateHomeCountRemote().catch(fail); };
  window.submitItem = async function () {
    const name=document.getElementById('form-name').value.trim(), location=document.getElementById('form-location').value.trim();
    const date=document.getElementById('form-date').value, description=document.getElementById('form-desc').value.trim(), contact=document.getElementById('form-contact').value.trim();
    if (!name || !location || !date) return showFormError('물품명, 장소, 날짜는 꼭 입력해주세요');
    const btn=document.getElementById('submit-btn'); btn.disabled=true;
    try {
      const { data:{user} }=await sb.auth.getUser(); if(!user) throw new Error('로그인이 필요해요.');
      const urls=[];
      for (let i=0;i<formPhotos.length;i++) {
        const blob=await (await fetch(formPhotos[i])).blob(); const path=user.id+'/'+crypto.randomUUID()+'.jpg';
        const {error:up}=await sb.storage.from('lost-found-photos').upload(path,blob,{contentType:'image/jpeg'}); if(up) throw up;
        urls.push(sb.storage.from('lost-found-photos').getPublicUrl(path).data.publicUrl);
      }
      const { error }=await sb.from('lost_found_items').insert({type:formType,name,location,lost_date:date,description,contact,photos:urls}); if(error) throw error;
      closeAddModal(); await refreshLostFound();
    } catch(e) { showFormError(e.message || '등록하지 못했어요.'); } finally { btn.disabled=false; }
  };
  window.toggleResolve = async function(id) { const it=items.find(x=>x.id===id); if(!it) return; const {error}=await sb.from('lost_found_items').update({status:it.status==='open'?'resolved':'open'}).eq('id',id); if(error) fail(error); else refreshLostFound(); };
  window.deleteItem = async function(id) { const {error}=await sb.from('lost_found_items').delete().eq('id',id); if(error) fail(error); else refreshLostFound(); };
  // Existing renderer reads local photos; use the shared URLs placed on each item.
  const originalRenderItems = window.renderItems;
  window.renderItems = function () {
    const savedGet = DB.get; DB.get = function(key) { const m=/^lostfound-photo:(.+)$/.exec(key); if(m) return (items.find(x=>x.id===m[1])||{}).photos||[]; return savedGet.call(DB,key); };
    try { return originalRenderItems(); } finally { DB.get=savedGet; }
  };

  // ---- Anonymous suggestions ----
  let suggestions=[];
  async function loadSuggestionsRemote() {
    let data, error;
    if (isAdmin) ({data,error}=await sb.from('suggestions').select('*').order('created_at',{ascending:false}));
    else ({data,error}=await sb.rpc('public_suggestions'));
    if(error) throw error;
    suggestions=data.map(r=>({id:r.id,text:r.text,category:r.category,authorId:r.author_id,createdAt:new Date(r.created_at).getTime()}));
  }
  window.loadSuggestions = () => suggestions;
  window.updateSuggestCount = async function() { await loadSuggestionsRemote(); const el=document.getElementById('home-suggest-count'); if(el) el.textContent=suggestions.length+'건 등록됨'; };
  window.showSuggest = async function() { hideAllViews(); document.getElementById('suggest').classList.add('active'); renderSuggestCategoryTabs(); try { await loadSuggestionsRemote(); renderSuggestions(); } catch(e) { fail(e); } };
  window.submitSuggest = async function() { const text=document.getElementById('suggest-form-text').value.trim(), err=document.getElementById('suggest-form-error'); if(!text){err.textContent='내용을 입력해주세요.';err.style.display='block';return;} const {error}=await sb.from('suggestions').insert({text,category:suggestDraftCategory}); if(error){err.textContent=error.message;err.style.display='block';return;} closeSuggestModal(); await loadSuggestionsRemote(); renderSuggestions(); };
  window.deleteSuggestion = async function(id) { const {error}=await sb.from('suggestions').delete().eq('id',id); if(error) fail(error); else { await loadSuggestionsRemote(); renderSuggestions(); } };

  // ---- Private portfolio ----
  let portfolio=[];
  async function loadPortfolioRemote() { const {data,error}=await sb.from('portfolio_items').select('*').order('created_at',{ascending:false}); if(error) throw error; portfolio=data.map(r=>({id:r.id,category:r.category,title:r.title,date:r.event_date||'',desc:r.description||'',createdAt:new Date(r.created_at).getTime()})); }
  window.loadPortfolio=()=>portfolio;
  window.updatePortfolioCount=async function(){if(!profile)return;await loadPortfolioRemote();const el=document.getElementById('home-portfolio-count');if(el)el.textContent=portfolio.length+'건 등록됨';};
  window.showPortfolio=async function(){hideAllViews();document.getElementById('portfolio').classList.add('active');try{await loadPortfolioRemote();renderPortfolio();}catch(e){fail(e);}};
  window.submitPortfolioForm=async function(){const title=document.getElementById('portfolio-form-title').value.trim(),err=document.getElementById('portfolio-form-error');if(!title){err.textContent='제목을 입력해주세요.';err.style.display='block';return;}const y=document.getElementById('portfolio-form-year').value,m=document.getElementById('portfolio-form-month').value,d=document.getElementById('portfolio-form-day').value;const date=y?(y+(m?'.'+String(m).padStart(2,'0'):'')+(d?'.'+String(d).padStart(2,'0'):'')):null;const {error}=await sb.from('portfolio_items').insert({category:portfolioDraftCategory,title,event_date:date,description:document.getElementById('portfolio-form-desc').value.trim()});if(error){err.textContent=error.message;err.style.display='block';return;}closePortfolioModal();await loadPortfolioRemote();renderPortfolio();};
  window.deletePortfolioItem=async function(id){const {error}=await sb.from('portfolio_items').delete().eq('id',id);if(error)fail(error);else{await loadPortfolioRemote();renderPortfolio();}};

  // Server-controlled admin flag. No administrator password is shipped to GitHub.
  window.toggleAdmin=function(){ if(!isAdmin) return banner('관리자 권한이 없는 계정입니다.',true); refreshAdminSensitiveViews(); banner('관리자 권한이 활성화되어 있습니다.'); };
  window.checkAdminPass=function(){ banner('관리자 권한은 Supabase의 profiles.is_admin에서 설정합니다.',true); };

  // ---- My profile / password ----
  window.openMyInfoModal = async function() {
    try {
      const {data:{user}}=await sb.auth.getUser();
      const code=classCodeFromStudentId(myId); let classInfo=myDept || '정보 없음';
      if(code) classInfo=(DEPT_LABELS[code[0]] || code[0])+' '+code[1]+'학년 '+code[2]+'반';
      const numberMatch=/^[0-9]{5}$/.test(myId||'') ? parseInt(myId.slice(3),10) : null;
      let summary='<div class="myinfo-row"><span>이름</span><b>'+escHtml(myName||'-')+'</b></div>'+
        '<div class="myinfo-row"><span>학번</span><b>'+escHtml(myId||'-')+'</b></div>'+
        '<div class="myinfo-row"><span>학과 · 반</span><b>'+escHtml(classInfo)+'</b></div>';
      if(numberMatch!==null) summary+='<div class="myinfo-row"><span>번호</span><b>'+numberMatch+'번</b></div>';
      if(user && user.email) summary+='<div class="myinfo-row"><span>이메일</span><b>'+escHtml(user.email)+'</b></div>';
      document.getElementById('myinfo-summary').innerHTML=summary;
      ['myinfo-current-pw','myinfo-new-pw','myinfo-new-pw2'].forEach(id=>document.getElementById(id).value='');
      document.getElementById('myinfo-error').style.display='none'; document.getElementById('myinfo-success').style.display='none';
      document.getElementById('myinfo-overlay').style.display='flex';
    } catch(e) { fail(e); }
  };
  window.submitPasswordChange = async function() {
    const err=document.getElementById('myinfo-error'), ok=document.getElementById('myinfo-success'); err.style.display='none';ok.style.display='none';
    const current=document.getElementById('myinfo-current-pw').value, next=document.getElementById('myinfo-new-pw').value, repeat=document.getElementById('myinfo-new-pw2').value;
    if(next.length<6){err.textContent='새 비밀번호는 6자 이상이어야 해요.';err.style.display='block';return;}
    if(next!==repeat){err.textContent='새 비밀번호가 서로 일치하지 않아요.';err.style.display='block';return;}
    try { const {data:{user}}=await sb.auth.getUser(); const {error:verify}=await sb.auth.signInWithPassword({email:user.email,password:current}); if(verify) throw new Error('현재 비밀번호가 올바르지 않아요.'); const {error}=await sb.auth.updateUser({password:next}); if(error) throw error; ok.textContent='비밀번호가 변경되었어요.';ok.style.display='block'; } catch(e) {err.textContent=e.message||'비밀번호를 변경하지 못했어요.';err.style.display='block';}
  };

  // Supabase Auth uses the school email as the login identifier.  The student
  // number is still collected at sign-up and saved in profiles for timetables.
  const originalSetAuthMode = window.setAuthMode;
  if (typeof originalSetAuthMode === 'function') {
    window.setAuthMode = function(mode) {
      originalSetAuthMode(mode);
      const input=document.getElementById('auth-id');
      const label=input && input.closest('.form-group') && input.closest('.form-group').querySelector('label');
      if (mode === 'login') { if(label) label.textContent='학교 이메일'; input.placeholder='예: gildong@senedu.kr'; }
      else { if(label) label.textContent='학번'; input.placeholder='예: 20401'; }
    };
    window.setAuthMode(authMode);
  } else {
    console.error('auth.js가 로드되지 않았습니다. GitHub Pages에 js 폴더 전체를 업로드하세요.');
  }

  window.init = async function () {
    try { const {data:{session}}=await sb.auth.getSession(); if(session){await loadProfile();document.getElementById('auth').classList.remove('active');document.getElementById('home').classList.add('active');updateWelcome();startHomeTips();} updateHomeCount(); if(session){updateSuggestCount().catch(fail);updatePortfolioCount().catch(fail);} updateCertCount();renderHomeExamDday(); } catch(e) { fail(e,'서버 연결을 확인해주세요.'); }
  };
}());
