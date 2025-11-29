const API_BASE_URL = '/api';

// 1. Elementos UI (Selección de Pantallas y Componentes Clave)
const screens = {};
document.querySelectorAll('.screen').forEach(el => screens[el.id] = el);

const moduleListDiv = document.getElementById('module-list');
const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const feedbackArea = document.getElementById('feedback-area');
const feedbackStatus = document.getElementById('feedback-status');
const feedbackExplanation = document.getElementById('feedback-explanation');
const navButtonsContainer = document.getElementById('nav-buttons-container');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const submitBtn = document.getElementById('submit-btn');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const scoreText = document.getElementById('score-text');
const summaryContent = document.getElementById('summary-content');
const scoresListDiv = document.getElementById('scores-list');
const adminMessages = document.getElementById('admin-messages');
const jsonInput = document.getElementById('json-input');
const deleteModuleListDiv = document.getElementById('delete-module-list');
const adminUploadSection = document.getElementById('admin-upload-section');
const adminDeleteListSection = document.getElementById('admin-delete-list-section');
const confirmationModal = document.getElementById('confirmation-modal');
const modalConfirmBtn = document.getElementById('modal-confirm-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');


// 2. Estado del Quiz
let currentQuizQuestions = [];
let userAnswers = [];
let userCorrectStatus = []; // true/false si la respuesta fue correcta
let currentQuestionIndex = 0;
let currentModule = '';
let isReviewMode = false; 
let originalQuestions = []; 

// ----------------------------------------------------
// A. NAVEGACIÓN Y UTILIDADES
// ----------------------------------------------------

function showScreen(screenId) {
    console.log(`[NAV] Cambiando a pantalla: ${screenId}`);
    Object.values(screens).forEach(screen => {
        if (screen) screen.classList.add('hidden');
    });
    
    const targetScreen = screens[screenId];
    if (targetScreen) {
        targetScreen.classList.remove('hidden');
        window.scrollTo(0, 0); 
    }

    if (screenId === 'module-selection') fetchModules();
    if (screenId === 'high-scores') fetchHighScores();
    if (screenId === 'admin-area') {
        adminMessages.innerHTML = '';
        adminUploadSection.classList.add('hidden');
        adminDeleteListSection.classList.add('hidden');
    }
}

/**
 * ⭐️ FUNCIÓN DE ALEATORIZACIÓN: Baraja un array (Algoritmo Fisher-Yates).
 * @param {Array} array - Array a barajar.
 * @returns {Array} El array barajado.
 */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        // Intercambiar elementos: [array[i], array[j]] = [array[j], array[i]];
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// ----------------------------------------------------
// B. LÓGICA PRINCIPAL DEL QUIZ
// ----------------------------------------------------

