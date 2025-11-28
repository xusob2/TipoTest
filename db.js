const mongoose = require('mongoose');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/quizdb';
// --- ESQUEMAS ---

// 1. Esquema de Pregunta (Guardaremos esto en la colección 'Questions')
const QuestionSchema = new mongoose.Schema({
    moduleName: { type: String, required: true }, // Tema/Módulo al que pertenece
    question: { type: String, required: true },
    options: [{ type: String, required: true }],
    correct: { type: Number, required: true }, // Índice de la respuesta correcta
    explanation: { type: String, default: 'No hay explicación disponible.' }
});

// 2. Esquema de Puntuación (Scores)
const ScoreSchema = new mongoose.Schema({
    moduleName: { type: String, required: true },
    userName: { type: String, required: true, default: 'Anónimo' },
    date: { type: Date, default: Date.now },
    correctCount: { type: Number, required: true }, // Aciertos
    incorrectCount: { type: Number, required: true }, // Fallos
    totalQuestions: { type: Number, required: true },
    percentage: { type: Number, required: true } // Porcentaje calculado
});

// 3. Esquema de Reportes (QuestionReports)
const ReportSchema = new mongoose.Schema({
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
    moduleName: { type: String, required: true },
    reason: { type: String, required: true },
    status: { type: String, enum: ['Pendiente', 'Revisada', 'Eliminada'], default: 'Pendiente' },
    reportCount: { type: Number, default: 1 },
    date: { type: Date, default: Date.now }
});


// --- CONEXIÓN Y EXPORTACIÓN ---

mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ Conexión a MongoDB exitosa.'))
    .catch(err => console.error('❌ Error de conexión a MongoDB:', err));

// Exportar los modelos para usarlos en server.js
module.exports = {
    Question: mongoose.model('Question', QuestionSchema),
    Score: mongoose.model('Score', ScoreSchema),
    Report: mongoose.model('Report', ReportSchema)
};