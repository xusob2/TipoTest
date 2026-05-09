const API_BASE_URL = '/api';

// --- Variables Globales del Quiz ---
let globalFallos = [];
let selectedCat = null;
let queue = [];
let failedPool = [];
let fetchedGroups = []; // Agregado para cachear los grupos en el menú
let currentAdminQuestions = []; // NUEVO: Para gestionar la edición de forma segura
let idx = 0;
let correctsInSession = 0;
let mode = 'quiz'; // 'quiz' o 'review'
let isAnswered = false;
let timeoutId = null;
let perfectRuns = {};
let totalQuestions = 0; // Para calcular bien el % final
let lastPlayedData = {};
let currentGroup = null;


function timeAgo(dateString) {
    if (!dateString) return "Nunca";
    const diff = Date.now() - new Date(dateString).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return "Hace un momento";
    if (min < 60) return `Hace ${min} min`;
    const hours = Math.floor(min / 60);
    if (hours < 24) return `Hace ${hours}h`;
    const days = Math.floor(hours / 24);
    return `Hace ${days} d`;
}
// --- Elementos DOM Pantallas ---
const screens = {
    'main-menu': document.getElementById('main-menu'),
    'admin-screen': document.getElementById('admin-screen'),
    'quiz-container': document.getElementById('quiz-container'),
    'summary-screen': document.getElementById('summary-screen')
};

// --- Referencias UI del Quiz ---
const quizTitle = document.getElementById('quiz-title');
const progressText = document.getElementById('progress-text');
const navButtonsContainer = document.getElementById('nav-buttons-container');
const reviewIndicator = document.getElementById('review-indicator');
const customPhrase = document.getElementById('custom-phrase');
const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const textInputContainer = document.getElementById('text-input-container');
const textAnswer = document.getElementById('text-answer');
const feedbackArea = document.getElementById('feedback-area');
const feedbackMsg = document.getElementById('feedback-msg');
const btnNext = document.getElementById('btn-next');
const btnValidate = document.getElementById('btn-validate');
const yaMeLaSeContainer = document.getElementById('ya-me-la-se-container');
const dynamicMenuContainer = document.getElementById('dynamic-menu-container');

// --- Inicialización ---
document.addEventListener("DOMContentLoaded", () => {
    lucide.createIcons();
    loadMainMenu();

    textInputContainer.addEventListener('submit', (e) => {
        e.preventDefault();
        handleSubmitText();
    });

    window.addEventListener('keydown', (e) => {
        if (isAnswered && (e.key === ' ' || e.key === 'Enter')) {
            e.preventDefault();
            handleNext();
        }
    });

    document.getElementById('question-form').addEventListener('submit', saveQuestion);
});

// --- Utilidades de Navegación ---
function showScreen(screenId) {
    Object.values(screens).forEach(screen => screen.classList.add('hidden'));
    screens[screenId].classList.remove('hidden');
    if (timeoutId) clearTimeout(timeoutId);
}

function shuffleArray(array) {
    let newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
}

// ==========================================
// 1. CARGA DEL MENÚ PRINCIPAL (CON NAVEGACIÓN POR GRUPOS)
// ==========================================
async function loadMainMenu() {
    showScreen('main-menu');
    dynamicMenuContainer.innerHTML = '<p style="color:gray; text-align:center;">Cargando temas...</p>';
    
    try {
      const [resMenu, resRuns, resFallos, resLastPlayed] = await Promise.all([
            fetch(`${API_BASE_URL}/menu`),
            fetch(`${API_BASE_URL}/perfect-runs`),
            fetch(`${API_BASE_URL}/fallos`),
            fetch(`${API_BASE_URL}/last-played`) // AÑADIDO
        ]);
        fetchedGroups = await resMenu.json(); 
        perfectRuns = await resRuns.json();
        globalFallos = await resFallos.json();
        lastPlayedData = await resLastPlayed.json(); // GUARDAMOS FECHAS
        
        renderGroupMenu();
    } catch (error) {
        dynamicMenuContainer.innerHTML = '<p style="color:red; text-align:center;">Error conectando al servidor.</p>';
    }
}
function renderGroupMenu() {
    const btnBack = document.getElementById('btn-back-groups');
    if (btnBack) btnBack.classList.add('hidden');
    
    const subtitle = document.getElementById('menu-main-subtitle');
    if (subtitle) subtitle.textContent = "SELECCIONA UN TEMA";
    
    dynamicMenuContainer.innerHTML = '';

    if(fetchedGroups.length === 0) {
        dynamicMenuContainer.innerHTML = '<p style="text-align:center; color:var(--text-muted)">No hay temas cargados. Usa el engranaje para administrarlos.</p>';
        return;
    }

    const gridDiv = document.createElement('div');
    gridDiv.className = 'grid-2';

    fetchedGroups.forEach(group => {
        const btn = document.createElement('button');
        btn.className = 'menu-btn dark-btn'; 
        btn.style.padding = "20px";
        btn.innerHTML = `<i data-lucide="folder"></i> ${group._id}`;
        btn.onclick = () => showModulesForGroup(group._id);
        gridDiv.appendChild(btn);
    });

    dynamicMenuContainer.appendChild(gridDiv);
    lucide.createIcons(); 
}