async function startQuiz(moduleName, questionsToUse = null, isReview = false) {
    currentModule = moduleName;
    isReviewMode = isReview;
    currentQuestionIndex = 0;
    
    console.log(`[QUIZ] Iniciando quiz para módulo: ${moduleName}. Modo Repaso: ${isReview}`);

    if (questionsToUse) {
        currentQuizQuestions = questionsToUse;
        console.log(`[QUIZ] Usando ${currentQuizQuestions.length} preguntas en modo repaso.`);
    } else {
        try {
            const encodedModuleName = encodeURIComponent(moduleName);
            const response = await fetch(`${API_BASE_URL}/quiz/${encodedModuleName}`);
            
            if (!response.ok) {
                 throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            // ⭐️ USO DE ALEATORIZACIÓN
            currentQuizQuestions = shuffleArray(data.questions);
            
            console.log(`[API] Preguntas cargadas y aleatorizadas exitosamente para ${moduleName}: ${currentQuizQuestions.length} preguntas.`);
        } catch (error) {
            console.error('[ERROR] Error al cargar el quiz:', error);
            alert(`No se pudo cargar el quiz. Error: ${error.message}. Intenta de nuevo.`);
            return showScreen('module-selection');
        }
    }
    
    userAnswers = Array(currentQuizQuestions.length).fill(null);
    userCorrectStatus = Array(currentQuizQuestions.length).fill(false);

    if (!isReviewMode) {
        // Guardamos el orden aleatorio actual como 'original' si no es modo repaso
        originalQuestions = [...currentQuizQuestions]; 
    }

    showScreen('quiz-container');
    document.getElementById('quiz-title').textContent = isReviewMode ? `REPASO: ${currentModule}` : currentModule;
    
    recreateNavButtons(); 
    displayQuestion();
}

function displayQuestion() {
    const q = currentQuizQuestions[currentQuestionIndex];
    
    console.log(`[QUIZ] Mostrando pregunta ${currentQuestionIndex + 1}/${currentQuizQuestions.length}: "${q.question.substring(0, 30)}..."`);
    
    const total = currentQuizQuestions.length;
    const current = currentQuestionIndex + 1;
    const score = userCorrectStatus.filter(c => c).length;
    
    progressText.textContent = `P: ${current}/${total}`;
    scoreText.textContent = `Aciertos: ${score}`;
    progressBar.style.width = `${(current / total) * 100}%`;

    questionText.textContent = `${current}. ${q.question}`;
    optionsContainer.innerHTML = '';
    feedbackArea.classList.add('hidden');

    q.options.forEach((optionText, index) => {
        const button = document.createElement('button');
        button.textContent = optionText;
        button.className = 'option-button';
        button.onclick = () => selectAnswer(index);
        optionsContainer.appendChild(button);
    });
    
    if (userAnswers[currentQuestionIndex] !== null) {
        const selectedIndex = userAnswers[currentQuestionIndex];
        selectAnswer(selectedIndex, true); 
    }
    
    prevBtn.disabled = currentQuestionIndex === 0;
    
    if (currentQuestionIndex === total - 1) {
        nextBtn.classList.add('hidden');
        submitBtn.classList.remove('hidden');
    } else {
        nextBtn.classList.remove('hidden');
        submitBtn.classList.add('hidden');
    }
    updateNavButtonsStatus();
}

function updateNavigationColors() {
    // Se mantiene como alias para updateNavButtonsStatus
    updateNavButtonsStatus();
}

function selectAnswer(selectedIndex, isReload = false) {
    const q = currentQuizQuestions[currentQuestionIndex];
    const buttons = optionsContainer.querySelectorAll('.option-button');
    const isCorrect = (selectedIndex === q.correct);
    
    if (isReload) {
        console.log(`[QUIZ] Recargando respuesta para P${currentQuestionIndex + 1}. Seleccionada: ${selectedIndex}.`);
    } else if (userAnswers[currentQuestionIndex] === null) {
        userAnswers[currentQuestionIndex] = selectedIndex;
        userCorrectStatus[currentQuestionIndex] = isCorrect;
        const status = isCorrect ? 'CORRECTA' : 'INCORRECTA';
        console.log(`[QUIZ] Respuesta enviada para P${currentQuestionIndex + 1}. Índice: ${selectedIndex}. Resultado: ${status}.`);
    }

    buttons.forEach((btn, index) => {
        btn.disabled = true;
        btn.classList.remove('selected');

        if (index === q.correct) {
            btn.classList.add('correct-answer');
        } else if (index === selectedIndex && !isCorrect) {
            btn.classList.add('incorrect-answer');
        } else if (index === selectedIndex) {
            btn.classList.add('selected');
        }
    });

    displayFeedback(isCorrect, q.explanation, q.options[q.correct]);
    
    scoreText.textContent = `Aciertos: ${userCorrectStatus.filter(c => c).length}`;
    updateNavButtonsStatus();
}

function displayFeedback(isCorrect, explanation, correctAnswerText) {
    feedbackArea.classList.remove('hidden', 'correct-feedback', 'incorrect-feedback');

    if (isCorrect) {
        feedbackStatus.textContent = '✅ ¡Respuesta Correcta!';
        feedbackExplanation.innerHTML = `**Explicación:** ${explanation || 'Acertaste.'}`;
        feedbackArea.classList.add('correct-feedback');
    } else {
        feedbackStatus.textContent = '❌ Respuesta Incorrecta';
        feedbackExplanation.innerHTML = `La respuesta correcta era: **${correctAnswerText}**<br><br>**Explicación:** ${explanation || 'Necesitas repasar.'}`;
        feedbackArea.classList.add('incorrect-feedback');
    }
}

function nextQuestion() {
    if (currentQuestionIndex < currentQuizQuestions.length - 1) {
        currentQuestionIndex++;
        console.log(`[NAV] Avanzando a P${currentQuestionIndex + 1}.`);
        displayQuestion();
    }
}

function previousQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        console.log(`[NAV] Retrocediendo a P${currentQuestionIndex + 1}.`);
        displayQuestion();
    }
}

