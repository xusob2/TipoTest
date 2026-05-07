const API_BASE_URL = '/api';

// --- Variables Globales del Quiz ---
let globalFallos = JSON.parse(localStorage.getItem('hacking_fallos_ut4')) || [];
let selectedCat = null;
let queue = [];
let failedPool = [];
let idx = 0;
let correctsInSession = 0;
let mode = 'quiz'; // 'quiz' o 'review'
let isAnswered = false;
let timeoutId = null;

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
// 1. CARGA DEL MENÚ PRINCIPAL (CON FALLOS POR GRUPO)
// ==========================================
async function loadMainMenu() {
    showScreen('main-menu');
    dynamicMenuContainer.innerHTML = '<p style="color:gray; text-align:center;">Cargando módulos...</p>';
    
    try {
        const res = await fetch(`${API_BASE_URL}/menu`);
        const groups = await res.json();
        
        dynamicMenuContainer.innerHTML = '';
        
        if(groups.length === 0) {
            dynamicMenuContainer.innerHTML = '<p style="text-align:center; color:var(--text-muted)">No hay temas cargados. Usa el engranaje para administrarlos.</p>';
            return;
        }

        const styles = [
            { btn: 'yellow-btn', icon: 'terminal' },
            { btn: 'blue-btn', icon: 'unlock' },
            { btn: 'dark-btn', icon: 'network' }
        ];

        groups.forEach((group, index) => {
            // Contenedor de cada grupo para separar visualmente
            const groupWrapper = document.createElement('div');
            groupWrapper.style.marginBottom = "30px";

            const groupTitle = document.createElement('h3');
            groupTitle.className = 'group-title';
            groupTitle.textContent = group._id;
            groupWrapper.appendChild(groupTitle);

            const gridDiv = document.createElement('div');
            gridDiv.className = 'grid-2';

            group.modules.forEach((mod, i) => {
                const style = styles[(index + i) % styles.length]; 
                const btn = document.createElement('button');
                btn.className = `menu-btn ${style.btn}`;
                btn.onclick = () => startQuiz(mod.name);
                btn.innerHTML = `<i data-lucide="${style.icon}"></i> ${mod.name} (${mod.count})`;
                gridDiv.appendChild(btn);
            });
            groupWrapper.appendChild(gridDiv);

            // LOGICA DE FALLOS POR GRUPO
            const fallosDeEsteGrupo = globalFallos.filter(q => q.groupName === group._id);
            if (fallosDeEsteGrupo.length > 0) {
                const btnFallos = document.createElement('button');
                btnFallos.className = 'menu-btn red-btn col-flex center';
                btnFallos.style.marginTop = "10px";
                btnFallos.style.width = "100%";
                btnFallos.onclick = () => startFallos(group._id);
                btnFallos.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <i data-lucide="alert-triangle"></i> 
                        <span>Repasar fallos de ${group._id} (${fallosDeEsteGrupo.length})</span>
                    </div>
                `;
                groupWrapper.appendChild(btnFallos);
            }

            dynamicMenuContainer.appendChild(groupWrapper);
        });
        
        lucide.createIcons(); 
    } catch (error) {
        dynamicMenuContainer.innerHTML = '<p style="color:red; text-align:center;">Error conectando al servidor.</p>';
    }
}

// ==========================================
// 2. LÓGICA DEL JUEGO (QUIZ)
// ==========================================
function saveGlobalFallos() {
    localStorage.setItem('hacking_fallos_ut4', JSON.stringify(globalFallos));
    // No llamamos a updateFallosCount porque ahora los botones son por grupo y se refrescan al volver al menú
}

async function startQuiz(moduleName) {
    selectedCat = moduleName;
    try {
        const res = await fetch(`${API_BASE_URL}/quiz/${encodeURIComponent(moduleName)}`);
        if (!res.ok) throw new Error("Módulo no encontrado.");
        
        const data = await res.json();
        
        queue = shuffleArray(data.questions.map(q => ({
            _id: q._id,
            q: q.question,
            options: q.type === 'choice' ? q.options : null,
            a: q.type === 'choice' ? q.options[q.correct] : q.correctAnswerText,
            explanation: q.explanation || "No hay explicación disponible para esta pregunta.",
            groupName: q.groupName // Guardamos el grupo para saber dónde guardarlo si falla
        })));

        failedPool = [];
        idx = 0;
        correctsInSession = 0;
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

function startFallos(groupName) {
    const filtrados = globalFallos.filter(q => q.groupName === groupName);
    if (filtrados.length === 0) return;
    
    selectedCat = 'fallos';
    queue = shuffleArray(filtrados);
    failedPool = [];
    idx = 0;
    correctsInSession = 0;
    mode = 'quiz';
    
    quizTitle.textContent = `REPASO: ${groupName}`;
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

    // Boton borrar solo si estamos repasando fallos guardados
    yaMeLaSeContainer.classList.toggle('hidden', selectedCat !== 'fallos');

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
    queue.forEach((_, i) => {
        const dot = document.createElement('div');
        dot.className = `nav-dot ${i === idx ? 'current' : ''}`;
        dot.textContent = i + 1;
        dot.id = `nav-dot-${i}`;
        navButtonsContainer.appendChild(dot);
    });
    const activeDot = document.getElementById(`nav-dot-${idx}`);
    if (activeDot) activeDot.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
}

function handleOptionClick(btnClicked, selected, correct) {
    if (isAnswered) return;
    isAnswered = true;
    const isCorrect = selected === correct;
    if(isCorrect) correctsInSession++;
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
    if(isCorrect) correctsInSession++;
    textAnswer.disabled = true;
    btnValidate.classList.add('hidden');
    textAnswer.classList.add(isCorrect ? 'correct-input' : 'wrong-input');
    updateStateAndTimers(isCorrect);
}

function updateStateAndTimers(isCorrect) {
    const current = queue[idx];
    btnNext.disabled = false;
    document.getElementById(`nav-dot-${idx}`).classList.add(isCorrect ? 'correct' : 'incorrect');

    if (!isCorrect) {
        feedbackArea.classList.remove('hidden');
        feedbackMsg.innerHTML = `
            <div style="color:#ef4444; font-weight:900; margin-bottom:5px;">❌ INCORRECTO</div>
            <div style="color:#f4f4f5; margin-bottom:10px;">Respuesta: <span style="color:#10b981;">${current.a}</span></div>
            <div style="color:#a1a1aa; font-size:0.75rem; font-weight:400; text-transform:none; line-height:1.4;">${current.explanation}</div>
        `;
        // Guardar en la bolsa de fallos global (por grupo)
        if (!globalFallos.find(item => item.q === current.q)) {
            globalFallos.push(current);
            saveGlobalFallos();
        }
        // Bolsa de repaso de la sesión actual
        if (mode === 'quiz' && !failedPool.find(item => item.q === current.q)) {
            failedPool.push({ ...current, hits: 0 });
        }
        if (mode === 'review') {
            current.hits = 0;
            customPhrase.textContent = "Fallo. El contador vuelve a 0.";
        }
        timeoutId = setTimeout(() => handleNext(), 5000);
    } else {
        if (mode === 'review') {
            current.hits = (current.hits || 0) + 1;
            customPhrase.textContent = `Acierto ${current.hits}/3 para limpiar este fallo.`;
        }
        timeoutId = setTimeout(() => handleNext(), 2000);
    }
}

function finishQuiz() {
    const total = queue.length;
    const percent = Math.round((correctsInSession / total) * 100);
    
    let phrase = "";
    let icon = "trophy";
    let color = "#eab308";

    if (percent === 100) { phrase = "¡GOD MODE! ⚡ Dominas el sistema."; icon = "zap"; color = "#facc15"; }
    else if (percent >= 80) { phrase = "¡Excelente! Casi perfecto. ⚔️"; icon = "shield-check"; color = "#10b981"; }
    else if (percent >= 50) { phrase = "Aprobado. 📚 Sigue practicando."; icon = "book-open"; color = "#fb923c"; }
    else { phrase = "Script Kiddie... 💻 Toca estudiar más."; icon = "alert-circle"; color = "#ef4444"; }

    const summaryCard = document.querySelector('.summary-card');
    summaryCard.innerHTML = `
        <i data-lucide="${icon}" style="width: 64px; height: 64px; color: ${color}; margin-bottom: 24px;"></i>
        <h2 class="title-gradient">TEST FINALIZADO</h2>
        <div style="font-size: 2.5rem; font-weight: 900; color: ${color}; margin-bottom: 10px;">${percent}%</div>
        <p class="subtitle" style="text-transform: none; letter-spacing: normal; font-size: 1.1rem; color: #f4f4f5; margin-bottom: 30px;">${phrase}</p>
        <button class="menu-btn full-yellow-btn" onclick="loadMainMenu()">Volver al Menú</button>
    `;
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
            queue = shuffleArray(failedPool);
            failedPool = [];
            idx = 0;
            mode = 'review';
            customPhrase.textContent = "MODO REPASO: 3 aciertos para cada fallo.";
            renderQuestion();
        } else {
            finishQuiz();
        }
    } else if (mode === 'review') {
        const current = queue[idx];
        let nextQueue = [...queue];
        if (current.hits >= 3) {
            nextQueue.splice(idx, 1);
            if (nextQueue.length === 0) return finishQuiz();
        } else {
            nextQueue.splice(idx, 1);
            nextQueue.push(current);
        }
        queue = nextQueue;
        idx = 0;
        renderQuestion();
    }
}

function removeFromFallos() {
    if (timeoutId) clearTimeout(timeoutId);
    globalFallos = globalFallos.filter(q => q.q !== queue[idx].q);
    saveGlobalFallos();
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
            const h4 = document.createElement('h4');
            h4.textContent = g._id;
            h4.className = 'group-title';
            h4.style.fontSize = '0.7rem';
            list.appendChild(h4);
            g.modules.forEach(m => {
                const btn = document.createElement('button');
                btn.className = 'module-item';
                btn.textContent = m.name;
                btn.onclick = () => loadAdminQuestions(m.name, btn);
                list.appendChild(btn);
            });
        });
    } catch(e) { list.innerHTML = 'Error.'; }
}

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
        qList.innerHTML = questions.length ? '' : 'Vacio.';
        questions.forEach(q => {
            const div = document.createElement('div');
            div.className = 'q-list-item';
            div.innerHTML = `
                <div style="flex-grow:1">
                    <p style="font-size:0.9rem; font-weight:bold">${q.question}</p>
                    <span style="font-size:0.7rem; color:var(--text-muted)">Tipo: ${q.type === 'choice' ? 'Múltiple' : 'Texto'}</span>
                </div>
                <div class="q-actions">
                    <button class="q-btn q-edit" onclick='openQuestionModal(${JSON.stringify(q).replace(/'/g, "&apos;")})'>✏️</button>
                    <button class="q-btn q-delete" onclick="deleteQuestion('${q._id}')">🗑️</button>
                </div>`;
            qList.appendChild(div);
        });
    } catch(e) { qList.innerHTML = 'Error.'; }
}

function toggleQuestionType() {
    const isChoice = document.getElementById('q-type').value === 'choice';
    document.getElementById('type-choice-fields').classList.toggle('hidden', !isChoice);
    document.getElementById('type-text-fields').classList.toggle('hidden', isChoice);
}

function openQuestionModal(qData = null) {
    document.getElementById('question-modal').classList.remove('hidden');
    document.getElementById('question-form').reset();
    document.getElementById('q-id').value = qData ? qData._id : '';
    if (qData) {
        document.getElementById('modal-title').textContent = 'Editar Pregunta';
        document.getElementById('q-group').value = qData.groupName || 'General';
        document.getElementById('q-module').value = qData.moduleName;
        document.getElementById('q-text').value = qData.question;
        document.getElementById('q-type').value = qData.type || 'choice';
        if (qData.type === 'text') document.getElementById('q-correctText').value = qData.correctAnswerText;
        else {
            qData.options?.forEach((opt, i) => { if(i<4) document.getElementById(`q-opt-${i}`).value = opt; });
            if (qData.correct !== undefined) document.querySelector(`input[name="q-correct"][value="${qData.correct}"]`).checked = true;
        }
    } else {
        document.getElementById('modal-title').textContent = 'Nueva Pregunta';
        if (adminCurrentModule) document.getElementById('q-module').value = adminCurrentModule;
    }
    toggleQuestionType();
}

async function saveQuestion(e) {
    e.preventDefault();
    const id = document.getElementById('q-id').value;
    const type = document.getElementById('q-type').value;
    const payload = {
        groupName: document.getElementById('q-group').value,
        moduleName: document.getElementById('q-module').value,
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
    } catch(e) { alert("Error."); }
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
        const res = await fetch(`${API_BASE_URL}/admin/create-module`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: text
        });
        if(res.ok) {
            alert("Subido correctamente.");
            document.getElementById('upload-json-modal').classList.add('hidden');
            showAdmin();
        }
    } catch(e) { alert("Error JSON."); }
}