// FUNCIÓN ARREGLADA: Ya no está flotando
function showModulesForGroup(groupName) {
    currentGroup = groupName; // Guardamos dónde estamos para volver luego
    const btnBack = document.getElementById('btn-back-groups');
    if (btnBack) btnBack.classList.remove('hidden');
    
    const subtitle = document.getElementById('menu-main-subtitle');
    if (subtitle) subtitle.textContent = groupName.toUpperCase();
    
    dynamicMenuContainer.innerHTML = '';

    const group = fetchedGroups.find(g => g._id === groupName);
    if (!group) return;

    group.modules.sort((a, b) => a.name.localeCompare(b.name));

    // Buscar cuál fue el último jugado en este grupo
    let latestTime = 0;
    let latestModule = null;
    group.modules.forEach(mod => {
        if (lastPlayedData[mod.name]) {
            const time = new Date(lastPlayedData[mod.name]).getTime();
            if (time > latestTime) {
                latestTime = time;
                latestModule = mod.name;
            }
        }
    });

    const gridDiv = document.createElement('div');
    gridDiv.className = 'grid-2';

    group.modules.forEach((mod) => {
        const btn = document.createElement('button');
        const isTextModule = mod.name.includes('Rellenar');
        const isLatest = mod.name === latestModule; // ¿Es el más reciente?
        
        // Colores y resaltados
        btn.className = `menu-btn ${isTextModule ? 'blue-btn' : 'dark-btn'}`;
        if (isLatest) {
            // Le damos un borde y brillo amarillo si es el último jugado
            btn.style.boxShadow = "0 0 15px rgba(250, 204, 21, 0.3)";
            btn.style.borderColor = "#facc15"; 
        }

        btn.style.justifyContent = "space-between"; 
        btn.onclick = () => startQuiz(mod.name);
        
        const iconName = isTextModule ? 'edit-3' : 'terminal';
        const perfectCount = perfectRuns[mod.name] || 0;
        const perfectBadge = perfectCount > 0 
            ? `<div style="color: #fbbf24; display: flex; align-items: center; gap: 4px; font-size: 0.9rem; background: rgba(0,0,0,0.3); padding: 4px 8px; border-radius: 8px;"><i data-lucide="crown" style="width: 16px;"></i> x${perfectCount}</div>` 
            : '';

        // Texto del tiempo transcurrido
        const timeText = timeAgo(lastPlayedData[mod.name]);

        btn.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 4px;">
                <div style="display: flex; align-items: center; gap: 12px; color: ${isLatest ? '#facc15' : 'inherit'};">
                    <i data-lucide="${iconName}"></i> 
                    <span style="text-align: left; font-weight: ${isLatest ? '900' : 'bold'};">${mod.name} (${mod.count})</span>
                </div>
                <span style="font-size: 0.65rem; color: #a1a1aa; padding-left: 30px; letter-spacing: 1px;">🗓️ ${timeText}</span>
            </div>
            ${perfectBadge}
        `;
        gridDiv.appendChild(btn);
    });

    dynamicMenuContainer.appendChild(gridDiv);

    // Botones de Repaso de Fallos...
    const fallosDeEsteGrupo = globalFallos.filter(q => q.groupName === groupName);
    if (fallosDeEsteGrupo.length > 0) {
        const chunkSize = 15;
        const numParts = Math.ceil(fallosDeEsteGrupo.length / chunkSize);

        for (let i = 0; i < numParts; i++) {
            const chunkCount = fallosDeEsteGrupo.slice(i * chunkSize, (i + 1) * chunkSize).length;
            const partLabel = numParts > 1 ? ` (Parte ${i + 1})` : '';

            const btnFallos = document.createElement('button');
            btnFallos.className = 'menu-btn red-btn col-flex center';
            btnFallos.style.marginTop = i === 0 ? "20px" : "10px";
            btnFallos.style.width = "100%";
            btnFallos.onclick = () => startFallos(groupName, i * chunkSize, chunkSize);
            
            btnFallos.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <i data-lucide="alert-triangle"></i> 
                    <span>Repasar fallos de este bloque${partLabel} (${chunkCount})</span>
                </div>
            `;
            dynamicMenuContainer.appendChild(btnFallos);
        }
    }
    lucide.createIcons();
}