function goToQuestion(index) {
    currentQuestionIndex = index;
    console.log(`[NAV] Navegación rápida a P${currentQuestionIndex + 1}.`);
    displayQuestion();
}

function returnToModuleSelection() {
    if (confirm("¿Estás seguro de que deseas abandonar el test y perder el progreso actual?")) {
        console.log("[NAV] Abandonando quiz y volviendo a selección de módulo.");
        showScreen('module-selection');
    }
}

// ----------------------------------------------------
// C. NAVEGACIÓN RÁPIDA (UX)
// ----------------------------------------------------

function recreateNavButtons() {
    navButtonsContainer.innerHTML = '';
    console.log(`[UI] Creando ${currentQuizQuestions.length} botones de navegación rápida.`);
    
    for (let i = 0; i < currentQuizQuestions.length; i++) {
        const btn = document.createElement('button');
        btn.textContent = String(i + 1);
        btn.onclick = () => goToQuestion(i);
        btn.className = 'nav-dot'; 
        navButtonsContainer.appendChild(btn);
    }
}

function updateNavButtonsStatus() {
    const navButtons = navButtonsContainer.querySelectorAll('.nav-dot');
    navButtons.forEach((btn, i) => {
        btn.classList.remove('current-q', 'correct-q', 'incorrect-q');
        
        if (i === currentQuestionIndex) {
            btn.classList.add('current-q'); 
        } 
        
        if (userAnswers[i] !== null) { 
            if (userCorrectStatus[i]) {
                btn.classList.add('correct-q');
            } else {
                btn.classList.add('incorrect-q');
            }
        }
    });
}

// ----------------------------------------------------
// D. RESULTADOS Y SUBMIT
// ----------------------------------------------------

function submitTest(finalScore = null, finalUserCorrectStatus = null) {
    const correctCount = finalScore !== null ? finalScore : userCorrectStatus.filter(c => c).length;
    const totalQuestions = currentQuizQuestions.length;
    const percentage = (correctCount / totalQuestions) * 100;
    
    console.log(`[QUIZ] Test finalizado. Aciertos: ${correctCount}/${totalQuestions} (${percentage.toFixed(2)}%).`);

    const failedQuestions = userCorrectStatus.map((correct, index) => !correct ? index : -1).filter(index => index !== -1);
    
    let message, colorClass;

    if (percentage >= 90) {
        message = "🎉 ¡Excelente! Dominas completamente este módulo.";
        colorClass = "success";
    } else if (percentage >= 70) {
        message = "👍 Buen trabajo, tienes un buen conocimiento.";
        colorClass = "warning";
    } else {
        message = "📚 Necesitas estudiar más este módulo.";
        colorClass = "danger";
    }
    
    summaryContent.innerHTML = `
        <div class="card" style="text-align: center;">
            <h3 style="color: var(--color-${colorClass});">Test Finalizado - ${currentModule}</h3>
            <p style="font-size: 2em; font-weight: 700;">${percentage.toFixed(1)}%</p>
            <p style="font-size: 1.2em; margin-bottom: 20px;">${message}</p>
            
            <div style="display: flex; justify-content: space-around; font-size: 1.1em;">
                <span>✅ Aciertos: <strong style="color: var(--color-success);">${correctCount}</strong></span>
                <span>❌ Fallos: <strong style="color: var(--color-danger);">${totalQuestions - correctCount}</strong></span>
            </div>
            
            ${failedQuestions.length > 0 ? `<p class="hint" style="margin-top: 20px;">Tienes ${failedQuestions.length} preguntas falladas para repasar.</p>` : ''}
        </div>

        <div class="card">
            <button class="menu-button success-btn" id="save-score-btn">💾 Guardar Puntuación</button>
            ${failedQuestions.length > 0 ? `<button class="menu-button primary-btn" onclick="retryFailedQuestions(${JSON.stringify(failedQuestions)})">🔁 Repasar Fallos</button>` : ''}
        </div>
    `;

    document.getElementById('save-score-btn').onclick = saveScore;

    showScreen('summary-screen');
}

