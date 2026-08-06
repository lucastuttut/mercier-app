function renderQuadroEquipe() { 
    ['TODO','DOING','DONE'].forEach(function(c) { 
        const ct=getEl('col-'+c.toLowerCase()+'-container'), el=getEl('col-'+c.toLowerCase()), bt=getEl('btn-toggle-'+c.toLowerCase()); 
        if(ct&&el&&bt){ 
            if(colsMinimizadas[c]){ ct.classList.remove('min-h-[500px]'); ct.classList.add('h-fit','pb-0'); el.classList.add('hidden'); bt.innerText='➕'; } 
            else { ct.classList.add('min-h-[500px]'); ct.classList.remove('h-fit','pb-0'); el.classList.remove('hidden'); bt.innerText='➖'; } 
        } 
    }); 
    
    // Variáveis com os nomes corretos!
    let htmlTodo = "", htmlDoing = "", htmlDone = ""; 
    let countTodo = 0, countDoing = 0, countDone = 0; 
    
    const pP = {"AGORA":1, "IMEDIATO":2, "IMPORTANTE":3, "REGULAR":4, "TRANQUILO":5, "":6}; 
    let ord = [...tarefasEquipe].sort(function(a,b) { let pA=pP[a.prazo||""]||6, pB=pP[b.prazo||""]||6; return pA!==pB ? pA-pB : b.uid-a.uid; }); 
    
    ord.forEach(function(t) { 
        if(modoMinhasTarefas&&usuarioAtual&&t.responsavel!==usuarioAtual) return; 
        if(!modoMinhasTarefas&&filtrosEquipeAtivos.length>0&&!filtrosEquipeAtivos.includes(t.responsavel)) return; 
        
        const c = coresEquipe[t.responsavel]||"bg-slate-100 text-slate-700 border-slate-300"; const cB = c.split(' ')[2]; 
        let cH = safeArray(t.comentarios).map(function(cm) { 
            const cC=coresEquipe[cm.autor]?coresEquipe[cm.autor].split(' ')[1]:"text-slate-600"; 
            const aH=cm.anexo?`<br><img src="${cm.anexo}" class="mt-2 rounded-lg max-h-40 w-full cursor-pointer object-cover border" onclick="window.open('${cm.anexo}')"/>`:''; 
            return `<div class="mb-2 bg-white p-2 rounded-md border shadow-sm"><span class="${cC} font-black text-[9px] uppercase">${esc(cm.autor)}:</span> <span class="text-[10px] font-bold text-slate-700">${esc(cm.texto)}</span>${aH}</div>`; 
        }).join(''); 
        
        const iM = t.minimizada||false; 
        
        let bdg = '';
        const mP = {"AGORA":"bg-red-100 text-red-700 🚨 AGORA","IMEDIATO":"bg-orange-100 text-orange-700 ⚡ 1 DIA","IMPORTANTE":"bg-amber-100 text-amber-700 ⚠️ 2 DIAS","REGULAR":"bg-blue-100 text-blue-700 📅 3 DIAS","TRANQUILO":"bg-emerald-100 text-emerald-700 ☕ + DIAS"}; 
        if(mP[t.prazo]) { let pts = mP[t.prazo].split(' '); bdg = `<span class="${pts[0]} ${pts[1]} px-2 py-0.5 rounded text-[9px] font-black uppercase shadow-sm border">${pts[2]} ${pts[3]||''} ${pts[4]||''}</span>`; }

        let bDs = `<button onclick="minimizarTarefaEquipe(${t.uid})" class="text-slate-400 font-black text-[12px] bg-slate-100 px-2 py-1 rounded-lg">${iM?'➕':'➖'}</button>`;
        if(t.coluna==='TODO') bDs += `<button onclick="moverTarefaEquipe(${t.uid},'DOING')" class="text-slate-300 hover:text-blue-500 font-black px-1">➡️</button>`;
        if(t.coluna==='DOING') bDs += `<button onclick="moverTarefaEquipe(${t.uid},'TODO')" class="text-slate-300 hover:text-slate-500 font-black px-1">⬅️</button><button onclick="moverTarefaEquipe(${t.uid},'DONE')" class="text-slate-300 hover:text-green-500 font-black px-1">✅</button>`;
        if(t.coluna==='DONE') bDs += `<button onclick="moverTarefaEquipe(${t.uid},'DOING')" class="text-slate-300 hover:text-slate-500 font-black px-1">⬅️</button>`;
        bDs += `<button onclick="excluirTarefaEquipe(${t.uid})" class="text-slate-200 hover:text-red-500 font-black px-1">✕</button>`;

        let cd = `
        <div id="card-${t.uid}" draggable="true" ondragstart="dragTarefa(event,${t.uid})" ondragend="dragEndTarefa(event)" class="bg-white p-3.5 rounded-2xl shadow-sm border-t-4 ${cB} flex flex-col gap-2 relative overflow-hidden">
            <div class="flex justify-between items-start">
                <div class="flex flex-col gap-1 items-start"><span class="${c} px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider">${esc(t.responsavel)}</span>${bdg}</div>
                <div class="flex gap-1 items-center">${bDs}</div>
            </div>`;
        
        if(!iM) {
            cd += `
            <span class="text-sm font-black text-slate-800 mt-1 uppercase leading-snug">${esc(t.descricao)}</span>
            <span class="text-[8px] font-black text-slate-300 border-b pb-2">Criado em: ${t.data}</span>
            <div class="mt-1 flex flex-col gap-1.5">
                ${cH?`<div id="chat-${t.uid}" class="bg-slate-50 p-2 rounded-lg max-h-48 overflow-y-auto custom-scrollbar shadow-inner">${cH}</div>`:''}
                <div class="flex gap-1 mt-1 items-center">
                    <input type="text" placeholder="Responder..." onkeydown="if(event.key==='Enter') adicionarComentarioInline(${t.uid}, this)" class="flex-1 bg-white border p-2 text-[10px] font-bold rounded-xl outline-blue-500 uppercase">
                    <button onclick="acionarUploadImagem(${t.uid})" class="bg-slate-100 px-2 rounded-xl text-[12px] border h-full">📎</button>
                    <button onclick="adicionarComentarioInline(${t.uid}, this.previousElementSibling.previousElementSibling)" class="bg-blue-100 text-blue-600 px-3 rounded-xl text-[12px] h-full">➤</button>
                </div>
            </div>`;
        } else {
            cd += `<span class="text-[11px] font-black text-slate-800 truncate border-t pt-2 uppercase">${esc(t.descricao)}</span>`;
        }
        cd += `</div>`;
        
        // Aqui estava o erro! Agora está com os nomes certos:
        if(t.coluna==='TODO') { htmlTodo+=cd; countTodo++; } 
        else if(t.coluna==='DOING') { htmlDoing+=cd; countDoing++; } 
        else if(t.coluna==='DONE') { htmlDone+=cd; countDone++; } 
    }); 
    
    if(getEl('col-todo')) getEl('col-todo').inne