function startFallosGlobales() {
    if (globalFallos.length === 0) return;
    
    selectedCat = 'fallos_globales';
    
    // CORRECCIÓN 1: Mapeamos para limpiar los estados antiguos (colores)
    queue = shuffleArray(globalFallos.map(q => ({ ...q, status: null })));
    
    failedPool = [];
    idx = 0;
    correctsInSession = 0;
    
    // CORRECCIÓN 2: Guardamos el total para que el % final no se rompa
    totalQuestions = queue.length; 
    
    mode = 'quiz';
    
    quizTitle.textContent = `REPASO: TODOS LOS FALLOS`;
    quizTitle.style.color = 'var(--red-main)';
    
    showScreen('quiz-container');
    renderQuestion();
}

// ==========================================
// 2. LÓGICA DEL JUEGO (QUIZ)
// ==========================================

function saveGlobalFallos(preguntaFallada) {
    // Lo enviamos a la base de datos sin bloquear la pantalla
    fetch(`${API_BASE_URL}/fallos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preguntaFallada)
    }).catch(e => console.error("Error guardando fallo:", e));
}

async function startQuiz(moduleName) {
    selectedCat = moduleName;
    try {
        const res = await fetch(`${API_BASE_URL}/quiz/${encodeURIComponent(moduleName)}`);
        if (!res.ok) throw new Error("Módulo no encontrado.");
        
        const data = await res.json();
        
        // Mapeamos preguntas y reseteamos estado de sesión (status)
        queue = shuffleArray(data.questions.map(q => ({
            _id: q._id,
            q: q.question,
            options: q.type === 'choice' ? q.options : null,
            a: q.type === 'choice' ? q.options[q.correct] : q.correctAnswerText,
            explanation: q.explanation || "No hay explicación disponible para esta pregunta.",
            groupName: q.groupName,
            status: null // Estado de la pregunta en esta sesión: null, 'correct', 'incorrect'
        })));

        failedPool = [];
        idx = 0;
        correctsInSession = 0;
        totalQuestions = queue.length; // Guardamos el total inicial para el % final
        mode = 'quiz';
        
        quizTitle.textContent = moduleName.toUpperCase();
        quizTitle.style.color = 'var(--yellow-main)';
        
        showScreen('quiz-container');
        renderQuestion();
    } catch (e) {
        alert("Error: " + e.message);
        loadMainMenu();
    }
}

// FUNCIÓN ARREGLADA: Eliminada la duplicada que había debajo de esta
// Añadimos startIndex y chunkSize a los parámetros (por defecto 0 y 15)
function startFallos(groupName, startIndex = 0, chunkSize = 15) {
    let filtrados = globalFallos.filter(q => q.groupName === groupName);
    if (filtrados.length === 0) return;
    
    // Cortamos el array para coger solo el lote de 15 que nos toca
    filtrados = filtrados.slice(startIndex, startIndex + chunkSize);
    
    // Por si acaso el usuario ha borrado fallos y el array se ha quedado vacío en esta parte
    if (filtrados.length === 0) return loadMainMenu(); 

    selectedCat = 'fallos';
    queue = shuffleArray(filtrados.map(q => ({ ...q, status: null })));
    failedPool = [];
    idx = 0;
    correctsInSession = 0;
    totalQuestions = queue.length; 
    mode = 'quiz';
    
    // Le ponemos un indicador visual al título para saber que es un lote
    const partNum = (startIndex / chunkSize) + 1;
    const isFragmented = globalFallos.filter(q => q.groupName === groupName).length > chunkSize;
    
    quizTitle.textContent = isFragmented ? `REPASO: ${groupName} (P${partNum})` : `REPASO: ${groupName}`;
    quizTitle.style.color = 'var(--red-main)';
    
    showScreen('quiz-container');
    renderQuestion();
}

function renderQuestion() {
    isAnswered = false;
    btnNext.disabled = true;
    feedbackArea.classList.add('hidden');
    if (timeoutId) clearTimeout(timeoutId);

    const current = queue[idx];
    progressText.textContent = `Pregunta ${idx + 1} de ${queue.length}`;
    questionText.textContent = current.q;
    
    renderNavDots();
    
    if (mode === 'review') {
        quizTitle.style.color = 'var(--blue-main)';
        quizTitle.textContent = 'MODO REPASO';
        reviewIndicator.classList.remove('hidden');
        for (let i = 1; i <= 3; i++) {
            const bar = document.getElementById(`hit-${i}`);
            bar.classList.toggle('active', (current.hits || 0) >= i);
        }
    } else {
        reviewIndicator.classList.add('hidden');
    }

    yaMeLaSeContainer.classList.toggle('hidden', selectedCat !== 'fallos' && selectedCat !== 'fallos_globales');

    if (current.options) {
        textInputContainer.classList.add('hidden');
        optionsContainer.classList.remove('hidden');
        optionsContainer.innerHTML = '';
        shuffleArray(current.options).forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.textContent = opt;
            btn.onclick = () => handleOptionClick(btn, opt, current.a);
            optionsContainer.appendChild(btn);
        });
    } else {
        optionsContainer.classList.add('hidden');
        textInputContainer.classList.remove('hidden');
        textAnswer.value = '';
        textAnswer.className = 'admin-input'; 
        textAnswer.style.textAlign = 'center';
        textAnswer.disabled = false;
        btnValidate.classList.remove('hidden');
        textAnswer.focus();
    }
}

function renderNavDots() {
    navButtonsContainer.innerHTML = '';
    queue.forEach((q, i) => {
        const dot = document.createElement('div');
        // Clase base y clase 'current'
        dot.className = `nav-dot ${i === idx ? 'current' : ''}`;
        
        // Recuperamos el color si ya se contestó antes (al navegar de vuelta)
        if (q.status === 'correct') dot.classList.add('correct');
        else if (q.status === 'incorrect') dot.classList.add('incorrect');

        dot.textContent = i + 1;
        dot.id = `nav-dot-${i}`;
        
        // Navegación clicable (SOLO en modo Quiz normal, no en Repaso/Castigo)
        if (mode === 'quiz') {
            dot.style.cursor = 'pointer';
            dot.onclick = () => {
                if (timeoutId) clearTimeout(timeoutId);
                idx = i;
                renderQuestion();
            };
        } else {
            dot.style.cursor = 'default';
        }
        
        navButtonsContainer.appendChild(dot);
    });
    const activeDot = document.getElementById(`nav-dot-${idx}`);
    if (activeDot) activeDot.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
}

function handleOptionClick(btnClicked, selected, correct) {
    if (isAnswered) return;
    isAnswered = true;
    const current = queue[idx];
    const isCorrect = selected === correct;
    
    // Sumar al porcentaje SOLO si es la primera vez que se contesta Y estamos en el test normal (no en castigo)
    if (mode === 'quiz' && isCorrect && !current.status) correctsInSession++;
    
    optionsContainer.querySelectorAll('.option-btn').forEach(b => {
        b.disabled = true;
        if (b.textContent === correct) b.classList.add('correct-ans');
        else if (b === btnClicked && !isCorrect) b.classList.add('wrong-ans');
        else b.style.opacity = '0.4';
    });
    updateStateAndTimers(isCorrect);
}

function handleSubmitText() {
    if (isAnswered) return;
    const answerRaw = textAnswer.value.trim().toUpperCase();
    if (!answerRaw) return;
    isAnswered = true;
    const current = queue[idx];
    const isCorrect = answerRaw === current.a.toUpperCase();
    
    // Sumar al porcentaje SOLO si es la primera vez que se contesta Y estamos en el test normal
    if (mode === 'quiz' && isCorrect && !current.status) correctsInSession++;
    
    textAnswer.disabled = true;
    btnValidate.classList.add('hidden');
    textAnswer.classList.add(isCorrect ? 'correct-input' : 'wrong-input');
    updateStateAndTimers(isCorrect);
}

function updateStateAndTimers(isCorrect) {
    const current = queue[idx];
    btnNext.disabled = false;
    
    // Cambiamos el color del círculo inmediatamente
    const dot = document.getElementById(`nav-dot-${idx}`);
    if (dot) dot.classList.add(isCorrect ? 'correct' : 'incorrect');

    // Miramos si la pregunta ya se había contestado antes en esta sesión al navegar atrás
    const alreadyAnsweredInSession = !!current.status;
    
    // Guardamos el estado para que los circulitos no pierdan el color al navegar
    if (!alreadyAnsweredInSession) {
        current.status = isCorrect ? 'correct' : 'incorrect';
    }

    if (!isCorrect) {
        feedbackArea.classList.remove('hidden');
        feedbackMsg.innerHTML = `
            <div style="color:#ef4444; font-weight:900; margin-bottom:5px;">❌ INCORRECTO</div>
            <div style="color:#f4f4f5; margin-bottom:10px;">Respuesta: <span style="color:#10b981;">${current.a}</span></div>
            <div style="color:#a1a1aa; font-size:0.75rem; font-weight:400; text-transform:none; line-height:1.4;">${current.explanation}</div>
        `;
        
        // Solo gestionamos bolsas de fallos si es la PRIMERA vez que se contesta
        if (!alreadyAnsweredInSession) {
            // ¡OJO AQUÍ! Usamos _id con barra baja
            if (!globalFallos.find(item => item._id === current._id)) {
                globalFallos.push(current);
                saveGlobalFallos(current);
            }
            // Bolsa de repaso de la sesión actual
            if (mode === 'quiz' && !failedPool.find(item => item._id === current._id)) {
                failedPool.push({ ...current, hits: 0 });
            }
        }
        
        if (mode === 'review') {
            current.hits = 0;
            customPhrase.textContent = "Fallo. El contador vuelve a 0.";
        }
        
        timeoutId = setTimeout(() => handleNext(), 2500); 
    } else {
        if (mode === 'review') {
            current.hits = (current.hits || 0) + 1;
            customPhrase.textContent = `Acierto ${current.hits}/3 para limpiar este fallo.`;
        }
        
        timeoutId = setTimeout(() => handleNext(), 800); 
    }
}

function finishQuiz() {
    const percent = Math.round((correctsInSession / totalQuestions) * 100);
    
    // GUARDAR 100% PERFECTO
    if (percent === 100 && selectedCat !== 'fallos' && selectedCat !== 'fallos_globales') {
        fetch(`${API_BASE_URL}/perfect-runs/${encodeURIComponent(selectedCat)}`, { method: 'POST' })
            .then(res => res.json())
            .then(data => { perfectRuns[selectedCat] = data.count; });
    }

    // GUARDAR "ÚLTIMA VEZ JUGADO" EN LA BASE DE DATOS
    if (selectedCat !== 'fallos' && selectedCat !== 'fallos_globales') {
        fetch(`${API_BASE_URL}/last-played`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ moduleName: selectedCat, groupName: currentGroup })
        })
        .then(res => res.json())
        .then(data => { lastPlayedData[selectedCat] = data.date; }); // Sincroniza localmente
    }
    
    let phrase = "";
    let icon = "trophy";
    let color = "#eab308";

    if (percent === 100) { phrase = "¡GOD MODE ABSOLUTO! ⚡ Dominas el sistema al 100%."; icon = "zap"; color = "#facc15"; }
    else if (percent >= 80) { phrase = "¡Ea! Casi perfecto, no esta mal, pero sabes que puedes mejorar ¿O acaso eres un cobarde?. ⚔️"; icon = "shield-check"; color = "#10b981"; }
    else if (percent >= 50) { phrase = "Aprobado. 📚 Pero vamos, que sigues siendo mas tonto que una gallina."; icon = "book-open"; color = "#fb923c"; }
    else { phrase = "Vaya mierda has hecho, estaras orgulloso...."; icon = "alert-circle"; color = "#ef4444"; }

    // ELEGIR A DÓNDE VOLVER (Si tenemos un grupo guardado, vuelve a él)
    const isGlobalFallos = selectedCat === 'fallos_globales';

    const summaryCard = document.querySelector('.summary-card');
    summaryCard.innerHTML = `
        <i data-lucide="${icon}" style="width: 64px; height: 64px; color: ${color}; margin-bottom: 24px;"></i>
        <h2 class="title-gradient">TEST FINALIZADO</h2>
        <div style="font-size: 2.5rem; font-weight: 900; color: ${color}; margin-bottom: 10px;">${percent}%</div>
        <p class="subtitle" style="text-transform: none; letter-spacing: normal; font-size: 1.1rem; color: #f4f4f5; margin-bottom: 30px;">${phrase}</p>
        
        <button id="btn-return-after-quiz" class="menu-btn full-yellow-btn">
            ${(currentGroup && !isGlobalFallos) ? 'Volver al Tema' : 'Volver al Menú Principal'}
        </button>
    `;
    
    // Le asignamos el evento por JS para que no haya fallos con las comillas
    document.getElementById('btn-return-after-quiz').onclick = () => {
        if (currentGroup && !isGlobalFallos) {
            showScreen('main-menu');
            showModulesForGroup(currentGroup);
        } else {
            loadMainMenu();
        }
    };

    lucide.createIcons();
    showScreen('summary-screen');
}

function handleNext() {
    if (timeoutId) clearTimeout(timeoutId);
    
    if (mode === 'quiz') {
        if (idx + 1 < queue.length) {
            idx++;
            renderQuestion();
        } else if (failedPool.length > 0) {
            queue = shuffleArray(failedPool).map(q => ({ ...q, status: null }));
            failedPool = [];
            idx = 0;
            mode = 'review';
            customPhrase.textContent = "MODO REPASO: Responde bien 3 veces cada pregunta fallada.";
            renderQuestion();
        } else {
            finishQuiz();
        }
    } else if (mode === 'review') {
        const current = queue[idx];
        let nextQueue = [...queue];

        // 1. Sacamos la pregunta actual de la cola
        nextQueue.splice(idx, 1);

        // 2. Si ya tiene los 3 aciertos, desaparece
        if (current.hits >= 3) {
            if (nextQueue.length === 0) return finishQuiz();
        } else {
            // 3. COMO EN REACT: Si le faltan aciertos o la acaba de fallar, SE VA AL FINAL DE LA COLA
            nextQueue.push(current);
        }
        
        // 4. Limpiamos su color para que no salga en verde/rojo al volver a aparecer
        current.status = null; 
        
        queue = nextQueue;
        idx = 0; // En repaso siempre leemos la primera de la cola
        renderQuestion();
    }
}

function removeFromFallos() {
    if (timeoutId) clearTimeout(timeoutId);
    
    const idToRemove = queue[idx]._id;
    globalFallos = globalFallos.filter(q => q._id !== idToRemove);
    
    // Le decimos a la base de datos que borre ese fallo
    fetch(`${API_BASE_URL}/fallos/${idToRemove}`, { method: 'DELETE' })
        .catch(e => console.error("Error borrando fallo:", e));
    
    queue.splice(idx, 1);
    if (queue.length === 0) showScreen('summary-screen');
    else {
        if (idx >= queue.length) idx = 0;
        renderQuestion();
    }
}

// ==========================================
// 3. PANEL DE ADMINISTRACIÓN (CRUD)
// ==========================================
let adminCurrentModule = '';

async function showAdmin() {
    showScreen('admin-screen');
    const list = document.getElementById('admin-module-list');
    list.innerHTML = 'Cargando...';
    try {
        const res = await fetch(`${API_BASE_URL}/menu`);
        const groups = await res.json();
        list.innerHTML = '';
        groups.forEach(g => {
            const groupHeader = document.createElement('div');
            groupHeader.style.display = "flex";
            groupHeader.style.alignItems = "center";
            groupHeader.style.justifyContent = "space-between";
            groupHeader.style.marginBottom = "10px";
            groupHeader.style.marginTop = "15px";

            const h4 = document.createElement('h4'); 
            h4.textContent = g._id; 
            h4.className = "group-title"; 
            h4.style.margin = "0";

            const delGroupBtn = document.createElement('button');
            delGroupBtn.innerHTML = "🗑️";
            delGroupBtn.className = "menu-btn red-btn"; 
            delGroupBtn.style.padding = "4px 8px";
            delGroupBtn.style.width = "auto";
            delGroupBtn.title = "Borrar Tema/Grupo completo";
            delGroupBtn.onclick = () => deleteEntireGroup(g._id);

            groupHeader.appendChild(h4);
            groupHeader.appendChild(delGroupBtn);
            list.appendChild(groupHeader);

            g.modules.forEach(m => {
                const container = document.createElement('div');
                container.style.display = "flex";
                container.style.alignItems = "center";
                container.style.gap = "5px";
                container.style.marginBottom = "5px";

                const btn = document.createElement('button'); 
                btn.className = "module-item"; 
                btn.style.flexGrow = "1";
                btn.textContent = m.name;
                btn.onclick = () => loadAdminQuestions(m.name, btn); 
                
                const delBtn = document.createElement('button');
                delBtn.innerHTML = "🗑️";
                delBtn.style.background = "transparent";
                delBtn.style.border = "none";
                delBtn.style.cursor = "pointer";
                delBtn.style.padding = "5px";
                delBtn.title = "Borrar módulo";
                delBtn.onclick = (e) => {
                    e.stopPropagation(); 
                    deleteEntireModule(m.name);
                };

                container.appendChild(btn);
                container.appendChild(delBtn);
                list.appendChild(container);
            });
        });
    } catch(e) { list.innerHTML = 'Error.'; }
}

async function deleteEntireModule(moduleName) {
    const confirmacion = confirm(`⚠️ ¡ATENCIÓN! ⚠️\n¿Estás seguro de que quieres borrar TODAS las preguntas de "${moduleName}"?\nEsta acción no se puede deshacer.`);
    
    if (!confirmacion) return;

    try {
        const res = await fetch(`${API_BASE_URL}/admin/module/${encodeURIComponent(moduleName)}`, {
            method: 'DELETE'
        });
        
        if (res.ok) {
            alert("Módulo eliminado correctamente.");
            showAdmin(); 
            document.getElementById('admin-questions-list').innerHTML = '<p style="color:gray;">Módulo eliminado.</p>';
            document.getElementById('admin-current-module').textContent = 'Selecciona un módulo';
        } else {
            alert("Error al intentar eliminar el módulo.");
        }
    } catch (e) {
        alert("Fallo de conexión con el servidor.");
    }
}

async function deleteEntireGroup(groupName) {
    const confirmacion = confirm(`⚠️ ¡PELIGRO NUCLEAR! ⚠️\n¿Estás seguro de que quieres borrar EL TEMA ENTERO "${groupName}" y TODOS los módulos que contiene?\nEsta acción no se puede deshacer.`);
    
    if (!confirmacion) return;

    try {
        const res = await fetch(`${API_BASE_URL}/admin/group/${encodeURIComponent(groupName)}`, {
            method: 'DELETE'
        });
        
        if (res.ok) {
            alert("Tema eliminado correctamente.");
            showAdmin(); 
            document.getElementById('admin-questions-list').innerHTML = '<p style="color:gray;">Módulos eliminados.</p>';
            document.getElementById('admin-current-module').textContent = 'Selecciona un módulo';
        } else {
            alert("Error al intentar eliminar el tema.");
        }
    } catch (e) {
        alert("Fallo de conexión con el servidor.");
    }
}

// FUNCIÓN ARREGLADA: Guarda el JSON globalmente para que el botón de Editar no rompa el HTML
async function loadAdminQuestions(moduleName, btnElement) {
    document.querySelectorAll('.module-item').forEach(b => b.classList.remove('active'));
    if(btnElement) btnElement.classList.add('active');
    adminCurrentModule = moduleName;
    document.getElementById('admin-current-module').textContent = moduleName;
    const qList = document.getElementById('admin-questions-list');
    qList.innerHTML = 'Cargando...';
    try {
        const res = await fetch(`${API_BASE_URL}/admin/questions/${encodeURIComponent(moduleName)}`);
        const questions = await res.json();
        
        currentAdminQuestions = questions; // Guardamos las preguntas en la variable global
        
        qList.innerHTML = questions.length ? '' : 'Vacio.';
        
        questions.forEach(q => {
            const div = document.createElement('div');
            div.className = 'q-list-item';
            
            let answerText = '';
            if (q.type === 'text') {
                answerText = q.correctAnswerText || 'Sin respuesta';
            } else if (q.type === 'choice' && q.options) {
                answerText = q.options[q.correct] || 'Sin respuesta';
            }

            // Cambiado el onClick de Editar para pasar solo el ID y no todo el JSON
            div.innerHTML = `
                <div style="flex-grow:1; padding-right: 15px;">
                    <p style="font-size:0.9rem; font-weight:bold; margin-bottom: 5px;">${q.question}</p>
                    <span style="font-size:0.7rem; color:var(--text-muted)">Tipo: ${q.type === 'choice' ? 'Múltiple' : 'Texto'}</span>
                    <span style="font-size:0.75rem; color:#10b981; margin-left: 10px; font-family: monospace;">R: ${answerText}</span>
                </div>
                <div class="q-actions" style="display: flex; gap: 5px;">
                    <button class="q-btn q-edit" onclick="openQuestionModal('${q._id}')">✏️</button>
                    <button class="q-btn q-delete" onclick="deleteQuestion('${q._id}')">🗑️</button>
                </div>`;
            qList.appendChild(div);
        });
    } catch(e) { qList.innerHTML = 'Error.'; }
}

function toggleQuestionType() {
    const isChoice = document.getElementById('q-type').value === 'choice';
    
    // Ocultar o mostrar las secciones
    document.getElementById('type-choice-fields').classList.toggle('hidden', !isChoice);
    document.getElementById('type-text-fields').classList.toggle('hidden', isChoice);
    
    // --- FIX DEL ERROR DE CONSOLA "NOT FOCUSABLE" ---
    // Quitamos la obligación (required) al campo que esté oculto para que el navegador no se bloquee.
    const radioBtn = document.querySelector('input[name="q-correct"][value="0"]');
    const textBtn = document.getElementById('q-correctText');
    
    if (isChoice) {
        if (radioBtn) radioBtn.required = true;
        if (textBtn) textBtn.required = false;
    } else {
        if (radioBtn) radioBtn.required = false;
        if (textBtn) textBtn.required = true;
    }
}

// FUNCIÓN ARREGLADA: Ahora recibe el ID y busca la pregunta en la variable global
function openQuestionModal(qId = null) {
    document.getElementById('question-modal').classList.remove('hidden');
    document.getElementById('question-form').reset();
    
    if (qId) {
        // Busca los datos en la memoria
        const qData = currentAdminQuestions.find(q => q._id === qId);
        if (!qData) return;

        document.getElementById('q-id').value = qData._id;
        document.getElementById('modal-title').textContent = 'Editar Pregunta';
        document.getElementById('q-group').value = qData.groupName || 'General';
        document.getElementById('q-module').value = qData.moduleName;
        document.getElementById('q-text').value = qData.question;
        document.getElementById('q-type').value = qData.type || 'choice';
        
        if (qData.type === 'text') {
            document.getElementById('q-correctText').value = qData.correctAnswerText;
        } else {
            qData.options?.forEach((opt, i) => { if(i<4) document.getElementById(`q-opt-${i}`).value = opt; });
            if (qData.correct !== undefined) document.querySelector(`input[name="q-correct"][value="${qData.correct}"]`).checked = true;
        }
    } else {
        document.getElementById('q-id').value = '';
        document.getElementById('modal-title').textContent = 'Nueva Pregunta';
        if (adminCurrentModule) document.getElementById('q-module').value = adminCurrentModule;
    }
    toggleQuestionType();
}

async function saveQuestion(e) {
    e.preventDefault();
    const id = document.getElementById('q-id').value;
    const type = document.getElementById('q-type').value;
    
    let groupVal = document.getElementById('q-group').value.trim();
    let modVal = document.getElementById('q-module').value.trim();

    if (!groupVal) {
        groupVal = 'Sueltos';
    }

    if (type === 'text') {
        modVal = 'Rellenar';
    }

    const payload = {
        groupName: groupVal,
        moduleName: modVal,
        question: document.getElementById('q-text').value,
        type: type,
        explanation: "Actualiza este campo en el administrador si quieres feedback personalizado."
    };
    
    if (type === 'choice') {
        payload.options = [0,1,2,3].map(i => document.getElementById(`q-opt-${i}`).value).filter(v => v);
        const cor = document.querySelector('input[name="q-correct"]:checked');
        if (!cor) return alert("Marca la correcta.");
        payload.correct = parseInt(cor.value);
    } else {
        payload.correctAnswerText = document.getElementById('q-correctText').value;
    }
    
    try {
        await fetch(id ? `${API_BASE_URL}/admin/question/${id}` : `${API_BASE_URL}/admin/question`, {
            method: id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        document.getElementById('question-modal').classList.add('hidden');
        loadAdminQuestions(payload.moduleName);
    } catch(e) { 
        alert("Error al guardar la pregunta."); 
    }
}

async function deleteQuestion(id) {
    if (!confirm("¿Borrar?")) return;
    try {
        await fetch(`${API_BASE_URL}/admin/question/${id}`, { method: 'DELETE' });
        loadAdminQuestions(adminCurrentModule);
    } catch(e) { alert("Error."); }
}

async function uploadJSON() {
    const text = document.getElementById('json-input').value;
    
    try {
        let questionsArray = JSON.parse(text);
        
        if (!Array.isArray(questionsArray) || questionsArray.length === 0) {
            return alert("El JSON debe ser un array válido con datos.");
        }

        let finalArray = [];
        const modulesMap = {};

        questionsArray.forEach(q => {
            q.groupName = q.groupName || 'Sueltos';
            
            if (q.type === 'text') {
                q.moduleName = 'Rellenar';
            }
            
            const mapKey = `${q.groupName}_${q.moduleName}`;
            if (!modulesMap[mapKey]) modulesMap[mapKey] = [];
            modulesMap[mapKey].push(q);
        });

        for (const key in modulesMap) {
            const qs = modulesMap[key];
            const modName = qs[0].moduleName; 
            
            if (qs.length > 25) {
                const numParts = Math.ceil(qs.length / 25);
                const idealChunkSize = Math.ceil(qs.length / numParts);
                
                for (let i = 0; i < numParts; i++) {
                    const chunk = qs.slice(i * idealChunkSize, (i + 1) * idealChunkSize);
                    chunk.forEach(q => {
                        finalArray.push({ 
                            ...q, 
                            moduleName: `${modName} (Parte ${i + 1})` 
                        });
                    });
                }
            } else {
                finalArray.push(...qs);
            }
        }

        const res = await fetch(`${API_BASE_URL}/admin/create-module`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(finalArray)
        });
        
        if (res.ok) {
            alert("Subido y organizado correctamente.");
            document.getElementById('upload-json-modal').classList.add('hidden');
            showAdmin();
        } else {
            alert("Error del servidor al guardar.");
        }
        
    } catch(e) { 
        console.error(e);
        alert("Error JSON: Revisa que el texto tenga un formato JSON válido."); 
    }
}