async function retryFailedQuestions(failedIndices) {
    console.log(`[QUIZ] Iniciando modo Repaso con ${failedIndices.length} preguntas falladas.`);
    const questionsToRetry = failedIndices.map(i => originalQuestions[i]);

    // ⭐️ USO DE ALEATORIZACIÓN (opcional)
    shuffleArray(questionsToRetry); 

    await startQuiz(currentModule, questionsToRetry, true);
}

async function saveScore() {
    const username = prompt("Introduce tu nombre para guardar tu récord:");
    if (!username) {
        return console.log("[SCORE] Guardado de puntuación cancelado por el usuario.");
    }

    const correctCount = userCorrectStatus.filter(c => c).length;
    const saveButton = document.getElementById('save-score-btn');
    saveButton.disabled = true;

    // ❌ RUTA ORIGINAL
    const url = `${API_BASE_URL}/scores`;

    console.log(`[API] Enviando puntuación. Usuario: ${username}, Módulo: ${currentModule}, Aciertos: ${correctCount}.`);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: username,
                moduleName: currentModule,
                correctCount: correctCount,
                incorrectCount: currentQuizQuestions.length - correctCount
            })
        });
        
        console.log(`[API] Respuesta de guardado de score: Status ${response.status}`);

        if (response.ok) {
            console.log('[API] Puntuación guardada exitosamente.');
            alert('¡Puntuación guardada! Revisa el ranking.');
        } else {
            const errorData = await response.json();
            console.error('[ERROR] Error al guardar la puntuación (Respuesta del servidor):', errorData);
            alert('Error al guardar la puntuación. Intenta de nuevo.');
        }

    } catch (error) {
        console.error('[ERROR] Error de conexión al intentar guardar la puntuación:', error);
        alert('Error de conexión con el servidor.');
    }
}

// ----------------------------------------------------
// E. PUNTUACIONES ALTAS
// ----------------------------------------------------

async function fetchHighScores() {
    scoresListDiv.innerHTML = '<p>Cargando puntuaciones...</p>';
    // ❌ RUTA ORIGINAL
    const url = `${API_BASE_URL}/scores`;
    console.log(`[API] Solicitando puntuaciones altas a: ${url}`);
    try {
        const response = await fetch(url);
        
        console.log(`[API] Respuesta de puntuaciones recibida: Status ${response.status}`);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.length === 0) {
            console.log('[API] No se encontraron puntuaciones altas.');
            scoresListDiv.innerHTML = '<div class="card"><p>Aún no hay puntuaciones. ¡Sé el primero!</p></div>';
            return;
        }

        console.log(`[API] Se cargaron ${data.length} puntuaciones.`);
        let html = '<div class="table-container"><table class="scores-table"><thead><tr><th>#</th><th>Usuario</th><th>Módulo</th><th>Aciertos</th><th>Puntos</th></tr></thead><tbody>';
        
        data.forEach((score, index) => {
            html += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${score.username}</td>
                    <td>${score.moduleName}</td>
                    <td>${score.correctCount}</td>
                    <td>${score.correctCount * 10}</td>
                </tr>
            `;
        });
        html += '</tbody></table></div>';
        scoresListDiv.innerHTML = html;

    } catch (error) {
        console.error('[ERROR] Error al obtener puntuaciones:', error);
        scoresListDiv.innerHTML = '<p class="error">Error de conexión con el servidor. ¿Está corriendo?</p>';
    }
}

// ----------------------------------------------------
// F. ADMINISTRACIÓN
// ----------------------------------------------------

function showAdminUpload() {
    console.log("[ADMIN] Mostrando sección de Carga de Módulo.");
    adminUploadSection.classList.remove('hidden');
    adminDeleteListSection.classList.add('hidden');
    adminMessages.innerHTML = '';
}

async function fetchModules() {
    moduleListDiv.innerHTML = '<p>Cargando módulos...</p>';
    // ❌ RUTA ORIGINAL
    const url = `${API_BASE_URL}/modules`;
    console.log(`[API] Solicitando lista de módulos disponibles a: ${url}`);
    try {
        const response = await fetch(url);
        
        console.log(`[API] Respuesta de módulos recibida: Status ${response.status}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.modules && data.modules.length > 0) {
            console.log(`[API] Módulos encontrados: ${data.modules.join(', ')}`);
            moduleListDiv.innerHTML = '<h3>Módulos disponibles:</h3>';
            data.modules.forEach(moduleName => {
                const button = document.createElement('button');
                button.textContent = moduleName;
                button.className = 'menu-button primary-btn';
                button.onclick = () => startQuiz(moduleName);
                moduleListDiv.appendChild(button);
            });
        } else {
            console.log('[API] No se encontraron módulos en el servidor.');
            moduleListDiv.innerHTML = '<p>No se encontraron módulos. Sube uno desde Administración.</p>';
        }

    } catch (error) {
        console.error('[ERROR] Error al obtener la lista de módulos:', error);
        moduleListDiv.innerHTML = `<p class="error">Error de conexión con el servidor. Mensaje: ${error.message}</p>`;
    }
}

async function uploadNewModule() {
    adminMessages.innerHTML = '';
    console.log("[ADMIN] Iniciando subida de nuevo módulo (JSON).");
    try {
        const jsonText = jsonInput.value.trim();
        const questionsArray = JSON.parse(jsonText);
        
        if (!Array.isArray(questionsArray) || questionsArray.length === 0) {
            console.error("[ERROR] El JSON no es un array válido o está vacío.");
            return adminMessages.innerHTML = '<p class="error">Error: El formato no es un array JSON válido o está vacío.</p>';
        }

        console.log(`[ADMIN] JSON parseado con ${questionsArray.length} preguntas.`);

        // ❌ RUTA ORIGINAL
        const url = `${API_BASE_URL}/admin/create-module`;
        console.log(`[API] Enviando JSON a: ${url}`);

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: jsonText
        });

        console.log(`[API] Respuesta de subida de módulo: Status ${response.status}`);

        const result = await response.json();
        if (response.ok) {
            console.log(`[API] Módulo subido exitosamente: ${result.message}`);
            adminMessages.innerHTML = `<p class="success">✅ Éxito: ${result.message} (${result.count} preguntas guardadas).</p>`;
            jsonInput.value = ''; 
        } else {
            console.error('[ERROR] Error del servidor al subir módulo:', result);
            adminMessages.innerHTML = `<p class="error">❌ Error del servidor: ${result.message || 'Error desconocido al subir.'}</p>`;
        }

    } catch (error) {
        console.error('[ERROR] Error al parsear o subir JSON:', error);
        adminMessages.innerHTML = `<p class="error">❌ Error: JSON no válido o fallo de conexión. (${error.message})</p>`;
    }
}

async function showAdminDeleteList() {
    console.log("[ADMIN] Mostrando sección de Eliminación de Módulos.");
    adminDeleteListSection.classList.remove('hidden');
    adminUploadSection.classList.add('hidden');
    deleteModuleListDiv.innerHTML = '<p>Cargando módulos...</p>';
    
    try {
        // ❌ RUTA ORIGINAL
        const url = `${API_BASE_URL}/modules`;
        console.log(`[API] Solicitando módulos para eliminación a: ${url}`);
        const response = await fetch(url);
        
        // Manejar respuesta no-OK antes de json() para evitar el catch por JSON inválido
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        deleteModuleListDiv.innerHTML = ''; 
        if (data.modules && data.modules.length > 0) {
            data.modules.forEach(moduleName => {
                const div = document.createElement('div');
                div.className = 'delete-item';
                div.innerHTML = `
                    <span>${moduleName}</span>
                    <button class="delete-btn" data-module="${moduleName}">Eliminar</button>
                `;
                deleteModuleListDiv.appendChild(div);
            });
            
            deleteModuleListDiv.querySelectorAll('.delete-btn').forEach(button => {
                button.onclick = (e) => {
                    const moduleToDelete = e.target.dataset.module;
                    if (confirm(`¿Estás seguro de que quieres BORRAR PERMANENTEMENTE el módulo "${moduleToDelete}"?`)) {
                        deleteModule(moduleToDelete);
                    }
                };
            });

        } else {
            console.log('[API] No hay módulos para eliminar.');
            deleteModuleListDiv.innerHTML = '<div class="card"><p>No hay módulos para gestionar.</p></div>';
        }

    } catch (error) {
        console.error('[ERROR] Error al cargar la lista de módulos para borrar:', error);
        deleteModuleListDiv.innerHTML = `<p class="error">Error al cargar la lista de módulos. Mensaje: ${error.message}</p>`;
    }
}

async function deleteModule(moduleName) {
    adminMessages.innerHTML = `<p>Eliminando módulo ${moduleName}...</p>`;
    console.log(`[ADMIN] Solicitando eliminación del módulo: ${moduleName}.`);
    try {
        const encodedModuleName = encodeURIComponent(moduleName);
        // ❌ RUTA ORIGINAL
        const url = `${API_BASE_URL}/admin/module/${encodedModuleName}`;
        console.log(`[API] Enviando DELETE a: ${url}`);
        
        const response = await fetch(url, {
            method: 'DELETE'
        });
        
        console.log(`[API] Respuesta de eliminación de módulo: Status ${response.status}`);

        const result = await response.json();
        if (response.ok) {
            console.log(`[API] Módulo ${moduleName} eliminado exitosamente: ${result.message}`);
            adminMessages.innerHTML = `<p class="success">✅ Éxito: ${result.message}</p>`;
            showAdminDeleteList(); 
        } else {
            console.error('[ERROR] Error al borrar módulo (Respuesta del servidor):', result);
            adminMessages.innerHTML = `<p class="error">❌ Error al borrar: ${result.message || 'Error desconocido.'}</p>`;
        }

    } catch (error) {
        console.error('[ERROR] Error de conexión al intentar borrar el módulo:', error);
        adminMessages.innerHTML = `<p class="error">❌ Error de conexión al intentar borrar el módulo. Mensaje: ${error.message}</p>`;
    }
}


// ----------------------------------------------------
// G. INICIALIZACIÓN
// ----------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    console.log("[APP] Aplicación inicializada. Cargando menú principal.");
    console.log(`[APP] Configuración API_BASE_URL: ${API_BASE_URL}`);

    // ASIGNACIÓN DE HANDLERS
    prevBtn.onclick = previousQuestion;
    nextBtn.onclick = nextQuestion;
    submitBtn.onclick = () => submitTest();
    
    // INICIO DE LA APLICACIÓN
    showScreen('main-menu'); 
});